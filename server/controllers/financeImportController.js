import { cleanCalFile, cleanMaxFile, cleanIsracardFile } from '../utils/excelCleaners.js';
import { parseTransactions } from '../utils/excelParser.js';
import FinanceTransaction from '../models/FinanceTransaction.js';
import FinanceAccount from '../models/FinanceAccount.js';
import FinanceCategoryRule from '../models/FinanceCategoryRule.js';
import MerchantMap from '../models/MerchantMap.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const f = await Family.findOne({ 'members.user': userId });
  return f?._id;
};

const applyRulesInMemory = (transaction, rules) => {
  if (!transaction.rawDescription) transaction.rawDescription = transaction.description;

  for (const rule of rules) {
    let isMatch = false;
    const desc = (transaction.rawDescription || transaction.description || '').toLowerCase();
    const kw = (rule.searchString || '').toLowerCase();

    if (rule.matchType === 'exact') isMatch = desc === kw;
    else if (rule.matchType === 'starts_with') isMatch = desc.startsWith(kw);
    else isMatch = desc.includes(kw);

    if (isMatch) {
      transaction.category = rule.category?.name || rule.category || 'כללי';
      if (rule.newName) transaction.description = rule.newName;
      break;
    }
  }
  return transaction;
};

// POST /api/finance/import/parse
export const uploadAndParse = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const { data, fileType } = req.body;
    if (!data || !fileType) return res.status(400).json({ error: 'נדרשים data ו-fileType' });

    const cleanerMap = { cal: cleanCalFile, max: cleanMaxFile, isracard: cleanIsracardFile };
    const cleaner = cleanerMap[fileType];
    if (!cleaner) return res.status(400).json({ error: 'סוג קובץ לא נתמך. השתמש ב: cal, max, isracard' });

    const cleanedData = cleaner(data);
    const { transactions, unseenMerchants } = await parseTransactions(cleanedData, fileType, familyId, req.user._id);

    res.json({ transactions, unseenMerchants, count: transactions.length });
  } catch (err) {
    res.status(500).json({ error: `שגיאה בפענוח הקובץ: ${err.message}` });
  }
};

// POST /api/finance/import/process
export const processTransactions = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const { transactions, newMappings } = req.body;
    if (!Array.isArray(transactions)) return res.status(400).json({ error: 'נדרש מערך עסקאות' });

    // Load rules and apply them
    const rules = await FinanceCategoryRule.find({ family: familyId }).populate('category').lean();
    const processed = transactions.map(t => {
      const obj = { ...t, family: familyId, addedBy: req.user._id, rawDescription: t.rawDescription || t.description };
      return applyRulesInMemory(obj, rules);
    });

    // Save newMappings to MerchantMap (global dictionary)
    if (newMappings && newMappings.length > 0) {
      const mappingDocs = newMappings.map(m => ({
        originalName: m.originalName,
        newName: m.newName,
        category: m.category || null,
      }));
      await MerchantMap.insertMany(mappingDocs, { ordered: false }).catch(err => {
        if (err.code !== 11000) throw err;
      });
    }

    // Insert (skip duplicates)
    let insertedCount = 0;
    if (processed.length > 0) {
      try {
        const result = await FinanceTransaction.insertMany(processed, { ordered: false });
        insertedCount = result.length;
      } catch (error) {
        if (error.code === 11000) {
          insertedCount = error.insertedDocs?.length || error.result?.insertedCount || error.result?.nInserted || 0;
        } else {
          throw error;
        }
      }
    }

    // Recalculate account balances
    const agg = await FinanceTransaction.aggregate([
      { $match: { family: familyId } },
      {
        $group: {
          _id: '$account',
          total: {
            $sum: {
              $cond: [{ $eq: ['$type', 'הכנסה'] }, '$amount', { $multiply: ['$amount', -1] }]
            }
          }
        }
      }
    ]);

    for (const item of agg) {
      const accountName = item._id || 'עו"ש';
      await FinanceAccount.findOneAndUpdate(
        { family: familyId, name: accountName },
        { balance: item.total },
        { upsert: true }
      );
    }

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:import:completed', { count: insertedCount });

    res.json({ message: `הייבוא הושלם! נוספו ${insertedCount} עסקאות.`, insertedCount });
  } catch (err) {
    res.status(500).json({ error: `שגיאה בעיבוד העסקאות: ${err.message}` });
  }
};
