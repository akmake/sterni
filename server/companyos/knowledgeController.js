import fs from 'fs';
import { ApiError, isObjectId, recordAudit, sendData } from './access.js';
import { accessibleFilter } from './chatController.js';
import { accountVisibility, dealVisibility, leadVisibility } from './crmAccess.js';
import {
  CompanyConversation, CompanyFile, CompanyMember, CompanyMessage, CompanyProject, CompanyProjectMember, CompanyTask,
} from './models.js';
import {
  CompanyAccount, CompanyApproval, CompanyDeal, CompanyDocument, CompanyDocumentLink,
  CompanyDocumentRevision, CompanyLead, DOCUMENT_TYPES,
} from './knowledgeCrmModels.js';

const scope = (req) => ({ organizationId: req.organization._id });
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const invalid = (message) => new ApiError(400, 'VALIDATION_ERROR', message);
const missing = () => new ApiError(404, 'NOT_FOUND', 'המסמך לא נמצא');
const denied = (message = 'אין הרשאה לפעולה זו') => new ApiError(403, 'ACCESS_DENIED', message);
const conflict = (code, message) => new ApiError(409, code, message);
const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);
const regex = (value) => new RegExp(String(value).replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&'), 'i');

const MANAGERS = ['owner', 'admin', 'manager'];
const LINKABLE = ['project', 'task', 'deal', 'lead', 'account'];
const MAX_SEARCH_TEXT = 20000;

const audit = (req, action, resourceId, metadata) =>
  recordAudit(req, { organizationId: req.organization._id, action, resourceType: 'document', resourceId, metadata });

const NOT_EXPIRED = () => ({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });

const accessibleProjects = (req) =>
  CompanyProjectMember.find({ ...scope(req), userId: req.user._id, ...NOT_EXPIRED() }).distinct('projectId');

// Everything that decides who can see a document, as one query (spec 27.3: pre-filter).
const documentAccess = async (req) => {
  const uid = req.user._id;
  const isOwnerRole = req.membership.role === 'owner';
  const clauses = [];
  if (!isOwnerRole) {
    const projects = await accessibleProjects(req);
    clauses.push({
      $or: [
        { projectId: { $in: projects } },
        { ownerId: uid },
        { allowedUserIds: uid },
        ...(req.membership.role === 'guest' ? [] : [{ projectId: null }]),
      ],
    });
  }
  // Restricted means named people only; an organization role doesn't open it (spec 27.2).
  clauses.push({ $or: [{ visibility: { $ne: 'restricted' } }, { ownerId: uid }, { allowedUserIds: uid }] });
  // Drafts belong to the people working on them; everyone else reads what was published.
  if (!MANAGERS.includes(req.membership.role)) {
    clauses.push({ $or: [{ publishedRevisionId: { $ne: null } }, { ownerId: uid }, { allowedUserIds: uid }] });
  }
  return { $and: clauses };
};

const loadDocument = async (req, id) => {
  if (!isObjectId(id)) throw missing();
  const document = await CompanyDocument.findOne({ _id: id, ...scope(req), ...(await documentAccess(req)) });
  if (!document) throw missing();
  return document;
};

const permissions = (req, document) => {
  const elevated = ['owner', 'admin'].includes(req.membership.role);
  return {
    edit: elevated || document.ownerId.equals(req.user._id),
    approve: MANAGERS.includes(req.membership.role),
    publish: elevated,
  };
};

const canReadDrafts = (req, document) =>
  MANAGERS.includes(req.membership.role) ||
  document.ownerId.equals(req.user._id) ||
  document.allowedUserIds.some((id) => id.equals(req.user._id));

const serializeDocument = async (req, document) => {
  const revision = document.currentRevisionId
    ? await CompanyDocumentRevision.findById(document.currentRevisionId).select('revisionNo')
    : null;
  const project = document.projectId ? await CompanyProject.findById(document.projectId).select('name') : null;
  return {
    id: document._id, title: document.title, summary: document.summary, status: document.status,
    type: document.type, tags: document.tags, visibility: document.visibility,
    allowed_user_ids: document.allowedUserIds, parent_id: document.parentId, is_template: document.isTemplate,
    decision: document.decision ?? null, archived: Boolean(document.archivedAt), project_id: document.projectId,
    project_name: project?.name, current_revision: revision?.revisionNo || 1, owner_name: null,
    permissions: permissions(req, document), updated_at: document.updatedAt,
  };
};

const serializeRevision = (revision) => ({
  id: revision._id, revision_no: revision.revisionNo, title: revision.title, content: revision.content,
  status: revision.status, created_by_name: revision.createdBy?.name, created_at: revision.createdAt,
});

export const serializeApproval = (req, approval) => ({
  id: approval._id, resource_type: approval.resourceType, resource_id: approval.resourceId,
  revision_id: approval.revisionId, status: approval.status, assignee_name: approval.assigneeId?.name,
  reason: approval.reason,
  can_decide: approval.status === 'pending' && String(approval.assigneeId?._id || approval.assigneeId) === String(req.user._id),
  decided_at: approval.decidedAt,
});

const documentSearchText = (title, summary, content) => `${title}\n${summary}\n${content}`.slice(0, MAX_SEARCH_TEXT);

const parseDocumentFields = async (req, body, projectId) => {
  const fields = {};
  if (has(body, 'type')) {
    if (!DOCUMENT_TYPES.includes(body.type)) throw invalid('סוג מסמך לא תקין');
    fields.type = body.type;
  }
  if (Array.isArray(body.tags)) fields.tags = [...new Set(body.tags.map(clean).filter(Boolean))].slice(0, 30);
  if (has(body, 'visibility')) {
    if (!['organization', 'restricted'].includes(body.visibility)) throw invalid('הרשאת צפייה לא תקינה');
    fields.visibility = body.visibility;
  }
  if (Array.isArray(body.allowed_user_ids)) {
    const ids = [...new Set(body.allowed_user_ids.map(String))];
    if (ids.some((id) => !isObjectId(id))) throw invalid('משתמש לא תקין');
    const active = await CompanyMember.countDocuments({ ...scope(req), userId: { $in: ids }, status: 'active' });
    if (active !== ids.length) throw invalid('אחד המשתמשים אינו חבר פעיל בארגון');
    fields.allowedUserIds = ids;
  }
  if (has(body, 'parent_id')) {
    if (!body.parent_id) fields.parentId = null;
    else {
      if (!isObjectId(body.parent_id)) throw invalid('מסמך אב לא תקין');
      const parent = await CompanyDocument.findOne({ _id: body.parent_id, ...scope(req), projectId: projectId ?? null });
      if (!parent) throw invalid('מסמך האב לא נמצא');
      fields.parentId = parent._id;
    }
  }
  if (has(body, 'is_template')) fields.isTemplate = Boolean(body.is_template);
  if (body.decision && typeof body.decision === 'object') {
    fields.decision = {
      context: clean(body.decision.context),
      decision: clean(body.decision.decision),
      owner_name: clean(body.decision.owner_name),
      decided_at: clean(body.decision.decided_at),
      alternatives: clean(body.decision.alternatives),
      valid_until: clean(body.decision.valid_until),
    };
  }
  return fields;
};

export const listDocuments = async (req, res) => {
  const filter = { ...scope(req), ...(await documentAccess(req)) };
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  if (status) filter.status = status;
  if (typeof req.query.type === 'string') filter.type = req.query.type;
  if (typeof req.query.tag === 'string') filter.tags = req.query.tag;
  filter.isTemplate = req.query.templates === 'true' ? true : { $ne: true };
  filter.archivedAt = req.query.archived === 'true' ? { $ne: null } : null;
  if (req.query.project_id) {
    if (!isObjectId(req.query.project_id)) return sendData(req, res, []);
    filter.projectId = req.query.project_id;
  }
  if (typeof req.query.linked_type === 'string' && isObjectId(req.query.linked_id)) {
    const links = await CompanyDocumentLink.find({
      ...scope(req), resourceType: req.query.linked_type, resourceId: req.query.linked_id,
    }).distinct('documentId');
    filter._id = { $in: links };
  }
  const documents = await CompanyDocument.find(filter).sort({ updatedAt: -1 }).limit(200);
  sendData(req, res, await Promise.all(documents.map((item) => serializeDocument(req, item))));
};

export const createDocument = async (req, res) => {
  const title = clean(req.body.title);
  if (!title) throw invalid('כותרת המסמך היא שדה חובה');
  const projectId = req.body.project_id || null;
  if (projectId) {
    const reachable = req.membership.role === 'owner' ||
      (isObjectId(projectId) && (await accessibleProjects(req)).some((id) => String(id) === String(projectId)));
    if (!reachable) throw denied('אין גישה לפרויקט');
  }

  let content = clean(req.body.content);
  let type = req.body.type;
  if (req.body.template_id) {
    const template = await loadDocument(req, req.body.template_id);
    if (!template.isTemplate) throw invalid('המסמך שנבחר אינו תבנית');
    const source = await CompanyDocumentRevision.findById(template.currentRevisionId);
    content = content || source?.content || '';
    type = type || template.type;
  }

  const summary = clean(req.body.summary).slice(0, 2000);
  const fields = await parseDocumentFields(req, { ...req.body, type: type ?? 'other' }, projectId);
  const document = await CompanyDocument.create({
    ...scope(req), projectId, title, summary, ownerId: req.user._id, ...fields,
    searchText: documentSearchText(title, summary, content),
  });
  const revision = await CompanyDocumentRevision.create({
    ...scope(req), documentId: document._id, revisionNo: 1, title, content, createdBy: req.user._id,
  });
  document.currentRevisionId = revision._id;
  await document.save();
  await audit(req, 'document.created', document._id, { revision: 1 });
  sendData(req, res, await serializeDocument(req, document), 201);
};

export const updateDocument = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).edit) throw denied('אין הרשאת עריכה');
  Object.assign(document, await parseDocumentFields(req, req.body, document.projectId));
  if (document.parentId && document.parentId.equals(document._id)) throw invalid('מסמך לא יכול להיות אב של עצמו');
  await document.save();
  await audit(req, 'document.updated', document._id, { visibility: document.visibility });
  sendData(req, res, await serializeDocument(req, document));
};

export const getDocument = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  const readsDrafts = canReadDrafts(req, document);
  const revisionFilter = { ...scope(req), documentId: document._id };
  if (!readsDrafts) revisionFilter._id = document.publishedRevisionId;

  const [revisions, approvals, links, files, children] = await Promise.all([
    CompanyDocumentRevision.find(revisionFilter).populate('createdBy', 'name').sort({ revisionNo: -1 }),
    readsDrafts
      ? CompanyApproval.find({ ...scope(req), resourceType: 'document', resourceId: document._id })
        .populate('assigneeId', 'name').sort({ createdAt: -1 })
      : [],
    CompanyDocumentLink.find({ ...scope(req), documentId: document._id }),
    CompanyFile.find({ ...scope(req), documentId: document._id }).sort({ _id: 1 }),
    CompanyDocument.find({ ...scope(req), parentId: document._id, ...(await documentAccess(req)) }).select('title'),
  ]);
  const shownId = readsDrafts ? document.currentRevisionId : document.publishedRevisionId;
  const current = revisions.find((item) => item._id.equals(shownId)) || revisions[0];

  sendData(req, res, {
    document: await serializeDocument(req, document),
    current_revision: serializeRevision(current),
    revisions: revisions.map(serializeRevision),
    approvals: approvals.map((item) => serializeApproval(req, item)),
    links: links.map((link) => ({ id: link._id, resource_type: link.resourceType, resource_id: link.resourceId })),
    files: files.map((file) => ({ id: file._id, name: file.name, mime: file.mime, size: file.size })),
    children: children.map((child) => ({ id: child._id, title: child.title })),
  });
};

const voidOpenWork = async (req, document) => {
  await CompanyApproval.updateMany(
    { ...scope(req), resourceType: 'document', resourceId: document._id, status: 'pending' },
    { $set: { status: 'superseded', reason: 'נוצרה גרסה חדשה' } }
  );
  await CompanyDocumentRevision.updateMany(
    { ...scope(req), documentId: document._id, status: { $in: ['draft', 'in_review'] } },
    { $set: { status: 'superseded' } }
  );
};

const addRevision = async (req, document, title, content) => {
  await voidOpenWork(req, document);
  const latest = await CompanyDocumentRevision.findOne({ ...scope(req), documentId: document._id }).sort({ revisionNo: -1 });
  const revision = await CompanyDocumentRevision.create({
    ...scope(req), documentId: document._id, revisionNo: (latest?.revisionNo || 0) + 1, title, content, createdBy: req.user._id,
  });
  document.title = title;
  document.currentRevisionId = revision._id;
  document.status = 'draft';
  document.searchText = documentSearchText(title, document.summary, content);
  await document.save();
  return revision;
};

export const createRevision = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).edit) throw denied('אין הרשאת עריכה');
  if (document.archivedAt) throw conflict('INVALID_STATE', 'המסמך בארכיון');
  const title = clean(req.body.title);
  if (!title) throw invalid('כותרת היא שדה חובה');
  if (has(req.body, 'summary')) document.summary = clean(req.body.summary).slice(0, 2000);
  const revision = await addRevision(req, document, title, clean(req.body.content));
  await audit(req, 'document.revision_created', document._id, { revision: revision.revisionNo });
  sendData(req, res, serializeRevision(revision), 201);
};

// Restoring never rewrites history: the old text comes back as a new revision (spec 26.1).
export const restoreRevision = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).edit) throw denied('אין הרשאת עריכה');
  if (!isObjectId(req.body.revision_id)) throw invalid('גרסה לא תקינה');
  const source = await CompanyDocumentRevision.findOne({ _id: req.body.revision_id, documentId: document._id });
  if (!source) throw invalid('הגרסה לא נמצאה');
  const revision = await addRevision(req, document, source.title, source.content);
  await audit(req, 'document.restored', document._id, { from: source.revisionNo, revision: revision.revisionNo });
  sendData(req, res, serializeRevision(revision), 201);
};

const chooseApprover = async (req) => {
  const preferred = await CompanyMember.findOne({
    ...scope(req), status: 'active', role: { $in: MANAGERS }, userId: { $ne: req.user._id },
  }).sort({ role: 1 });
  if (preferred) return preferred.userId;
  if (['owner', 'admin'].includes(req.membership.role)) return req.user._id;
  throw conflict('APPROVER_REQUIRED', 'לא נמצא מאשר פעיל בארגון');
};

export const submitDocument = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).edit) throw denied('אין הרשאת עריכה');
  const assigneeId = await chooseApprover(req);
  const revision = await CompanyDocumentRevision.findOneAndUpdate(
    { _id: document.currentRevisionId, status: 'draft' },
    { $set: { status: 'in_review' } },
    { new: true }
  );
  if (!revision) throw conflict('INVALID_STATE', 'רק טיוטה עדכנית ניתנת לשליחה');

  const approval = await CompanyApproval.create({
    ...scope(req), resourceType: 'document', resourceId: document._id, revisionId: revision._id,
    assigneeId, requestedBy: req.user._id,
  });
  document.status = 'in_review';
  // The reviewer has to be able to open what they were asked to approve.
  if (document.visibility === 'restricted' && !document.allowedUserIds.some((id) => id.equals(assigneeId))) {
    document.allowedUserIds.push(assigneeId);
  }
  await document.save();

  const { notify } = await import('./chatController.js');
  await notify(req.organization._id, assigneeId, {
    type: 'approval_requested',
    title: `מסמך ממתין לאישור: ${document.title}`,
    resourceType: 'document',
    resourceId: String(document._id),
  });
  await approval.populate('assigneeId', 'name');
  await audit(req, 'document.submitted', document._id, { revision: revision.revisionNo });
  sendData(req, res, serializeApproval(req, approval), 201);
};

export const publishDocument = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).publish) throw denied('אין הרשאת פרסום');
  const revision = await CompanyDocumentRevision.findOneAndUpdate(
    { _id: document.currentRevisionId, status: 'approved' },
    { $set: { status: 'published' } },
    { new: true }
  );
  if (!revision) throw conflict('APPROVAL_REQUIRED', 'נדרש אישור לגרסה העדכנית');
  document.status = 'published';
  document.publishedRevisionId = revision._id;
  await document.save();
  await audit(req, 'document.published', document._id, { revision: revision.revisionNo });
  sendData(req, res, await serializeDocument(req, document));
};

export const setArchived = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).edit) throw denied('אין הרשאת עריכה');
  const archived = req.body.archived !== false;
  document.archivedAt = archived ? new Date() : null;
  await document.save();
  await audit(req, archived ? 'document.archived' : 'document.unarchived', document._id);
  sendData(req, res, await serializeDocument(req, document));
};

const linkTargetExists = async (req, type, id) => {
  if (type === 'project') {
    if (req.membership.role === 'owner') return CompanyProject.exists({ _id: id, ...scope(req) });
    return (await accessibleProjects(req)).some((projectId) => String(projectId) === String(id));
  }
  if (type === 'task') {
    const task = await CompanyTask.findOne({ _id: id, ...scope(req) }).select('projectId');
    return Boolean(task) && linkTargetExists(req, 'project', task.projectId);
  }
  if (type === 'deal') return CompanyDeal.exists({ _id: id, ...scope(req), ...dealVisibility(req) });
  if (type === 'lead') return CompanyLead.exists({ _id: id, ...scope(req), ...leadVisibility(req) });
  return CompanyAccount.exists({ _id: id, ...scope(req), ...accountVisibility(req) });
};

export const addLink = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).edit) throw denied('אין הרשאת עריכה');
  const { resource_type: type, resource_id: id } = req.body;
  if (!LINKABLE.includes(type) || !isObjectId(id)) throw invalid('קישור לא תקין');
  if (!(await linkTargetExists(req, type, id))) throw invalid('הרשומה לא נמצאה');
  const link = await CompanyDocumentLink.findOneAndUpdate(
    { documentId: document._id, resourceType: type, resourceId: id },
    { $setOnInsert: { ...scope(req), createdBy: req.user._id } },
    { upsert: true, new: true }
  );
  sendData(req, res, { id: link._id, resource_type: type, resource_id: id }, 201);
};

export const removeLink = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).edit) throw denied('אין הרשאת עריכה');
  await CompanyDocumentLink.deleteOne({ _id: req.params.linkId, documentId: document._id });
  sendData(req, res, { id: req.params.linkId });
};

export const uploadDocumentFile = async (req, res) => {
  if (!req.file) throw invalid('לא נבחר קובץ');
  try {
    const document = await loadDocument(req, req.params.documentId);
    if (!permissions(req, document).edit) throw denied('אין הרשאת עריכה');
    const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 200);
    const file = await CompanyFile.create({
      ...scope(req), documentId: document._id, uploadedBy: req.user._id, name,
      mime: req.file.mimetype, size: req.file.size, storedName: req.file.filename, attached: true,
    });
    sendData(req, res, { id: file._id, name, mime: file.mime, size: file.size }, 201);
  } catch (error) {
    fs.promises.unlink(req.file.path).catch(() => {});
    throw error;
  }
};

export const requireDocumentAccess = (req, documentId) => loadDocument(req, documentId);

// ── Global search ──

const result = (type, id, title, subtitle, snippet, updatedAt, extra = {}) => ({
  id, type, resource_id: id, title, subtitle, snippet, updated_at: updatedAt, ...extra,
});

const SNIPPET_RADIUS = 60;
const snippetAround = (text, term) => {
  const found = text.search(term);
  if (found < 0) return text.slice(0, 120);
  return text.slice(Math.max(found - SNIPPET_RADIUS, 0), found + SNIPPET_RADIUS);
};

export const search = async (req, res) => {
  const query = clean(req.query.q);
  if (query.length < 2) return sendData(req, res, [], 200, { total: 0, next_offset: null });
  const term = regex(query);
  const wanted = clean(req.query.type);
  const allow = (type) => !wanted || wanted === type;
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  // One extra per type tells whether another page exists.
  const perType = offset + limit + 1;
  const isGuest = req.membership.role === 'guest';
  const projectIds = req.membership.role === 'owner' ? null : await accessibleProjects(req);
  const results = [];

  if (allow('project')) {
    const filter = { ...scope(req), $or: [{ name: term }, { description: term }] };
    if (projectIds) filter._id = { $in: projectIds };
    const rows = await CompanyProject.find(filter).limit(perType);
    results.push(...rows.map((row) => result('project', row._id, row.name, 'פרויקט', row.description, row.updatedAt)));
  }
  if (allow('task')) {
    const filter = { ...scope(req), $or: [{ title: term }, { description: term }] };
    if (projectIds) filter.projectId = { $in: projectIds };
    const rows = await CompanyTask.find(filter).limit(perType);
    results.push(...rows.map((row) => result('task', row._id, row.title, 'משימה', row.description, row.updatedAt, { project_id: row.projectId })));
  }
  if (allow('document')) {
    const access = await documentAccess(req);
    const rows = await CompanyDocument.find({
      ...scope(req), archivedAt: null, isTemplate: { $ne: true },
      $and: [access, { $or: [{ title: term }, { summary: term }, { searchText: term }] }],
    }).limit(perType);
    results.push(...rows.map((row) => result('document', row._id, row.title, 'מסמך · ' + row.status, snippetAround(row.searchText || row.summary, term), row.updatedAt)));
  }
  if (!isGuest && allow('lead')) {
    const rows = await CompanyLead.find({
      ...scope(req), $and: [leadVisibility(req), { $or: [{ title: term }, { personName: term }, { companyName: term }, { email: term }] }],
    }).limit(perType);
    results.push(...rows.map((row) => result('lead', row._id, row.title, 'ליד · ' + row.status, row.companyName, row.updatedAt)));
  }
  if (!isGuest && allow('deal')) {
    const rows = await CompanyDeal.find({ ...scope(req), title: term, ...dealVisibility(req) }).limit(perType);
    results.push(...rows.map((row) => result('deal', row._id, row.title, 'עסקה · ' + row.status, '', row.updatedAt)));
  }
  if (!isGuest && allow('account')) {
    const rows = await CompanyAccount.find({ ...scope(req), name: term, ...accountVisibility(req) }).limit(perType);
    results.push(...rows.map((row) => result('account', row._id, row.name, 'לקוח', row.email, row.updatedAt)));
  }
  if (allow('message')) {
    // Current access only: a row left over from an old membership must not reopen history.
    const conversationIds = await CompanyConversation.find(await accessibleFilter(req)).distinct('_id');
    const rows = await CompanyMessage.find({
      ...scope(req), conversationId: { $in: conversationIds }, body: term, deletedAt: null,
    }).limit(perType);
    results.push(...rows.map((row) => result('message', row._id, row.body.slice(0, 80), 'הודעה', row.body, row.createdAt, { conversation_id: row.conversationId })));
  }

  results.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  const page = results.slice(offset, offset + limit);
  sendData(req, res, page, 200, {
    total: results.length,
    next_offset: results.length > offset + limit ? offset + limit : null,
  });
};
