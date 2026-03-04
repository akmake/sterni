import FinanceDeposit from '../models/FinanceDeposit.js';
import FinanceAccount from '../models/FinanceAccount.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const f = await Family.findOne({ 'members.user': userId });
  return f?._id;
};

// GET /api/finance/deposits
export const getDeposits = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const deposits = await FinanceDeposit.find({ family: familyId })
      .populate('addedBy', 'name')
      .sort({ endDate: 1 });

    const now = new Date();
    const summary = {
      totalPrincipal: 0, totalFutureValue: 0, activeCount: 0, maturedCount: 0,
      upcomingExits: [],
    };

    for (const d of deposits) {
      if (d.status === 'active') {
        summary.activeCount++;
        summary.totalPrincipal += d.principal;
        summary.totalFutureValue += d.futureValue || d.principal;

        const nextExit = d.exitPoints?.find(ep => ep > now);
        if (nextExit) {
          const daysUntil = Math.ceil((nextExit - now) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 90) {
            summary.upcomingExits.push({ depositId: d._id, name: d.name, exitDate: nextExit, daysUntil });
          }
        }
      } else if (d.status === 'matured') {
        summary.maturedCount++;
      }
    }

    res.json({ deposits, summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/finance/deposits
export const addDeposit = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const { name, principal, annualInterestRate, startDate, endDate, sourceAccount, exitPoints } = req.body;
    if (!name || !principal || !annualInterestRate || !startDate || !endDate) {
      return res.status(400).json({ error: 'כל השדות נדרשים' });
    }

    const deposit = await FinanceDeposit.create({
      family: familyId,
      addedBy: req.user._id,
      name, principal: Number(principal),
      annualInterestRate: Number(annualInterestRate),
      startDate: new Date(startDate), endDate: new Date(endDate),
      sourceAccount: sourceAccount || '',
      exitPoints: (exitPoints || []).map(d => new Date(d)),
    });

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:deposit:added', deposit);
    res.status(201).json(deposit);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PUT /api/finance/deposits/:id
export const updateDeposit = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const d = await FinanceDeposit.findOneAndUpdate(
      { _id: req.params.id, family: familyId },
      req.body,
      { new: true }
    );
    if (!d) return res.status(404).json({ error: 'לא נמצא' });

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:deposit:updated', d);
    res.json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/finance/deposits/:id/break
export const breakDeposit = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const d = await FinanceDeposit.findOne({ _id: req.params.id, family: familyId });
    if (!d) return res.status(404).json({ error: 'לא נמצא' });
    if (d.status !== 'active') return res.status(400).json({ error: 'הפקדון לא פעיל' });

    d.status = 'broken';
    await d.save();

    if (d.sourceAccount) {
      await FinanceAccount.findOneAndUpdate(
        { family: familyId, name: d.sourceAccount },
        { $inc: { balance: d.principal } },
        { upsert: true }
      );
    }

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:deposit:updated', d);
    res.json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/finance/deposits/:id/mature
export const matureDeposit = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const d = await FinanceDeposit.findOne({ _id: req.params.id, family: familyId });
    if (!d) return res.status(404).json({ error: 'לא נמצא' });
    if (d.status !== 'active') return res.status(400).json({ error: 'הפקדון לא פעיל' });

    d.status = 'matured';
    await d.save();

    if (d.sourceAccount) {
      const fv = d.futureValue || d.principal;
      await FinanceAccount.findOneAndUpdate(
        { family: familyId, name: d.sourceAccount },
        { $inc: { balance: fv } },
        { upsert: true }
      );
    }

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:deposit:updated', d);
    res.json(d);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/finance/deposits/:id
export const deleteDeposit = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const d = await FinanceDeposit.findOneAndDelete({ _id: req.params.id, family: familyId });
    if (!d) return res.status(404).json({ error: 'לא נמצא' });

    const io = req.app.get('io');
    io?.to(`family:${familyId}`).emit('finance:deposit:deleted', req.params.id);
    res.json({ message: 'נמחק' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
