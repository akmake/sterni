import { ApiError, isObjectId, recordAudit, sendData } from './access.js';
import {
  CompanyConversationMember, CompanyMember, CompanyMessage, CompanyProject,
  CompanyProjectMember, CompanyTask,
} from './models.js';
import {
  CompanyAccount, CompanyApproval, CompanyDeal, CompanyDocument,
  CompanyDocumentRevision, CompanyLead,
} from './knowledgeCrmModels.js';

const scope = (req) => ({ organizationId: req.organization._id });
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const invalid = (message) => new ApiError(400, 'VALIDATION_ERROR', message);
const missing = () => new ApiError(404, 'NOT_FOUND', 'המסמך לא נמצא');
const regex = (value) => new RegExp(String(value).replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&'), 'i');

const projectAccess = async (req, projectId) => {
  if (!projectId) return req.membership.role !== 'guest';
  if (req.membership.role === 'owner') return true;
  return CompanyProjectMember.exists({
    organizationId: req.organization._id, projectId, userId: req.user._id,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
};

const loadDocument = async (req, id) => {
  if (!isObjectId(id)) throw missing();
  const document = await CompanyDocument.findOne({ _id: id, ...scope(req) });
  if (!document || !(await projectAccess(req, document.projectId))) throw missing();
  return document;
};

const permissions = (req, document) => {
  const elevated = ['owner', 'admin'].includes(req.membership.role);
  return {
    edit: elevated || document.ownerId.equals(req.user._id),
    approve: ['owner', 'admin', 'manager'].includes(req.membership.role),
    publish: elevated,
  };
};

const serializeDocument = async (req, document) => {
  const revision = document.currentRevisionId
    ? await CompanyDocumentRevision.findById(document.currentRevisionId).select('revisionNo')
    : null;
  const project = document.projectId ? await CompanyProject.findById(document.projectId).select('name') : null;
  return {
    id: document._id, title: document.title, summary: document.summary, status: document.status,
    project_id: document.projectId, project_name: project?.name,
    current_revision: revision?.revisionNo || 1, owner_name: null,
    permissions: permissions(req, document), updated_at: document.updatedAt,
  };
};

const serializeRevision = (revision) => ({
  id: revision._id, revision_no: revision.revisionNo, title: revision.title,
  content: revision.content, status: revision.status,
  created_by_name: revision.createdBy?.name, created_at: revision.createdAt,
});

export const serializeApproval = (req, approval) => ({
  id: approval._id, resource_type: approval.resourceType, resource_id: approval.resourceId,
  revision_id: approval.revisionId, status: approval.status,
  assignee_name: approval.assigneeId?.name, reason: approval.reason,
  can_decide: approval.status === 'pending' &&
    String(approval.assigneeId?._id || approval.assigneeId) === String(req.user._id),
  decided_at: approval.decidedAt,
});

export const listDocuments = async (req, res) => {
  const filter = { ...scope(req) };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.project_id) {
    if (!isObjectId(req.query.project_id) || !(await projectAccess(req, req.query.project_id))) {
      return sendData(req, res, []);
    }
    filter.projectId = req.query.project_id;
  } else if (req.membership.role !== 'owner') {
    const projectIds = await CompanyProjectMember.find({
      ...scope(req), userId: req.user._id,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).distinct('projectId');
    filter.$or = [{ projectId: null }, { projectId: { $in: projectIds } }];
  }
  if (req.membership.role === 'guest') filter.ownerId = req.user._id;
  const documents = await CompanyDocument.find(filter).sort({ updatedAt: -1 }).limit(200);
  sendData(req, res, await Promise.all(documents.map((item) => serializeDocument(req, item))));
};

export const createDocument = async (req, res) => {
  const title = clean(req.body.title);
  if (!title) throw invalid('כותרת המסמך היא שדה חובה');
  const projectId = req.body.project_id || null;
  if (projectId && (!isObjectId(projectId) || !(await projectAccess(req, projectId)))) {
    throw new ApiError(403, 'ACCESS_DENIED', 'אין גישה לפרויקט');
  }
  const document = await CompanyDocument.create({
    ...scope(req), projectId, title, summary: clean(req.body.summary), ownerId: req.user._id,
  });
  const revision = await CompanyDocumentRevision.create({
    ...scope(req), documentId: document._id, revisionNo: 1, title,
    content: clean(req.body.content), createdBy: req.user._id,
  });
  document.currentRevisionId = revision._id;
  await document.save();
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'document.created',
    resourceType: 'document', resourceId: document._id, metadata: { revision: 1 },
  });
  sendData(req, res, await serializeDocument(req, document), 201);
};

export const getDocument = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  const revisions = await CompanyDocumentRevision.find({ ...scope(req), documentId: document._id })
    .populate('createdBy', 'name').sort({ revisionNo: -1 });
  const current = revisions.find((item) => item._id.equals(document.currentRevisionId)) || revisions[0];
  const approvals = await CompanyApproval.find({
    ...scope(req), resourceType: 'document', resourceId: document._id,
  }).populate('assigneeId', 'name').sort({ createdAt: -1 });
  sendData(req, res, {
    document: await serializeDocument(req, document),
    current_revision: serializeRevision(current),
    revisions: revisions.map(serializeRevision),
    approvals: approvals.map((item) => serializeApproval(req, item)),
  });
};

export const createRevision = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).edit) throw new ApiError(403, 'ACCESS_DENIED', 'אין הרשאת עריכה');
  const title = clean(req.body.title);
  if (!title) throw invalid('כותרת היא שדה חובה');
  const latest = await CompanyDocumentRevision.findOne({ ...scope(req), documentId: document._id })
    .sort({ revisionNo: -1 });
  await CompanyApproval.updateMany(
    { ...scope(req), resourceType: 'document', resourceId: document._id, status: 'pending' },
    { $set: { status: 'superseded', reason: 'נוצרה גרסה חדשה' } }
  );
  await CompanyDocumentRevision.updateMany(
    { ...scope(req), documentId: document._id, status: { $in: ['draft', 'in_review'] } },
    { $set: { status: 'superseded' } }
  );
  const revision = await CompanyDocumentRevision.create({
    ...scope(req), documentId: document._id, revisionNo: (latest?.revisionNo || 0) + 1,
    title, content: clean(req.body.content), createdBy: req.user._id,
  });
  document.title = title;
  document.currentRevisionId = revision._id;
  document.status = 'draft';
  await document.save();
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'document.revision_created',
    resourceType: 'document', resourceId: document._id, metadata: { revision: revision.revisionNo },
  });
  sendData(req, res, serializeRevision(revision), 201);
};

const chooseApprover = async (req) => {
  const preferred = await CompanyMember.findOne({
    ...scope(req), status: 'active', role: { $in: ['owner', 'admin', 'manager'] },
    userId: { $ne: req.user._id },
  }).sort({ role: 1 });
  if (preferred) return preferred.userId;
  const self = await CompanyMember.findOne({ ...scope(req), status: 'active', userId: req.user._id });
  if (self && ['owner', 'admin'].includes(self.role)) return self.userId;
  throw new ApiError(409, 'APPROVER_REQUIRED', 'לא נמצא מאשר פעיל בארגון');
};

export const submitDocument = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).edit) throw new ApiError(403, 'ACCESS_DENIED', 'אין הרשאת עריכה');
  const revision = await CompanyDocumentRevision.findById(document.currentRevisionId);
  if (!revision || revision.status !== 'draft') {
    throw new ApiError(409, 'INVALID_STATE', 'רק טיוטה עדכנית ניתנת לשליחה');
  }
  const approval = await CompanyApproval.create({
    ...scope(req), resourceType: 'document', resourceId: document._id,
    revisionId: revision._id, assigneeId: await chooseApprover(req),
  });
  revision.status = 'in_review';
  document.status = 'in_review';
  await Promise.all([revision.save(), document.save()]);
  await approval.populate('assigneeId', 'name');
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'document.submitted',
    resourceType: 'document', resourceId: document._id, metadata: { revision: revision.revisionNo },
  });
  sendData(req, res, serializeApproval(req, approval), 201);
};

export const publishDocument = async (req, res) => {
  const document = await loadDocument(req, req.params.documentId);
  if (!permissions(req, document).publish) throw new ApiError(403, 'ACCESS_DENIED', 'אין הרשאת פרסום');
  const revision = await CompanyDocumentRevision.findById(document.currentRevisionId);
  if (!revision || revision.status !== 'approved') {
    throw new ApiError(409, 'APPROVAL_REQUIRED', 'נדרש אישור לגרסה העדכנית');
  }
  revision.status = 'published';
  document.status = 'published';
  await Promise.all([revision.save(), document.save()]);
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'document.published',
    resourceType: 'document', resourceId: document._id, metadata: { revision: revision.revisionNo },
  });
  sendData(req, res, await serializeDocument(req, document));
};

const result = (type, id, title, subtitle, snippet, updatedAt) => ({
  id, type, resource_id: id, title, subtitle, snippet, updated_at: updatedAt,
});

export const search = async (req, res) => {
  const query = clean(req.query.q);
  if (query.length < 2) return sendData(req, res, []);
  const term = regex(query);
  const wanted = clean(req.query.type);
  const allow = (type) => !wanted || wanted === type;
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const results = [];
  let projectIds = null;
  if (req.membership.role !== 'owner') {
    projectIds = await CompanyProjectMember.find({
      ...scope(req), userId: req.user._id,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).distinct('projectId');
  }
  if (allow('project')) {
    const filter = { ...scope(req), $or: [{ name: term }, { description: term }] };
    if (projectIds) filter._id = { $in: projectIds };
    const rows = await CompanyProject.find(filter).limit(limit);
    results.push(...rows.map((row) => result('project', row._id, row.name, 'פרויקט', row.description, row.updatedAt)));
  }
  if (allow('task')) {
    const filter = { ...scope(req), $or: [{ title: term }, { description: term }] };
    if (projectIds) filter.projectId = { $in: projectIds };
    const rows = await CompanyTask.find(filter).limit(limit);
    results.push(...rows.map((row) => result('task', row._id, row.title, 'משימה', row.description, row.updatedAt)));
  }
  if (allow('document')) {
    const filter = { ...scope(req), $or: [{ title: term }, { summary: term }] };
    if (projectIds) filter.$and = [{ $or: [{ projectId: null }, { projectId: { $in: projectIds } }] }];
    if (req.membership.role === 'guest') filter.ownerId = req.user._id;
    const rows = await CompanyDocument.find(filter).limit(limit);
    results.push(...rows.map((row) => result('document', row._id, row.title, 'מסמך · ' + row.status, row.summary, row.updatedAt)));
  }
  if (allow('lead') && req.membership.role !== 'guest') {
    const visibility = {
      $or: [{ isConfidential: false }, { confidentialTo: req.user._id },
        { createdBy: req.user._id }, { assignedTo: req.user._id }],
    };
    const rows = await CompanyLead.find({
      ...scope(req), $and: [visibility,
        { $or: [{ title: term }, { personName: term }, { companyName: term }] }],
    }).limit(limit);
    results.push(...rows.map((row) => result('lead', row._id, row.title, 'ליד · ' + row.status, row.companyName, row.updatedAt)));
  }
  if (allow('deal') && req.membership.role !== 'guest') {
    const rows = await CompanyDeal.find({ ...scope(req), title: term }).limit(limit);
    results.push(...rows.map((row) => result('deal', row._id, row.title, 'עסקה · ' + row.status, '', row.updatedAt)));
  }
  if (allow('account') && req.membership.role !== 'guest') {
    const rows = await CompanyAccount.find({ ...scope(req), name: term }).limit(limit);
    results.push(...rows.map((row) => result('account', row._id, row.name, 'לקוח', row.email, row.updatedAt)));
  }
  if (allow('message')) {
    const conversationIds = await CompanyConversationMember.find({
      ...scope(req), userId: req.user._id,
    }).distinct('conversationId');
    const rows = await CompanyMessage.find({
      ...scope(req), conversationId: { $in: conversationIds }, body: term, deletedAt: null,
    }).limit(limit);
    results.push(...rows.map((row) => result('message', row._id, row.body.slice(0, 80), 'הודעה', row.body, row.createdAt)));
  }
  results.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  sendData(req, res, results.slice(0, limit), 200, { total: results.length });
};
