import ShoppingItem from '../models/ShoppingItem.js';
import Family from '../models/Family.js';

// Helper: get user's family ID
const getFamilyId = async (userId) => {
  const family = await Family.findOne({ 'members.user': userId });
  return family?._id;
};

// Get all shopping items for my family
export const getShoppingItems = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const items = await ShoppingItem.find({ family: familyId })
      .populate('addedBy', 'name')
      .populate('boughtBy', 'name')
      .sort({ isBought: 1, priority: -1, createdAt: -1 });

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add a shopping item
export const addShoppingItem = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const { name, quantity, category, priority, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'שם המוצר נדרש' });

    const item = await ShoppingItem.create({
      family: familyId,
      name: name.trim(),
      quantity: quantity || '',
      category: category || 'other',
      priority: priority || 'normal',
      notes: notes || '',
      addedBy: req.user._id
    });

    await item.populate('addedBy', 'name');
    
    // Emit socket event for real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('shopping:added', item);
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle bought status
export const toggleShoppingItem = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const item = await ShoppingItem.findOne({ _id: req.params.id, family: familyId });
    if (!item) return res.status(404).json({ error: 'פריט לא נמצא' });

    item.isBought = !item.isBought;
    item.boughtBy = item.isBought ? req.user._id : null;
    item.boughtAt = item.isBought ? new Date() : null;
    await item.save();
    await item.populate('addedBy', 'name');
    await item.populate('boughtBy', 'name');

    // Emit socket event for real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('shopping:toggled', item);
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update shopping item
export const updateShoppingItem = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const item = await ShoppingItem.findOneAndUpdate(
      { _id: req.params.id, family: familyId },
      { ...req.body },
      { new: true }
    ).populate('addedBy', 'name').populate('boughtBy', 'name');

    if (!item) return res.status(404).json({ error: 'פריט לא נמצא' });

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('shopping:updated', item);
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete shopping item
export const deleteShoppingItem = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const item = await ShoppingItem.findOneAndDelete({ _id: req.params.id, family: familyId });
    if (!item) return res.status(404).json({ error: 'פריט לא נמצא' });

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('shopping:deleted', req.params.id);
    }

    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Clear all bought items
export const clearBoughtItems = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    await ShoppingItem.deleteMany({ family: familyId, isBought: true });

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('shopping:clearedBought');
    }

    res.json({ message: 'כל הפריטים שנקנו נמחקו' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
