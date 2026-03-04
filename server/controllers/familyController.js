import Family from '../models/Family.js';

// Create a new family
export const createFamily = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'שם המשפחה נדרש' });

    // Check if user already owns a family
    const existing = await Family.findOne({ owner: req.user._id });
    if (existing) return res.status(400).json({ error: 'כבר יצרת משפחה. אפשר להצטרף רק למשפחה אחת' });

    // Check if user is already a member of any family
    const memberOf = await Family.findOne({ 'members.user': req.user._id });
    if (memberOf) return res.status(400).json({ error: 'אתה כבר חבר במשפחה. עזוב אותה קודם' });

    const code = await Family.generateUniqueCode();
    const family = await Family.create({
      name: name.trim(),
      code,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'owner' }]
    });

    await family.populate('members.user', 'name email');
    res.json(family);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Join a family by code
export const joinFamily = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'קוד משפחה נדרש' });

    // Check if already in a family
    const memberOf = await Family.findOne({ 'members.user': req.user._id });
    if (memberOf) return res.status(400).json({ error: 'אתה כבר חבר במשפחה. עזוב אותה קודם' });

    const family = await Family.findOne({ code: code.trim().toUpperCase() });
    if (!family) return res.status(404).json({ error: 'לא נמצאה משפחה עם הקוד הזה' });

    // Check if already a member
    const alreadyMember = family.members.some(m => m.user.toString() === req.user._id.toString());
    if (alreadyMember) return res.status(400).json({ error: 'אתה כבר חבר במשפחה הזו' });

    family.members.push({ user: req.user._id, role: 'member' });
    await family.save();
    await family.populate('members.user', 'name email');

    res.json(family);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get my family
export const getMyFamily = async (req, res) => {
  try {
    const family = await Family.findOne({ 'members.user': req.user._id })
      .populate('members.user', 'name email');
    
    if (!family) return res.json(null);
    res.json(family);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Leave family
export const leaveFamily = async (req, res) => {
  try {
    const family = await Family.findOne({ 'members.user': req.user._id });
    if (!family) return res.status(404).json({ error: 'אתה לא חבר באף משפחה' });

    // If owner is leaving, delete the family
    if (family.owner.toString() === req.user._id.toString()) {
      await Family.findByIdAndDelete(family._id);
      return res.json({ message: 'המשפחה נמחקה (היית הבעלים)' });
    }

    // Remove member
    family.members = family.members.filter(m => m.user.toString() !== req.user._id.toString());
    await family.save();
    res.json({ message: 'עזבת את המשפחה בהצלחה' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Remove a member (owner only)
export const removeMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const family = await Family.findOne({ owner: req.user._id });
    if (!family) return res.status(403).json({ error: 'רק בעל המשפחה יכול להסיר חברים' });

    if (memberId === req.user._id.toString()) {
      return res.status(400).json({ error: 'לא ניתן להסיר את עצמך' });
    }

    family.members = family.members.filter(m => m.user.toString() !== memberId);
    await family.save();
    await family.populate('members.user', 'name email');
    res.json(family);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============= CATEGORY MANAGEMENT =============

// Helper: find the user's family
const findUserFamily = async (userId) => {
  return Family.findOne({ 'members.user': userId });
};

// Add a category (any type: 'shopping' | 'task' | 'expense')
export const addCategory = async (req, res) => {
  try {
    const { type } = req.params; // 'shopping' | 'task' | 'expense'
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'שם הקטגוריה נדרש' });

    const fieldMap = { shopping: 'shoppingCategories', task: 'taskCategories', expense: 'expenseCategories' };
    const field = fieldMap[type];
    if (!field) return res.status(400).json({ error: 'סוג לא תקין' });

    const family = await findUserFamily(req.user._id);
    if (!family) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    // Check for duplicate name
    const exists = family[field].some(c => c.name === name.trim());
    if (exists) return res.status(400).json({ error: 'קטגוריה עם שם זה כבר קיימת' });

    family[field].push({ name: name.trim(), color: color || undefined });
    await family.save();
    res.json(family[field]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Remove a category
export const removeCategory = async (req, res) => {
  try {
    const { type, categoryId } = req.params;
    const fieldMap = { shopping: 'shoppingCategories', task: 'taskCategories', expense: 'expenseCategories' };
    const field = fieldMap[type];
    if (!field) return res.status(400).json({ error: 'סוג לא תקין' });

    const family = await findUserFamily(req.user._id);
    if (!family) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    family[field] = family[field].filter(c => c._id.toString() !== categoryId);
    await family.save();
    res.json(family[field]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get categories by type
export const getCategories = async (req, res) => {
  try {
    const { type } = req.params;
    const fieldMap = { shopping: 'shoppingCategories', task: 'taskCategories', expense: 'expenseCategories' };
    const field = fieldMap[type];
    if (!field) return res.status(400).json({ error: 'סוג לא תקין' });

    const family = await findUserFamily(req.user._id);
    if (!family) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    res.json(family[field]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
