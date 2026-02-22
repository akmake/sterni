import Task from '../models/Task.js';

// שליפת כל המשימות (וביצוע ניקיון למשימות ישנות מאוד)
export const getTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    // שלב א': ניקוי משימות שהושלמו לפני יותר מ-30 יום
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await Task.deleteMany({ 
      userId,
      isCompleted: true, 
      completedAt: { $lt: thirtyDaysAgo } 
    });

    // שלב ב': שליפת המשימות של המשתמש בלבד
    const tasks = await Task.find({ userId }).sort({ isCompleted: 1, createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// הוספת משימה
export const createTask = async (req, res) => {
  try {
    if (!req.body.text) return res.status(400).json({ error: "Task text is required" });
    
    const task = await Task.create({ text: req.body.text, userId: req.user._id });
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// עדכון סטטוס (בוצע/לא בוצע)
export const updateTaskStatus = async (req, res) => {
  try {
    const { isCompleted } = req.body;
    const updateData = {
      isCompleted,
      completedAt: isCompleted ? new Date() : null
    };
    
    const task = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// מחיקת משימה
export const deleteTask = async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};