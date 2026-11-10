import { ApiError, isObjectId, recordAudit, sendData } from './access.js';
import { notify } from './chatController.js';
import {
  CompanyCycle,
  CompanyMember,
  CompanyMilestone,
  CompanyProject,
  CompanyProjectMember,
  CompanyProjectTemplate,
  CompanyTask,
  CompanyTaskComment,
  CompanyTimeEntry,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
} from './models.js';
import { emitToOrganization } from './realtime.js';
import { accessibleProjectIds, loadProject, requireWrite } from './workController.js';

const OPEN_TASK_FILTER = { $nin: ['done', 'cancelled'] };
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_MINUTES = 24 * 60;
const REMINDER_WINDOW_MS = MS_PER_DAY;
const DUE_WORKER_INTERVAL_MS = 15 * 60 * 1000;

const invalid = (message) => new ApiError(400, 'VALIDATION_ERROR', message);
const notFound = (message) => new ApiError(404, 'NOT_FOUND', message);
const denied = (message = 'אין לך הרשאה לפעולה זו') => new ApiError(403, 'ACCESS_DENIED', message);
const orgScope = (req) => ({ organizationId: req.organization._id });
const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);
const text = (value) => (typeof value === 'string' ? value.trim() : '');

const requiredText = (value, label) => {
  const cleaned = text(value);
  if (!cleaned) throw invalid(`${label} הוא שדה חובה`);
  return cleaned;
};

const optionalDate = (value) => {
  if (value === null || value === '' || value === undefined) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw invalid('תאריך לא תקין');
  return date;
};

const audit = (req, action, resourceType, resourceId, metadata) =>
  recordAudit(req, { organizationId: req.organization._id, action, resourceType, resourceId, metadata });

const loadTaskWithAccess = async (req, taskId) => {
  const missing = notFound('המשימה לא נמצאה');
  if (!isObjectId(taskId)) throw missing;
  const task = await CompanyTask.findOne({ _id: taskId, ...orgScope(req) });
  if (!task) throw missing;
  try {
    return { task, access: await loadProject(req, task.projectId) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw missing;
    throw error;
  }
};

const requireManager = (access) => {
  if (access.role !== 'manager') throw denied();
};

// ── Comments ──

const serializeComment = (comment, authorName) => ({
  id: comment._id,
  task_id: comment.taskId,
  body: comment.body,
  author_id: comment.authorId?._id ?? comment.authorId,
  author_name: authorName ?? comment.authorId?.name ?? null,
  created_at: comment.createdAt,
});

export const listComments = async (req, res) => {
  const { task } = await loadTaskWithAccess(req, req.params.taskId);
  const comments = await CompanyTaskComment.find({ taskId: task._id }).sort({ _id: 1 }).limit(500).populate('authorId', 'name');
  sendData(req, res, comments.map((comment) => serializeComment(comment)));
};

export const addComment = async (req, res) => {
  const { task, access } = await loadTaskWithAccess(req, req.params.taskId);
  requireWrite(access);
  const body = requiredText(req.body.body, 'תגובה');
  const comment = await CompanyTaskComment.create({
    ...orgScope(req),
    taskId: task._id,
    projectId: task.projectId,
    authorId: req.user._id,
    body: body.slice(0, 5000),
  });
  await comment.populate('authorId', 'name');

  if (task.assigneeId && !task.assigneeId.equals(req.user._id)) {
    await notify(req.organization._id, task.assigneeId, {
      type: 'task_comment',
      title: `${comment.authorId.name} הגיב על "${task.title}"`,
      body: body.slice(0, 120),
      resourceType: 'project',
      resourceId: String(task.projectId),
    });
  }
  sendData(req, res, serializeComment(comment), 201);
};

export const deleteComment = async (req, res) => {
  const { task } = await loadTaskWithAccess(req, req.params.taskId);
  const missing = notFound('התגובה לא נמצאה');
  if (!isObjectId(req.params.commentId)) throw missing;
  const comment = await CompanyTaskComment.findOne({ _id: req.params.commentId, taskId: task._id });
  if (!comment) throw missing;
  if (!comment.authorId.equals(req.user._id)) throw denied('אפשר למחוק רק תגובות שלך');
  await comment.deleteOne();
  sendData(req, res, { id: comment._id });
};

// ── Time tracking ──

const serializeEntry = (entry) => ({
  id: entry._id,
  task_id: entry.taskId,
  user_id: entry.userId?._id ?? entry.userId,
  user_name: entry.userId?.name ?? null,
  minutes: entry.minutes,
  date: entry.date,
  note: entry.note,
});

export const listTimeEntries = async (req, res) => {
  const { task } = await loadTaskWithAccess(req, req.params.taskId);
  const entries = await CompanyTimeEntry.find({ taskId: task._id }).sort({ date: -1 }).limit(500).populate('userId', 'name');
  sendData(req, res, entries.map(serializeEntry), 200, {
    total_minutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
  });
};

export const addTimeEntry = async (req, res) => {
  const { task, access } = await loadTaskWithAccess(req, req.params.taskId);
  requireWrite(access);
  const minutes = Number.parseInt(req.body.minutes, 10);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) throw invalid('משך הזמן לא תקין');

  const entry = await CompanyTimeEntry.create({
    ...orgScope(req),
    taskId: task._id,
    projectId: task.projectId,
    userId: req.user._id,
    minutes,
    date: optionalDate(req.body.date) ?? new Date(),
    note: text(req.body.note).slice(0, 500),
  });
  await entry.populate('userId', 'name');
  sendData(req, res, serializeEntry(entry), 201);
};

export const deleteTimeEntry = async (req, res) => {
  const { task } = await loadTaskWithAccess(req, req.params.taskId);
  const missing = notFound('הרישום לא נמצא');
  if (!isObjectId(req.params.entryId)) throw missing;
  const entry = await CompanyTimeEntry.findOne({ _id: req.params.entryId, taskId: task._id });
  if (!entry) throw missing;
  if (!entry.userId.equals(req.user._id)) throw denied('אפשר למחוק רק רישומים שלך');
  await entry.deleteOne();
  sendData(req, res, { id: entry._id });
};

export const projectTimeSummary = async (req, res) => {
  const { project } = await loadProject(req, req.params.projectId);
  const rows = await CompanyTimeEntry.aggregate([
    { $match: { projectId: project._id } },
    { $group: { _id: '$userId', minutes: { $sum: '$minutes' } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
  ]);
  const people = rows.map((row) => ({ user_id: row._id, name: row.user[0]?.name ?? null, minutes: row.minutes }));
  sendData(req, res, { total_minutes: people.reduce((sum, p) => sum + p.minutes, 0), people });
};

// ── Milestones and cycles ──

const serializePlanItem = (item, counts) => ({
  id: item._id,
  name: item.name,
  status: item.status,
  start_at: item.startAt ?? null,
  due_at: item.dueAt ?? item.endAt ?? null,
  task_count: counts?.total ?? 0,
  completed_tasks: counts?.done ?? 0,
});

const planCounts = async (projectId, field) => {
  const rows = await CompanyTask.aggregate([
    { $match: { projectId, [field]: { $ne: null }, status: { $ne: 'cancelled' } } },
    { $group: { _id: `$${field}`, total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
};

const planHandlers = (Model, field, statuses, label, buildDates) => ({
  list: async (req, res) => {
    const { project } = await loadProject(req, req.params.projectId);
    const items = await Model.find({ projectId: project._id }).sort({ _id: 1 });
    const counts = await planCounts(project._id, field);
    sendData(req, res, items.map((item) => serializePlanItem(item, counts.get(String(item._id)))));
  },
  create: async (req, res) => {
    const access = await loadProject(req, req.params.projectId);
    requireManager(access);
    const item = await Model.create({
      ...orgScope(req),
      projectId: access.project._id,
      name: requiredText(req.body.name, 'שם'),
      ...buildDates(req.body),
    });
    sendData(req, res, serializePlanItem(item), 201);
  },
  update: async (req, res) => {
    const access = await loadProject(req, req.params.projectId);
    requireManager(access);
    const missing = notFound(`${label} לא נמצאה`);
    if (!isObjectId(req.params.itemId)) throw missing;
    const item = await Model.findOne({ _id: req.params.itemId, projectId: access.project._id });
    if (!item) throw missing;
    if (has(req.body, 'name')) item.name = requiredText(req.body.name, 'שם');
    if (has(req.body, 'status')) {
      if (!statuses.includes(req.body.status)) throw invalid('סטטוס לא תקין');
      item.status = req.body.status;
    }
    Object.assign(item, buildDates(req.body, true));
    await item.save();
    sendData(req, res, serializePlanItem(item));
  },
  remove: async (req, res) => {
    const access = await loadProject(req, req.params.projectId);
    requireManager(access);
    const missing = notFound(`${label} לא נמצאה`);
    if (!isObjectId(req.params.itemId)) throw missing;
    const item = await Model.findOneAndDelete({ _id: req.params.itemId, projectId: access.project._id });
    if (!item) throw missing;
    // Tasks outlive their plan item; they just stop pointing at it.
    await CompanyTask.updateMany({ [field]: item._id }, { $set: { [field]: null }, $inc: { version: 1 } });
    sendData(req, res, { id: item._id });
  },
});

export const milestones = planHandlers(CompanyMilestone, 'milestoneId', ['open', 'done'], 'אבן הדרך', (body, partial) => {
  if (partial && !has(body, 'due_at')) return {};
  return { dueAt: optionalDate(body.due_at) };
});

export const cycles = planHandlers(CompanyCycle, 'cycleId', ['planned', 'active', 'done'], 'ה-Sprint', (body, partial) => {
  const dates = {};
  if (!partial || has(body, 'start_at')) dates.startAt = optionalDate(body.start_at);
  if (!partial || has(body, 'end_at')) dates.endAt = optionalDate(body.end_at);
  if (dates.startAt && dates.endAt && dates.startAt > dates.endAt) throw invalid('תאריך הסיום קודם לתאריך ההתחלה');
  return dates;
});

// ── Templates ──

const serializeTemplate = (template) => ({
  id: template._id,
  name: template.name,
  description: template.description,
  task_count: template.tasks.length,
});

export const listTemplates = async (req, res) => {
  const templates = await CompanyProjectTemplate.find(orgScope(req)).sort({ _id: -1 });
  sendData(req, res, templates.map(serializeTemplate));
};

export const saveAsTemplate = async (req, res) => {
  const access = await loadProject(req, req.params.projectId);
  requireManager(access);
  const tasks = await CompanyTask.find({ projectId: access.project._id, status: { $ne: 'cancelled' } }).sort({ _id: 1 });
  const base = access.project.createdAt.getTime();

  const template = await CompanyProjectTemplate.create({
    ...orgScope(req),
    name: requiredText(req.body.name, 'שם התבנית'),
    description: access.project.description,
    createdBy: req.user._id,
    tasks: tasks.map((task) => ({
      title: task.title,
      description: task.description,
      priority: task.priority,
      type: task.type,
      offsetDays: task.dueAt ? Math.max(Math.round((task.dueAt.getTime() - base) / MS_PER_DAY), 0) : null,
    })),
  });
  await audit(req, 'template.created', 'template', template._id, { name: template.name });
  sendData(req, res, serializeTemplate(template), 201);
};

export const deleteTemplate = async (req, res) => {
  const missing = notFound('התבנית לא נמצאה');
  if (!isObjectId(req.params.templateId)) throw missing;
  const template = await CompanyProjectTemplate.findOneAndDelete({ _id: req.params.templateId, ...orgScope(req) });
  if (!template) throw missing;
  sendData(req, res, { id: template._id });
};

export const createProjectFromTemplate = async (req, res) => {
  const missing = notFound('התבנית לא נמצאה');
  if (!isObjectId(req.body.template_id)) throw missing;
  const template = await CompanyProjectTemplate.findOne({ _id: req.body.template_id, ...orgScope(req) });
  if (!template) throw missing;

  const name = requiredText(req.body.name, 'שם הפרויקט');
  const project = await CompanyProject.create({
    ...orgScope(req),
    name,
    description: template.description,
    ownerId: req.user._id,
  });
  await CompanyProjectMember.create({ ...orgScope(req), projectId: project._id, userId: req.user._id, role: 'manager' });

  const now = Date.now();
  await CompanyTask.insertMany(
    template.tasks.map((task) => ({
      ...orgScope(req),
      projectId: project._id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      type: task.type,
      dueAt: task.offsetDays === null || task.offsetDays === undefined ? null : new Date(now + task.offsetDays * MS_PER_DAY),
      createdBy: req.user._id,
    }))
  );
  await audit(req, 'project.created', 'project', project._id, { name, template: template.name });
  sendData(req, res, { id: project._id, name: project.name, task_count: template.tasks.length }, 201);
};

// ── Bulk edit and workload ──

export const bulkUpdateTasks = async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids.filter(isObjectId).map(String))] : [];
  if (ids.length === 0) throw invalid('לא נבחרו משימות');
  const updates = {};
  if (has(req.body, 'status')) {
    if (!TASK_STATUSES.includes(req.body.status)) throw invalid('סטטוס לא תקין');
    if (req.body.status === 'done') throw invalid('סגירת משימות נעשית אחת אחת, כדי לאכוף חוסמות ובדיקות');
    updates.status = req.body.status;
  }
  if (has(req.body, 'priority')) {
    if (!TASK_PRIORITIES.includes(req.body.priority)) throw invalid('עדיפות לא תקינה');
    updates.priority = req.body.priority;
  }
  if (has(req.body, 'type')) {
    if (!TASK_TYPES.includes(req.body.type)) throw invalid('סוג לא תקין');
    updates.type = req.body.type;
  }
  if (Object.keys(updates).length === 0) throw invalid('לא נשלח שינוי');

  const accessible = await accessibleProjectIds(req);
  const scope = { _id: { $in: ids }, ...orgScope(req), ...(accessible ? { projectId: { $in: accessible } } : {}) };
  const tasks = await CompanyTask.find(scope).select('projectId');

  // A task in a project where the user is only a viewer is skipped, not edited.
  const viewerOf = new Set(
    (
      await CompanyProjectMember.find({
        userId: req.user._id,
        projectId: { $in: tasks.map((task) => task.projectId) },
        role: 'viewer',
      })
    ).map((row) => String(row.projectId))
  );
  const editable = req.membership.role === 'owner' ? tasks : tasks.filter((task) => !viewerOf.has(String(task.projectId)));

  const result = await CompanyTask.updateMany(
    { _id: { $in: editable.map((task) => task._id) } },
    { $set: updates, $inc: { version: 1 } }
  );
  await audit(req, 'task.bulk_updated', 'task', null, { count: result.modifiedCount, changes: updates });
  emitToOrganization(req.organization._id, 'work_changed');
  sendData(req, res, { updated: result.modifiedCount, skipped: ids.length - result.modifiedCount });
};

export const getWorkload = async (req, res) => {
  const accessible = await accessibleProjectIds(req);
  const match = {
    organizationId: req.organization._id,
    assigneeId: { $ne: null },
    status: OPEN_TASK_FILTER,
    ...(accessible ? { projectId: { $in: accessible } } : {}),
  };
  const now = new Date();
  const rows = await CompanyTask.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$assigneeId',
        open: { $sum: 1 },
        overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$dueAt', null] }, { $lt: ['$dueAt', now] }] }, 1, 0] } },
        urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
      },
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $sort: { open: -1 } },
  ]);
  sendData(
    req,
    res,
    rows.map((row) => ({
      user_id: row._id,
      name: row.user[0]?.name ?? null,
      open: row.open,
      overdue: row.overdue,
      urgent: row.urgent,
    }))
  );
};

// ── Background: due-date reminders ──

export const deliverDueSoonReminders = async () => {
  const limit = new Date(Date.now() + REMINDER_WINDOW_MS);
  const tasks = await CompanyTask.find({
    dueAt: { $ne: null, $lte: limit },
    assigneeId: { $ne: null },
    status: OPEN_TASK_FILTER,
    dueReminderSentAt: null,
  }).limit(200);

  await Promise.all(
    tasks.map(async (task) => {
      const claimed = await CompanyTask.findOneAndUpdate(
        { _id: task._id, dueReminderSentAt: null },
        { $set: { dueReminderSentAt: new Date() } }
      );
      if (!claimed) return;
      const active = await CompanyMember.exists({
        organizationId: task.organizationId,
        userId: task.assigneeId,
        status: 'active',
      });
      if (!active) return;
      await notify(task.organizationId, task.assigneeId, {
        type: 'due_soon',
        title: `המשימה "${task.title}" מתקרבת לתאריך היעד`,
        resourceType: 'project',
        resourceId: String(task.projectId),
      });
    })
  );
};

export const startDueReminderWorker = () =>
  setInterval(() => deliverDueSoonReminders().catch((error) => console.error('[companyos] due reminders', error)), DUE_WORKER_INTERVAL_MS);
