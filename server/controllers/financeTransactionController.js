import FinanceTransaction from '../models/FinanceTransaction.js';
import FinanceAccount from '../models/FinanceAccount.js';
import MerchantMap from '../models/MerchantMap.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const f = await Family.findOne({ 'members.user': userId });
  return f?._id;
};

const normalizeType = (type) => (type === 'income' || type === 'הכנסה') ? 'הכנסה' : 'הוצאה';
const normalizeAccount = (account) => {
  const map = { 'עו"ש': 'checking', 'מזומן': 'cash' };
  return map[account] || account || 'checking';
};

// GET /api/finance/transactions
export const getTransactions = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const filter = { family: familyId };
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) filter.date.$lte = new Date(req.query.to);
    } else if (req.query.before) {
      filter.date = { $lt: new Date(req.query.before) };
    }
    if (req.query.description) {
      filter.description = req.query.description;
    }

    let q = FinanceTransaction.find(filter).sort({ date: -1 }).populate('addedBy', 'name');
    if (req.query.limit) q = q.limit(Math.min(parseInt(req.query.limit), 2000));
    res.json(await q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/finance/transactions
export const addTransaction = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    let { date, description, amount, type, category, account } = req.body;
    if (!date || !description || !amount || !type) {
      return res.status(400).json({ error: 'נא למלא תאריך, תיאור, סכום וסוג' });
    }

    const finalType = normalizeType(type);
    const finalAccount = normalizeAccount(account);
    const numericAmount = Math.abs(Number(amount));

    const tx = await FinanceTransaction.create({
      family: familyId,
      addedBy: req.user._id,
      date, description,
      amount: numericAmount,
      type: finalType,
      category: category || 'כללי',
      account: finalAccount,
    });

    // Update account balance
    const amountDelta = finalType === 'הכנסה' ? numericAmount : -numericAmount;
    await FinanceAccount.findOneAndUpdate(
      { family: familyId, name: finalAccount },
      { $inc: { balance: amountDelta } },
      { upsert: true }
    );

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:transaction:added', tx);
    res.status(201).json(tx);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'עסקה זו כבר קיימת' });
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/finance/transactions/:id
export const updateTransaction = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const old = await FinanceTransaction.findOne({ _id: req.params.id, family: familyId });
    if (!old) return res.status(404).json({ error: 'עסקה לא נמצאה' });

    const { date, description, amount, type, category, account } = req.body;
    const finalType = normalizeType(type);
    const finalAccount = normalizeAccount(account);
    const numericAmount = Math.abs(Number(amount));

    // Reverse old balance
    const oldReverse = old.type === 'הכנסה' ? -old.amount : old.amount;
    const newApply = finalType === 'הכנסה' ? numericAmount : -numericAmount;

    old.date = date; old.description = description;
    old.amount = numericAmount; old.type = finalType;
    old.category = category; old.account = finalAccount;
    await old.save();

    // Update account balances
    if (old.account === finalAccount) {
      const net = oldReverse + newApply;
      if (net !== 0) await FinanceAccount.findOneAndUpdate({ family: familyId, name: finalAccount }, { $inc: { balance: net } }, { upsert: true });
    } else {
      await FinanceAccount.findOneAndUpdate({ family: familyId, name: old.account }, { $inc: { balance: oldReverse } }, { upsert: true });
      await FinanceAccount.findOneAndUpdate({ family: familyId, name: finalAccount }, { $inc: { balance: newApply } }, { upsert: true });
    }

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:transaction:updated', old);
    res.json(old);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/finance/transactions/:id
export const deleteTransaction = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const tx = await FinanceTransaction.findOne({ _id: req.params.id, family: familyId });
    if (!tx) return res.status(404).json({ error: 'עסקה לא נמצאה' });

    const reverseAmount = tx.type === 'הכנסה' ? -tx.amount : tx.amount;
    await tx.deleteOne();
    await FinanceAccount.findOneAndUpdate({ family: familyId, name: tx.account || 'checking' }, { $inc: { balance: reverseAmount } }, { upsert: true });

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:transaction:deleted', req.params.id);
    res.json({ message: 'נמחק' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/finance/transactions/merchant-bulk
export const bulkUpdateMerchant = async (req, res) => {
  const { originalName, newDisplayName, newCategory } = req.body;

  if (!originalName) {
    return res.status(400).json({ message: 'originalName נדרש' });
  }

  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    // 1. עדכון העסקאות הנוכחיות של המשפחה במסד הנתונים
    const updateFields = {};
    if (newDisplayName && newDisplayName !== originalName) updateFields.description = newDisplayName;
    if (newCategory) updateFields.category = newCategory;

    if (Object.keys(updateFields).length > 0) {
      await FinanceTransaction.updateMany({ family: familyId, description: originalName }, { $set: updateFields });
    }

    // 2. משיכת כל ה-rawDescriptions כדי ללמד את המערכת על כל הווריאציות
    const transactions = await FinanceTransaction.find({ family: familyId, description: originalName }).select('rawDescription description');
    const uniqueRawDescriptions = [...new Set(transactions.map(t => t.rawDescription || t.description))];

    if (uniqueRawDescriptions.length === 0) uniqueRawDescriptions.push(originalName);

    const shouldUpdateCategory = newCategory && newCategory !== 'כללי';
    const shouldUpdateName = newDisplayName && newDisplayName !== originalName;

    // 3. עדכון הטבלה הגלובלית (MerchantMap) לכל וריאציה
    if (shouldUpdateCategory || shouldUpdateName) {
      for (const rawDesc of uniqueRawDescriptions) {
        await MerchantMap.findOneAndUpdate(
          { originalName: rawDesc },
          {
            $set: {
              newName: newDisplayName || originalName,
              ...(shouldUpdateCategory ? { categoryName: newCategory } : {}),
            },
            $unset: { category: 1 }
          },
          { upsert: true, new: true }
        );
      }
    }

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:transactions:updated');
    res.json({ message: 'עודכן בהצלחה והמערכת למדה את הקטגוריה!' });
  } catch (error) {
    console.error('bulkUpdateMerchant error:', error);
    res.status(500).json({ message: 'שגיאה בעדכון בית העסק' });
  }
};

// DELETE /api/finance/transactions (all)
export const deleteAllTransactions = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    await FinanceTransaction.deleteMany({ family: familyId });
    await FinanceAccount.updateMany({ family: familyId }, { $set: { balance: 0 } });

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:transactions:cleared');
    res.json({ message: 'כל העסקאות נמחקו' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
