import Task from '../models/Task.js';
import User from '../models/userModel.js';
import { emitToUser, pushToUser } from '../services/assignmentNotifier.js';

// מודיע ליוצר (אם מישהו אחר יצר את המטלה) שהסטטוס השתנה — מתעדכן אצלו בעמוד הצופה
const notifyCreator = (task) => {
  if (task?.createdBy && String(task.createdBy) !== String(task.userId)) {
    emitToUser(task.createdBy, 'assignments:changed', { kind: 'task' });
  }
};

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
    const tasks = await Task.find({ userId })
      .populate('createdBy', 'name')
      .sort({ isCompleted: 1, createdAt: -1 });
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

// עדכון סטטוס (בוצע/לא בוצע) או טקסט
export const updateTaskStatus = async (req, res) => {
  try {
    const { isCompleted, text } = req.body;
    const updateData = {};
    
    if (typeof isCompleted === 'boolean') {
      updateData.isCompleted = isCompleted;
      updateData.completedAt = isCompleted ? new Date() : null;
    }
    if (text && text.trim()) {
      updateData.text = text.trim();
    }
    
    // רק בעל המטלה (הקוד הקודם עדכן כל מטלה לפי id — בלי בדיקת בעלות)
    const task = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, updateData, { new: true })
      .populate('createdBy', 'name');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    notifyCreator({ ...task.toObject(), createdBy: task.createdBy?._id });
    // מי שיצר עבורי את המטלה מקבל התראה כשסיימתי אותה
    if (isCompleted === true && task.createdBy?._id && String(task.createdBy._id) !== String(req.user._id)) {
      const owner = await User.findById(req.user._id).select('name').lean();
      pushToUser(task.createdBy._id, {
        title: `✅ ${owner?.name || 'המשימה'} סימן/ה כבוצע`,
        body: task.text,
        url: '/wa-view',
        tag: `task-done-${task._id}`,
      }).catch(() => {});
    }
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// מחיקת משימה
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    notifyCreator(task);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// המרת מטלה לפרויקט
export const convertTaskToProject = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Dynamic import to avoid circular dependency
    const Project = (await import('../models/Project.js')).default;

    const newProject = await Project.create({
      owner: req.user._id,
      projectName: task.text,
      description: 'נוצר ממטלה מהירה',
      tasks: [{ name: 'הגדר משימות ראשונות', done: false }]
    });

    await Task.findByIdAndDelete(task._id);

    res.json({ message: 'Task converted to project', newProject });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// סימון מטלות שהוקצו לי כ"נראו" — עוצר את התזכורות (assignmentNotifier)
export const markTasksSeen = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 200) : [];
    const filter = { userId: req.user._id, createdBy: { $ne: null }, seenAt: null };
    if (ids.length) filter._id = { $in: ids };
    const touched = await Task.find(filter).select('createdBy').lean();
    await Task.updateMany(filter, { $set: { seenAt: new Date(), nextReminderAt: null } });
    [...new Set(touched.map((t) => String(t.createdBy)))].forEach((c) => emitToUser(c, 'assignments:changed', { kind: 'task' }));
    res.json({ ok: true, count: touched.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
