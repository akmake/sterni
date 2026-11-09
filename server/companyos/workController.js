import { ApiError, isObjectId, recordAudit, sendData } from './access.js';
import { unreadTotal } from './chatController.js';
import {
  CompanyMember,
  CompanyProject,
  CompanyProjectMember,
  CompanyRequirement,
  CompanyTask,
  CompanyTestCase,
  PROJECT_ROLES,
  PROJECT_STATUSES,
  REQUIREMENT_STATUSES,
  SEVERITIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  TEST_RESULTS,
} from './models.js';

const OPEN_TASK_FILTER = { $nin: ['done', 'cancelled'] };
const SEVERE = ['high', 'critical'];
const DEFAULT_PAGE = 50;
const MAX_PAGE = 100;

const invalid = (message) => new ApiError(400, 'VALIDATION_ERROR', message);
const notFound = (message) => new ApiError(404, 'NOT_FOUND', message);
const denied = (message = 'אין לך הרשאה לפעולה זו') => new ApiError(403, 'ACCESS_DENIED', message);

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);

const oneOf = (value, allowed, label) => {
  if (!allowed.includes(value)) throw invalid(`${label} לא תקין`);
  return value;
};

const requiredText = (value, label) => {
  const cleaned = text(value);
  if (!cleaned) throw invalid(`${label} הוא שדה חובה`);
  return cleaned;
};

const parseDate = (value) => {
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw invalid('תאריך לא תקין');
  return date;
};

const parseIdList = (value, label) => {
  if (!Array.isArray(value) || !value.every(isObjectId)) throw invalid(`${label} לא תקין`);
  return [...new Set(value.map(String))];
};

const pageOf = (query) => {
  const limit = Math.min(Number.parseInt(query.limit, 10) || DEFAULT_PAGE, MAX_PAGE);
  if (!query.cursor) return { limit, idFilter: null };
  if (!isObjectId(query.cursor)) throw invalid('cursor לא תקין');
  return { limit, idFilter: { $lt: query.cursor } };
};

const audit = (req, action, resourceType, resourceId, metadata) =>
  recordAudit(req, { organizationId: req.organization._id, action, resourceType, resourceId, metadata });

const orgScope = (req) => ({ organizationId: req.organization._id });

// ── Access (spec 7.1 + 27): project content is reached through project membership ──

// Null means "every project": only the organization owner has that reach. An
// admin works by membership, so a management title alone doesn't open content.
const accessibleProjectIds = async (req) => {
  if (req.membership.role === 'owner') return null;
  return CompanyProjectMember.find({ ...orgScope(req), userId: req.user._id }).distinct('projectId');
};

const loadProject = async (req, projectId) => {
  const missing = notFound('הפרויקט לא נמצא');
  if (!isObjectId(projectId)) throw missing;

  const project = await CompanyProject.findOne({ _id: projectId, ...orgScope(req) });
  if (!project) throw missing;

  if (req.membership.role === 'owner') return { project, role: 'manager' };

  const member = await CompanyProjectMember.findOne({ projectId: project._id, userId: req.user._id });
  if (!member) throw missing;
  return { project, role: member.role };
};

const requireWrite = (access) => {
  if (access.role === 'viewer') throw denied();
};

const requireManager = (access) => {
  if (access.role !== 'manager') throw denied();
};

const permissionsForProject = (role) => ({
  edit_project: role === 'manager',
  manage_members: role === 'manager',
  write: role !== 'viewer',
});

const assertAssignable = async (req, project, userId) => {
  if (!isObjectId(userId)) throw invalid('אחראי לא תקין');
  const orgMember = await CompanyMember.findOne({ ...orgScope(req), userId, status: 'active' });
  if (!orgMember) throw invalid('האחראי אינו חבר פעיל בארגון');
  if (orgMember.role === 'owner') return;
  if (!(await CompanyProjectMember.exists({ projectId: project._id, userId }))) {
    throw invalid('האחראי אינו חבר בפרויקט');
  }
};

// ── Serialization ──

const openBlockerIds = async (tasks) => {
  const ids = tasks.flatMap((task) => task.blockedBy);
  if (ids.length === 0) return new Set();
  const open = await CompanyTask.find({ _id: { $in: ids }, status: OPEN_TASK_FILTER }).distinct('_id');
  return new Set(open.map(String));
};

const serializeTasks = async (tasks, canWriteProject) => {
  const open = await openBlockerIds(tasks);
  return tasks.map((task) => ({
    id: task._id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    type: task.type,
    severity: task.severity,
    resolution: task.resolution,
    project_id: task.projectId?._id ?? task.projectId,
    project_name: task.projectId?.name ?? null,
    assignee_id: task.assigneeId?._id ?? task.assigneeId ?? null,
    assignee_name: task.assigneeId?.name ?? null,
    due_at: task.dueAt,
    labels: task.labels,
    blocked_by: task.blockedBy,
    is_blocked: task.blockedBy.some((id) => open.has(String(id))),
    version: task.version,
    can_edit: canWriteProject(task),
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  }));
};

const populateTask = (query) => query.populate('assigneeId', 'name').populate('projectId', 'name');

const taskCounts = async (projectIds) => {
  const rows = await CompanyTask.aggregate([
    { $match: { projectId: { $in: projectIds }, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: '$projectId',
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
};

const serializeProject = (project, role, counts) => ({
  id: project._id,
  name: project.name,
  description: project.description,
  status: project.status,
  owner_id: project.ownerId?._id ?? project.ownerId,
  owner_name: project.ownerId?.name ?? null,
  my_role: role,
  permissions: permissionsForProject(role),
  task_count: counts?.total ?? 0,
  completed_tasks: counts?.done ?? 0,
  created_at: project.createdAt,
  updated_at: project.updatedAt,
});

// ── Home ──

export const getHome = async (req, res) => {
  const accessible = await accessibleProjectIds(req);
  const projectScope = accessible ? { _id: { $in: accessible } } : {};
  const taskScope = accessible ? { projectId: { $in: accessible } } : {};
  const mine = { ...orgScope(req), ...taskScope, assigneeId: req.user._id, status: OPEN_TASK_FILTER };
  const now = new Date();

  const [openCount, overdueCount, nextTasks, projects, unreadMessages] = await Promise.all([
    CompanyTask.countDocuments(mine),
    CompanyTask.countDocuments({ ...mine, dueAt: { $ne: null, $lt: now } }),
    // Tasks with a due date come first; among those, the soonest.
    populateTask(CompanyTask.find(mine).sort({ dueAt: -1 }).limit(100)),
    CompanyProject.find({ ...orgScope(req), ...projectScope, status: 'active' }).sort({ updatedAt: -1 }).limit(5),
    unreadTotal(req),
  ]);

  const dueTime = (task) => task.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const upcoming = nextTasks.sort((a, b) => dueTime(a) - dueTime(b)).slice(0, 5);
  const counts = await taskCounts(projects.map((p) => p._id));

  sendData(req, res, {
    open_tasks: openCount,
    overdue_tasks: overdueCount,
    unread_messages: unreadMessages,
    next_tasks: await serializeTasks(upcoming, () => false),
    active_projects: projects.map((p) => ({
      id: p._id,
      name: p.name,
      status: p.status,
      task_count: counts.get(String(p._id))?.total ?? 0,
      completed_tasks: counts.get(String(p._id))?.done ?? 0,
    })),
  });
};

// ── Projects ──

export const listProjects = async (req, res) => {
  const { limit, idFilter } = pageOf(req.query);
  const accessible = await accessibleProjectIds(req);

  const filter = orgScope(req);
  if (accessible) filter._id = { $in: accessible };
  if (idFilter) filter._id = { ...filter._id, ...idFilter };
  if (req.query.status) filter.status = oneOf(req.query.status, PROJECT_STATUSES, 'סטטוס');

  const rows = await CompanyProject.find(filter).sort({ _id: -1 }).limit(limit + 1).populate('ownerId', 'name');
  const page = rows.slice(0, limit);

  const roles = new Map(
    (await CompanyProjectMember.find({ projectId: { $in: page.map((p) => p._id) }, userId: req.user._id }))
      .map((member) => [String(member.projectId), member.role])
  );
  const counts = await taskCounts(page.map((p) => p._id));
  const isOwner = req.membership.role === 'owner';

  sendData(
    req,
    res,
    page.map((project) =>
      serializeProject(project, isOwner ? 'manager' : roles.get(String(project._id)), counts.get(String(project._id)))
    ),
    200,
    { next_cursor: rows.length > limit ? page[page.length - 1]._id : null }
  );
};

export const createProject = async (req, res) => {
  const name = requiredText(req.body.name, 'שם הפרויקט');
  const project = await CompanyProject.create({
    ...orgScope(req),
    name,
    description: text(req.body.description),
    ownerId: req.user._id,
  });
  await CompanyProjectMember.create({
    ...orgScope(req),
    projectId: project._id,
    userId: req.user._id,
    role: 'manager',
  });
  await audit(req, 'project.created', 'project', project._id, { name });

  sendData(req, res, serializeProject(project, 'manager'), 201);
};

export const getProject = async (req, res) => {
  const { project, role } = await loadProject(req, req.params.projectId);
  await project.populate('ownerId', 'name');
  const counts = await taskCounts([project._id]);
  sendData(req, res, serializeProject(project, role, counts.get(String(project._id))));
};

export const updateProject = async (req, res) => {
  const access = await loadProject(req, req.params.projectId);
  requireManager(access);
  const { project } = access;
  const previousStatus = project.status;

  if (has(req.body, 'name')) project.name = requiredText(req.body.name, 'שם הפרויקט');
  if (has(req.body, 'description')) project.description = text(req.body.description);
  if (has(req.body, 'status')) {
    project.status = oneOf(req.body.status, PROJECT_STATUSES, 'סטטוס');
    if (project.status === 'completed' && previousStatus !== 'completed') {
      const openCritical = await CompanyTask.countDocuments({
        projectId: project._id,
        priority: 'urgent',
        status: OPEN_TASK_FILTER,
      });
      if (openCritical > 0) {
        throw new ApiError(409, 'OPEN_CRITICAL_TASKS', `יש ${openCritical} משימות דחופות פתוחות. יש לסגור אותן לפני סיום הפרויקט`);
      }
    }
  }
  await project.save();

  if (project.status !== previousStatus) {
    await audit(req, 'project.status_changed', 'project', project._id, {
      name: project.name,
      before: previousStatus,
      after: project.status,
    });
  }

  sendData(req, res, serializeProject(project, access.role));
};

// ── Project members ──

const managerCount = (projectId) => CompanyProjectMember.countDocuments({ projectId, role: 'manager' });

const serializeProjectMember = (member) => ({
  id: member._id,
  user_id: member.userId?._id ?? member.userId,
  name: member.userId?.name ?? null,
  email: member.userId?.email ?? null,
  role: member.role,
});

export const listProjectMembers = async (req, res) => {
  const { project } = await loadProject(req, req.params.projectId);
  const members = await CompanyProjectMember.find({ projectId: project._id })
    .populate('userId', 'name email')
    .sort({ createdAt: 1 });
  sendData(req, res, members.filter((m) => m.userId).map(serializeProjectMember));
};

const assertRoleAllowedFor = (orgRole, projectRole) => {
  if (orgRole === 'guest' && projectRole !== 'viewer') {
    throw denied('אורח יכול להיות בפרויקט בצפייה בלבד');
  }
};

export const addProjectMember = async (req, res) => {
  const access = await loadProject(req, req.params.projectId);
  requireManager(access);
  const { user_id: userId, role } = req.body;
  oneOf(role, PROJECT_ROLES, 'תפקיד');
  if (!isObjectId(userId)) throw invalid('משתמש לא תקין');

  const orgMember = await CompanyMember.findOne({ ...orgScope(req), userId, status: 'active' });
  if (!orgMember) throw invalid('המשתמש אינו חבר פעיל בארגון');
  assertRoleAllowedFor(orgMember.role, role);

  if (await CompanyProjectMember.exists({ projectId: access.project._id, userId })) {
    throw new ApiError(409, 'ALREADY_MEMBER', 'המשתמש כבר חבר בפרויקט');
  }
  const member = await CompanyProjectMember.create({
    ...orgScope(req),
    projectId: access.project._id,
    userId,
    role,
  });
  await audit(req, 'project.member_added', 'project', access.project._id, { user_id: String(userId), role });

  await member.populate('userId', 'name email');
  sendData(req, res, serializeProjectMember(member), 201);
};

const loadProjectMember = async (project, memberId) => {
  const missing = notFound('החבר לא נמצא');
  if (!isObjectId(memberId)) throw missing;
  const member = await CompanyProjectMember.findOne({ _id: memberId, projectId: project._id });
  if (!member) throw missing;
  return member;
};

export const updateProjectMember = async (req, res) => {
  const access = await loadProject(req, req.params.projectId);
  requireManager(access);
  const role = oneOf(req.body.role, PROJECT_ROLES, 'תפקיד');
  const member = await loadProjectMember(access.project, req.params.memberId);

  const orgMember = await CompanyMember.findOne({ ...orgScope(req), userId: member.userId });
  if (orgMember) assertRoleAllowedFor(orgMember.role, role);

  const before = member.role;
  if (before === 'manager' && role !== 'manager' && (await managerCount(access.project._id)) === 1) {
    throw new ApiError(409, 'LAST_MANAGER', 'חייב להישאר מנהל אחד לפחות בפרויקט');
  }
  member.role = role;
  await member.save();
  await audit(req, 'project.member_updated', 'project', access.project._id, {
    user_id: String(member.userId),
    before,
    after: role,
  });

  await member.populate('userId', 'name email');
  sendData(req, res, serializeProjectMember(member));
};

export const removeProjectMember = async (req, res) => {
  const access = await loadProject(req, req.params.projectId);
  requireManager(access);
  const member = await loadProjectMember(access.project, req.params.memberId);

  if (member.role === 'manager' && (await managerCount(access.project._id)) === 1) {
    throw new ApiError(409, 'LAST_MANAGER', 'חייב להישאר מנהל אחד לפחות בפרויקט');
  }
  await member.deleteOne();
  // Their open work must not stay assigned to someone who can no longer see it.
  const released = await CompanyTask.updateMany(
    { projectId: access.project._id, assigneeId: member.userId, status: OPEN_TASK_FILTER },
    { $set: { assigneeId: null }, $inc: { version: 1 } }
  );
  await audit(req, 'project.member_removed', 'project', access.project._id, {
    user_id: String(member.userId),
    tasks_unassigned: released.modifiedCount,
  });

  sendData(req, res, { id: member._id });
};

// ── Tasks ──

const loadTask = async (req, taskId) => {
  const missing = notFound('המשימה לא נמצאה');
  if (!isObjectId(taskId)) throw missing;
  const task = await CompanyTask.findOne({ _id: taskId, ...orgScope(req) });
  if (!task) throw missing;

  try {
    const access = await loadProject(req, task.projectId);
    return { task, access };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw missing;
    throw error;
  }
};

export const listTasks = async (req, res) => {
  const { limit, idFilter } = pageOf(req.query);
  const filter = orgScope(req);

  // Access is part of the query, so counts and pages never reflect hidden tasks.
  const accessible = await accessibleProjectIds(req);
  if (req.query.project_id) {
    await loadProject(req, req.query.project_id);
    filter.projectId = req.query.project_id;
  } else if (accessible) {
    filter.projectId = { $in: accessible };
  }

  if (req.query.assignee === 'me') filter.assigneeId = req.user._id;
  if (req.query.status) filter.status = oneOf(req.query.status, TASK_STATUSES, 'סטטוס');
  else if (req.query.open === 'true') filter.status = OPEN_TASK_FILTER;
  if (idFilter) filter._id = idFilter;

  const rows = await populateTask(CompanyTask.find(filter).sort({ _id: -1 }).limit(limit + 1));
  const page = rows.slice(0, limit);

  const viewerProjects = new Set(
    (
      await CompanyProjectMember.find({
        userId: req.user._id,
        projectId: { $in: page.map((task) => task.projectId?._id ?? task.projectId) },
        role: 'viewer',
      })
    ).map((member) => String(member.projectId))
  );
  const isOwner = req.membership.role === 'owner';
  const canWrite = (task) => isOwner || !viewerProjects.has(String(task.projectId?._id ?? task.projectId));

  sendData(req, res, await serializeTasks(page, canWrite), 200, {
    next_cursor: rows.length > limit ? page[page.length - 1]._id : null,
  });
};

const applyCommonTaskFields = (body, target) => {
  if (has(body, 'description')) target.description = text(body.description);
  if (has(body, 'priority')) target.priority = oneOf(body.priority, TASK_PRIORITIES, 'עדיפות');
  if (has(body, 'type')) target.type = oneOf(body.type, TASK_TYPES, 'סוג');
  if (has(body, 'severity')) {
    target.severity = body.severity === null || body.severity === '' ? null : oneOf(body.severity, SEVERITIES, 'חומרה');
  }
  if (has(body, 'resolution')) target.resolution = text(body.resolution);
  if (has(body, 'due_at')) target.dueAt = parseDate(body.due_at);
  if (has(body, 'labels')) {
    if (!Array.isArray(body.labels)) throw invalid('תגיות לא תקינות');
    target.labels = body.labels.map(text).filter(Boolean);
  }
};

export const createTask = async (req, res) => {
  const access = await loadProject(req, req.body.project_id);
  requireWrite(access);

  const fields = {};
  applyCommonTaskFields(req.body, fields);
  if (has(req.body, 'status')) fields.status = oneOf(req.body.status, TASK_STATUSES, 'סטטוס');
  if (fields.status === 'done') throw invalid('משימה חדשה לא יכולה להיווצר כמשימה שהושלמה');
  if (req.body.assignee_id) {
    await assertAssignable(req, access.project, req.body.assignee_id);
    fields.assigneeId = req.body.assignee_id;
  }

  const task = await CompanyTask.create({
    ...orgScope(req),
    ...fields,
    projectId: access.project._id,
    title: requiredText(req.body.title, 'כותרת'),
    createdBy: req.user._id,
  });
  await audit(req, 'task.created', 'task', task._id, { title: task.title, project_id: String(access.project._id) });

  const loaded = await populateTask(CompanyTask.findById(task._id));
  const [serialized] = await serializeTasks([loaded], () => true);
  sendData(req, res, serialized, 201);
};

export const getTask = async (req, res) => {
  const { task, access } = await loadTask(req, req.params.taskId);
  const loaded = await populateTask(CompanyTask.findById(task._id));
  const [serialized] = await serializeTasks([loaded], () => access.role !== 'viewer');
  sendData(req, res, serialized);
};

const assertNoDependencyCycle = async (task, blockerIds) => {
  const all = await CompanyTask.find({ projectId: task.projectId }).select('blockedBy');
  const graph = new Map(all.map((row) => [String(row._id), row.blockedBy.map(String)]));
  graph.set(String(task._id), blockerIds);

  const target = String(task._id);
  const seen = new Set();
  const stack = [...blockerIds];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === target) throw invalid('התלות יוצרת מעגל בין משימות');
    if (!seen.has(current)) {
      seen.add(current);
      stack.push(...(graph.get(current) || []));
    }
  }
};

export const updateTask = async (req, res) => {
  const { task, access } = await loadTask(req, req.params.taskId);
  requireWrite(access);
  const { body } = req;

  if (!Number.isInteger(body.version)) throw invalid('חסר מספר גרסה');

  const updates = {};
  applyCommonTaskFields(body, updates);
  if (has(body, 'title')) updates.title = requiredText(body.title, 'כותרת');
  if (has(body, 'status')) updates.status = oneOf(body.status, TASK_STATUSES, 'סטטוס');
  if (has(body, 'assignee_id')) {
    // Only a change is validated, so old tasks stay editable after their assignee left.
    if (body.assignee_id && body.assignee_id !== String(task.assigneeId)) {
      await assertAssignable(req, access.project, body.assignee_id);
    }
    updates.assigneeId = body.assignee_id || null;
  }
  if (has(body, 'blocked_by')) {
    const blockerIds = parseIdList(body.blocked_by, 'תלויות');
    if (blockerIds.includes(String(task._id))) throw invalid('משימה לא יכולה לחסום את עצמה');
    const sameProject = await CompanyTask.countDocuments({ _id: { $in: blockerIds }, projectId: task.projectId });
    if (sameProject !== blockerIds.length) throw invalid('תלות חייבת להיות במשימה מאותו פרויקט');
    await assertNoDependencyCycle(task, blockerIds);
    updates.blockedBy = blockerIds;
  }

  const finalStatus = updates.status ?? task.status;
  if (finalStatus === 'done') {
    const blockers = updates.blockedBy ?? task.blockedBy;
    if (await CompanyTask.exists({ _id: { $in: blockers }, status: OPEN_TASK_FILTER })) {
      throw new ApiError(409, 'BLOCKED_BY_OPEN_TASKS', 'יש משימות חוסמות פתוחות. יש לסגור אותן קודם');
    }
    const type = updates.type ?? task.type;
    const severity = has(updates, 'severity') ? updates.severity : task.severity;
    const resolution = updates.resolution ?? task.resolution;
    if (type === 'bug' && SEVERE.includes(severity) && !resolution) {
      throw new ApiError(409, 'RESOLUTION_REQUIRED', 'באג חמור לא נסגר בלי תיעוד הפתרון');
    }
  }

  // Compare-and-set on version: a stale edit is refused instead of overwriting.
  const updated = await CompanyTask.findOneAndUpdate(
    { _id: task._id, version: body.version },
    { $set: updates, $inc: { version: 1 } },
    { new: true, runValidators: true }
  );
  if (!updated) {
    const current = await populateTask(CompanyTask.findById(task._id));
    const [serialized] = await serializeTasks([current], () => true);
    throw new ApiError(409, 'VERSION_CONFLICT', 'המשימה עודכנה בינתיים על ידי מישהו אחר', serialized);
  }

  const tracked = {};
  const track = (label, before, after) => {
    if (String(before ?? '') !== String(after ?? '')) tracked[label] = { before: before ?? null, after: after ?? null };
  };
  track('status', task.status, updated.status);
  track('assignee', task.assigneeId, updated.assigneeId);
  track('due_at', task.dueAt?.toISOString(), updated.dueAt?.toISOString());
  if (Object.keys(tracked).length > 0) {
    await audit(req, 'task.updated', 'task', task._id, { title: updated.title, changes: tracked });
  }

  const loaded = await populateTask(CompanyTask.findById(task._id));
  const [serialized] = await serializeTasks([loaded], () => true);
  sendData(req, res, serialized);
};

// ── Requirements ──

const validProjectTaskIds = async (project, ids) => {
  const list = parseIdList(ids, 'משימות');
  const found = await CompanyTask.countDocuments({ _id: { $in: list }, projectId: project._id });
  if (found !== list.length) throw invalid('כל המשימות חייבות להיות מאותו פרויקט');
  return list;
};

const serializeRequirement = (requirement, tests) => ({
  id: requirement._id,
  title: requirement.title,
  description: requirement.description,
  priority: requirement.priority,
  status: requirement.status,
  revision: requirement.revision,
  task_ids: requirement.taskIds,
  test_count: tests.length,
  has_tests: tests.length > 0,
  passing_tests: tests.filter((test) => test.result === 'pass').length,
});

export const listRequirements = async (req, res) => {
  const { project } = await loadProject(req, req.params.projectId);
  const requirements = await CompanyRequirement.find({ projectId: project._id }).sort({ _id: 1 });
  const tests = await CompanyTestCase.find({ projectId: project._id, requirementId: { $ne: null } });
  const testsFor = (id) => tests.filter((test) => test.requirementId.equals(id));

  sendData(req, res, requirements.map((item) => serializeRequirement(item, testsFor(item._id))));
};

export const createRequirement = async (req, res) => {
  const access = await loadProject(req, req.params.projectId);
  requireWrite(access);
  const requirement = await CompanyRequirement.create({
    ...orgScope(req),
    projectId: access.project._id,
    title: requiredText(req.body.title, 'כותרת'),
    description: text(req.body.description),
    priority: has(req.body, 'priority') ? oneOf(req.body.priority, TASK_PRIORITIES, 'עדיפות') : 'medium',
    taskIds: has(req.body, 'task_ids') ? await validProjectTaskIds(access.project, req.body.task_ids) : [],
    createdBy: req.user._id,
  });
  await audit(req, 'requirement.created', 'requirement', requirement._id, { title: requirement.title });
  sendData(req, res, serializeRequirement(requirement, []), 201);
};

const loadInProject = async (Model, project, id, message) => {
  const missing = notFound(message);
  if (!isObjectId(id)) throw missing;
  const record = await Model.findOne({ _id: id, projectId: project._id });
  if (!record) throw missing;
  return record;
};

export const updateRequirement = async (req, res) => {
  const access = await loadProject(req, req.params.projectId);
  requireWrite(access);
  const requirement = await loadInProject(CompanyRequirement, access.project, req.params.requirementId, 'הדרישה לא נמצאה');
  const { body } = req;
  const before = { title: requirement.title, description: requirement.description };

  if (has(body, 'title')) requirement.title = requiredText(body.title, 'כותרת');
  if (has(body, 'description')) requirement.description = text(body.description);
  if (has(body, 'priority')) requirement.priority = oneOf(body.priority, TASK_PRIORITIES, 'עדיפות');
  if (has(body, 'status')) requirement.status = oneOf(body.status, REQUIREMENT_STATUSES, 'סטטוס');
  if (has(body, 'task_ids')) requirement.taskIds = await validProjectTaskIds(access.project, body.task_ids);
  if (requirement.title !== before.title || requirement.description !== before.description) {
    requirement.revision += 1;
  }
  await requirement.save();

  const tests = await CompanyTestCase.find({ requirementId: requirement._id });
  sendData(req, res, serializeRequirement(requirement, tests));
};

// ── Test cases ──

const serializeTest = (test) => ({
  id: test._id,
  title: test.title,
  steps: test.steps,
  expected: test.expected,
  actual: test.actual,
  result: test.result,
  requirement_id: test.requirementId,
  task_id: test.taskId,
});

export const listTests = async (req, res) => {
  const { project } = await loadProject(req, req.params.projectId);
  const tests = await CompanyTestCase.find({ projectId: project._id }).sort({ _id: 1 });
  sendData(req, res, tests.map(serializeTest));
};

export const createTest = async (req, res) => {
  const access = await loadProject(req, req.params.projectId);
  requireWrite(access);
  const { body } = req;

  const links = {};
  if (body.requirement_id) {
    links.requirementId = (await loadInProject(CompanyRequirement, access.project, body.requirement_id, 'הדרישה לא נמצאה'))._id;
  }
  if (body.task_id) {
    links.taskId = (await loadInProject(CompanyTask, access.project, body.task_id, 'המשימה לא נמצאה'))._id;
  }

  const test = await CompanyTestCase.create({
    ...orgScope(req),
    ...links,
    projectId: access.project._id,
    title: requiredText(body.title, 'כותרת'),
    steps: text(body.steps),
    expected: text(body.expected),
    createdBy: req.user._id,
  });
  await audit(req, 'test.created', 'test', test._id, { title: test.title });
  sendData(req, res, serializeTest(test), 201);
};

export const updateTest = async (req, res) => {
  const access = await loadProject(req, req.params.projectId);
  requireWrite(access);
  const test = await loadInProject(CompanyTestCase, access.project, req.params.testId, 'הבדיקה לא נמצאה');
  const { body } = req;
  const previousResult = test.result;

  if (has(body, 'title')) test.title = requiredText(body.title, 'כותרת');
  if (has(body, 'steps')) test.steps = text(body.steps);
  if (has(body, 'expected')) test.expected = text(body.expected);
  if (has(body, 'actual')) test.actual = text(body.actual);
  if (has(body, 'result')) test.result = oneOf(body.result, TEST_RESULTS, 'תוצאה');
  await test.save();

  let reopenedTaskId = null;
  if (test.result === 'fail' && previousResult !== 'fail' && test.taskId) {
    // A failed test sends finished work back for review (FR-DEV-07).
    const reopened = await CompanyTask.findOneAndUpdate(
      { _id: test.taskId, status: 'done' },
      { $set: { status: 'in_review' }, $inc: { version: 1 } },
      { new: true }
    );
    reopenedTaskId = reopened?._id ?? null;
  }
  if (test.result !== previousResult) {
    await audit(req, 'test.result_recorded', 'test', test._id, {
      title: test.title,
      before: previousResult,
      after: test.result,
      reopened_task: reopenedTaskId ? String(reopenedTaskId) : null,
    });
  }

  sendData(req, res, { ...serializeTest(test), reopened_task_id: reopenedTaskId });
};
