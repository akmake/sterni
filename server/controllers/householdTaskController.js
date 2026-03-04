import HouseholdTask from '../models/HouseholdTask.js';
import Family from '../models/Family.js';

const getFamilyId = async (userId) => {
  const family = await Family.findOne({ 'members.user': userId });
  return family?._id;
};

// Get all household tasks
export const getHouseholdTasks = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const tasks = await HouseholdTask.find({ family: familyId })
      .populate('assignedTo', 'name')
      .populate('createdBy', 'name')
      .populate('completedBy', 'name')
      .sort({ isCompleted: 1, priority: -1, dueDate: 1, createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a household task
export const createHouseholdTask = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const { title, description, category, assignedTo, dueDate, recurring, priority } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'כותרת המשימה נדרשת' });

    const task = await HouseholdTask.create({
      family: familyId,
      title: title.trim(),
      description: description || '',
      category: category || 'other',
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      dueDate: dueDate || null,
      recurring: recurring || { enabled: false },
      priority: priority || 'normal'
    });

    await task.populate('assignedTo', 'name');
    await task.populate('createdBy', 'name');

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('householdTask:added', task);
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle task completion
export const toggleHouseholdTask = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const task = await HouseholdTask.findOne({ _id: req.params.id, family: familyId });
    if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

    task.isCompleted = !task.isCompleted;
    task.completedBy = task.isCompleted ? req.user._id : null;
    task.completedAt = task.isCompleted ? new Date() : null;
    await task.save();

    await task.populate('assignedTo', 'name');
    await task.populate('createdBy', 'name');
    await task.populate('completedBy', 'name');

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('householdTask:toggled', task);
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update household task
export const updateHouseholdTask = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const task = await HouseholdTask.findOneAndUpdate(
      { _id: req.params.id, family: familyId },
      { ...req.body },
      { new: true }
    ).populate('assignedTo', 'name')
     .populate('createdBy', 'name')
     .populate('completedBy', 'name');

    if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('householdTask:updated', task);
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete household task
export const deleteHouseholdTask = async (req, res) => {
  try {
    const familyId = await getFamilyId(req.user._id);
    if (!familyId) return res.status(400).json({ error: 'אתה לא חבר במשפחה' });

    const task = await HouseholdTask.findOneAndDelete({ _id: req.params.id, family: familyId });
    if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

    const io = req.app.get('io');
    if (io) {
      io.to(`family:${familyId}`).emit('householdTask:deleted', req.params.id);
    }

    res.json({ message: 'נמחק בהצלחה' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
