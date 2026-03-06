import HouseholdProject from '../models/HouseholdProject.js';
import Family from '../models/Family.js';
import User from '../models/userModel.js';

// Helper: get user's family ID
const getUserFamilyId = async (userId) => {
  const family = await Family.findOne({ 'members.user': userId });
  return family?._id;
};

// Helper: verify project belongs to user's family
const assertFamilyProject = async (userId, projectId) => {
  const familyId = await getUserFamilyId(userId);
  if (!familyId) throw new Error('לא נמצאה משפחה');
  const project = await HouseholdProject.findOne({ _id: projectId, family: familyId });
  if (!project) throw new Error('פרויקט לא נמצא');
  return project;
};

// Get all household projects for user's family
export const getHouseholdProjects = async (req, res) => {
  try {
    const familyId = await getUserFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const projects = await HouseholdProject.find({ family: familyId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single project
export const getHouseholdProject = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    await project.populate('createdBy', 'name');
    await project.populate('funds.addedBy', 'name');
    await project.populate('collaborators.userId', 'name email');
    res.json(project);
  } catch (error) {
    res.status(error.message === 'פרויקט לא נמצא' ? 404 : 500).json({ error: error.message });
  }
};

// Create project
export const createHouseholdProject = async (req, res) => {
  try {
    const familyId = await getUserFamilyId(req.user._id);
    if (!familyId) return res.status(404).json({ error: 'לא נמצאה משפחה' });

    const { projectName, description, projectType, targetAmount, dueDate } = req.body;
    if (!projectName?.trim()) return res.status(400).json({ error: 'שם הפרויקט נדרש' });
    if (!['goal', 'task', 'simple', 'savings'].includes(projectType)) return res.status(400).json({ error: 'סוג פרויקט לא תקין' });

    const project = await HouseholdProject.create({
      family: familyId,
      projectName: projectName.trim(),
      description: description?.trim() || '',
      projectType,
      targetAmount: projectType === 'goal' ? (Number(targetAmount) || 0) : 0,
      dueDate: dueDate || undefined,
      createdBy: req.user._id,
    });

    await project.populate('createdBy', 'name');

    // Socket emit
    const io = req.app.get('io');
    if (io) io.to(`family:${familyId}`).emit('householdProject:added', project);

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update project (name, description, due date, target amount)
export const updateHouseholdProject = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    const { projectName, description, targetAmount, dueDate } = req.body;

    if (projectName) project.projectName = projectName.trim();
    if (description !== undefined) project.description = description;
    if (targetAmount !== undefined && project.projectType === 'goal') project.targetAmount = Number(targetAmount);
    if (dueDate !== undefined) project.dueDate = dueDate || null;

    await project.save();
    await project.populate('createdBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete project
export const deleteHouseholdProject = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    const familyId = project.family;
    await HouseholdProject.findByIdAndDelete(project._id);

    const io = req.app.get('io');
    if (io) io.to(`family:${familyId}`).emit('householdProject:deleted', project._id);

    res.json({ message: 'הפרויקט נמחק' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===== FUND Operations (for goal projects) =====
export const addFund = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    if (!['goal', 'savings'].includes(project.projectType)) return res.status(400).json({ error: 'הפקדות רלוונטיות רק לפרויקטי יעד וחיסכון' });

    const { amount, destination } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'סכום לא תקין' });

    project.funds.push({ amount: Number(amount), destination: destination || '', addedBy: req.user._id });
    await project.save();
    await project.populate('createdBy', 'name');
    await project.populate('funds.addedBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===== TASK Operations (for task projects) =====
export const addProjectTask = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    if (project.projectType === 'goal') return res.status(400).json({ error: 'משימות לא רלוונטיות לפרויקטי יעד' });

    const { name, amount } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'שם המשימה נדרש' });

    project.tasks.push({ name: name.trim(), amount: project.projectType === 'task' ? (Number(amount) || 0) : 0 });
    await project.save();
    await project.populate('createdBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleProjectTask = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    const task = project.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

    task.done = !task.done;
    await project.save();
    await project.populate('createdBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProjectTask = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    project.tasks = project.tasks.filter(t => t._id.toString() !== req.params.taskId);
    await project.save();
    await project.populate('createdBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===== UPDATE TASK (name + amount) =====
export const renameProjectTask = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    const task = project.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });

    const { name, amount } = req.body;
    if (name !== undefined) {
      if (!name?.trim()) return res.status(400).json({ error: 'שם חדש נדרש' });
      task.name = name.trim();
    }
    if (amount !== undefined) task.amount = Number(amount) || 0;
    await project.save();
    await project.populate('createdBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===== UPDATE FUND =====
export const updateFund = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    const fund = project.funds.id(req.params.fundId);
    if (!fund) return res.status(404).json({ error: 'הפקדה לא נמצאה' });

    const { amount, destination } = req.body;
    if (amount !== undefined) {
      if (Number(amount) <= 0) return res.status(400).json({ error: 'סכום לא תקין' });
      fund.amount = Number(amount);
    }
    if (destination !== undefined) fund.destination = destination;
    await project.save();
    await project.populate('createdBy', 'name');
    await project.populate('funds.addedBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===== DELETE FUND =====
export const deleteFund = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    project.funds = project.funds.filter(f => f._id.toString() !== req.params.fundId);
    await project.save();
    await project.populate('createdBy', 'name');
    await project.populate('funds.addedBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===== FILE Operations =====
export const uploadHouseholdProjectFile = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    project.files.push({
      name: originalName,
      url: `/uploads/${req.file.filename}`,
      type: req.file.mimetype,
    });
    await project.save();
    await project.populate('createdBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteHouseholdProjectFile = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    project.files = project.files.filter(f => f._id.toString() !== req.params.fileId);
    await project.save();
    await project.populate('createdBy', 'name');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ===== COLLABORATOR Operations =====
export const addCollaborator = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    const { userId, role } = req.body;

    if (!userId || !['view', 'edit'].includes(role)) {
      return res.status(400).json({ error: 'userId and valid role are required' });
    }

    // Check user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'משתמש לא נמצא' });

    // Check not already a collaborator
    const exists = project.collaborators.some(c => c.userId.toString() === userId);
    if (exists) return res.status(400).json({ message: 'User is already a collaborator' });

    project.collaborators.push({ userId, role, addedAt: new Date() });
    await project.save();
    await project.populate('collaborators.userId', 'name email');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.status(201).json({ collaborators: project.collaborators });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const removeCollaborator = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    project.collaborators.pull({ _id: req.params.collaboratorId });
    await project.save();
    await project.populate('collaborators.userId', 'name email');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json({ collaborators: project.collaborators });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCollaboratorRole = async (req, res) => {
  try {
    const project = await assertFamilyProject(req.user._id, req.params.id);
    const { role } = req.body;

    if (!['view', 'edit'].includes(role)) {
      return res.status(400).json({ error: 'תפקיד לא תקין' });
    }

    const collaborator = project.collaborators.id(req.params.collaboratorId);
    if (!collaborator) return res.status(404).json({ error: 'משתתף לא נמצא' });

    collaborator.role = role;
    await project.save();
    await project.populate('collaborators.userId', 'name email');

    const io = req.app.get('io');
    const familyId = await getUserFamilyId(req.user._id);
    if (io) io.to(`family:${familyId}`).emit('householdProject:updated', project);

    res.json({ collaborators: project.collaborators });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
