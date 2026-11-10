import crypto from 'crypto';
import { ApiError, isObjectId, recordAudit, sendData } from './access.js';
import { notify } from './chatController.js';
import { accountVisibility, canManageCrm as canManage, dealVisibility, leadVisibility } from './crmAccess.js';
import {
  CompanyConversation, CompanyMember, CompanyMilestone, CompanyProject, CompanyProjectMember,
  CompanyProjectTemplate, CompanyTask,
} from './models.js';
import {
  CompanyAccount, CompanyApproval, CompanyContact, CompanyCrmActivity, CompanyDeal, CompanyDocument,
  CompanyDocumentLink, CompanyDocumentRevision, CompanyLead, CompanyQuote,
} from './knowledgeCrmModels.js';
import { serializeApproval } from './knowledgeController.js';
import { emitToOrganization } from './realtime.js';

const scope = (req) => ({ organizationId: req.organization._id });
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const invalid = (message) => new ApiError(400, 'VALIDATION_ERROR', message);
const denied = () => new ApiError(403, 'ACCESS_DENIED', 'אין לך הרשאה לפעולה זו');
const notFound = (label = 'הרשומה') => new ApiError(404, 'NOT_FOUND', label + ' לא נמצאה');
const conflict = (code, message) => new ApiError(409, code, message);
const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);
const isGuest = (req) => req.membership.role === 'guest';
const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);

const audit = (req, action, resourceType, resourceId, metadata) =>
  recordAudit(req, { organizationId: req.organization._id, action, resourceType, resourceId, metadata });

const LEAD_STATUSES = ['new', 'assigned', 'accepted', 'contacting', 'qualified', 'converted', 'nurturing', 'disqualified', 'archived'];
const CURRENCIES = ['ILS', 'USD', 'EUR'];
const ACTIVITY_TYPES = ['note', 'call', 'meeting', 'email'];
const OUTREACH_TYPES = ['call', 'meeting', 'email'];

const DEFAULT_PIPELINE = [
  { id: 'discovery', name: 'גילוי צרכים' },
  { id: 'requirements_confirmed', name: 'דרישות אושרו' },
  { id: 'solution_scoped', name: 'תיחום פתרון' },
  { id: 'quote_draft', name: 'טיוטת הצעה' },
  { id: 'quote_approval', name: 'אישור הצעה' },
  { id: 'quote_sent', name: 'הצעה נשלחה' },
  { id: 'negotiation', name: 'משא ומתן' },
];
const DEFAULT_KICKOFF_TASKS = ['פגישת פתיחה עם הלקוח', 'אישור דרישות ותכולה', 'שיבוץ צוות ולוחות זמנים'];

const pipelineOf = (req) => req.organization.settings?.pipelineStages ?? DEFAULT_PIPELINE;

// Amounts are summed in minor units, so 0.1 + 0.2 can't drift (spec 26.2).
const toCents = (value) => Math.round(Number(value) * 100);
const fromCents = (cents) => cents / 100;

// ── Loading with access ──

const loadLead = async (req, id) => {
  if (!isObjectId(id) || isGuest(req)) throw notFound('הליד');
  const lead = await CompanyLead.findOne({ _id: id, ...scope(req), ...leadVisibility(req) }).populate('assignedTo', 'name');
  if (!lead) throw notFound('הליד');
  return lead;
};

const loadDeal = async (req, id) => {
  if (!isObjectId(id) || isGuest(req)) throw notFound('העסקה');
  const deal = await CompanyDeal.findOne({ _id: id, ...scope(req), ...dealVisibility(req) })
    .populate('accountId', 'name').populate('ownerId', 'name');
  if (!deal) throw notFound('העסקה');
  return deal;
};

const loadAccount = async (req, id) => {
  if (!isObjectId(id) || isGuest(req)) throw notFound('הלקוח');
  const account = await CompanyAccount.findOne({ _id: id, ...scope(req), ...accountVisibility(req) });
  if (!account) throw notFound('הלקוח');
  return account;
};

const loadQuote = async (req, id) => {
  if (!isObjectId(id)) throw notFound('הצעת המחיר');
  const quote = await CompanyQuote.findOne({ _id: id, ...scope(req) });
  if (!quote) throw notFound('הצעת המחיר');
  const deal = await loadDeal(req, quote.dealId);
  return { quote, deal };
};

const requireLeadActor = (req, lead) => {
  if (!canManage(req) && !sameId(lead.assignedTo, req.user._id)) throw denied();
};
const requireDealActor = (req, deal) => {
  if (!canManage(req) && !sameId(deal.ownerId, req.user._id)) throw denied();
};

const requireColleague = async (req, userId) => {
  if (!isObjectId(userId) || !(await CompanyMember.exists({ ...scope(req), userId, status: 'active' }))) {
    throw invalid('המשתמש אינו חבר פעיל בארגון');
  }
};

// ── Serialization ──

const duplicateCandidates = async (req, lead) => {
  const clauses = [];
  if (lead.email) clauses.push({ email: lead.email });
  if (lead.phone) clauses.push({ phone: lead.phone });
  if (!clauses.length && !lead.companyName) return [];

  const confidence = (row) => (row.email === lead.email && lead.email) || (row.phone === lead.phone && lead.phone) ? 0.95 : 0.7;
  const accountClauses = lead.companyName ? [...clauses, { name: lead.companyName }] : clauses;
  const leadClauses = lead.companyName ? [...clauses, { companyName: lead.companyName }] : clauses;
  const [accounts, leads] = await Promise.all([
    CompanyAccount.find({ ...scope(req), $and: [{ $or: accountClauses }, accountVisibility(req)] }).limit(5),
    CompanyLead.find({ ...scope(req), _id: { $ne: lead._id }, $and: [{ $or: leadClauses }, leadVisibility(req)] }).limit(5),
  ]);
  return [
    ...accounts.map((row) => ({ id: row._id, type: 'account', label: row.name, confidence: confidence(row) })),
    ...leads.map((row) => ({ id: row._id, type: 'lead', label: row.title, confidence: confidence(row) })),
  ];
};

const serializeLead = async (req, lead) => {
  const assignee = lead.assignedTo?._id || lead.assignedTo;
  const isActor = canManage(req) || sameId(assignee, req.user._id);
  return {
    id: lead._id, title: lead.title, source: lead.source, status: lead.status, version: lead.version,
    person_name: lead.personName, company_name: lead.companyName, email: lead.email, phone: lead.phone,
    assigned_to: assignee, assigned_name: lead.assignedTo?.name, assignment_state: lead.assignmentState,
    is_confidential: lead.isConfidential, labels: lead.labels, score: lead.score, score_explanation: lead.scoreExplanation,
    last_contact_at: lead.lastContactAt, next_followup_at: lead.nextFollowupAt, lost_reason: lead.lostReason,
    duplicate_candidates: await duplicateCandidates(req, lead),
    can_edit: isActor,
    can_assign: canManage(req),
    can_decide_assignment: lead.assignmentState === 'pending' && sameId(assignee, req.user._id),
    can_convert: isActor && lead.status === 'qualified',
    created_at: lead.createdAt,
  };
};

const serializeDeal = async (req, deal) => {
  const projectApproval = await CompanyApproval.findOne({
    ...scope(req), resourceType: 'project_creation', resourceId: deal._id,
  }).populate('assigneeId', 'name').sort({ createdAt: -1 });
  const ownerId = deal.ownerId?._id || deal.ownerId;
  const isActor = canManage(req) || sameId(ownerId, req.user._id);
  const stage = pipelineOf(req).find((item) => item.id === deal.stageId);
  return {
    id: deal._id, title: deal.title, account_id: deal.accountId?._id || deal.accountId,
    account_name: deal.accountId?.name, stage_id: deal.stageId, stage_name: stage?.name ?? deal.stageId,
    owner_id: ownerId, owner_name: deal.ownerId?.name, currency: deal.currency,
    forecast_value: deal.forecastValue, booked_value: deal.bookedValue, status: deal.status, lost_reason: deal.lostReason,
    is_confidential: deal.isConfidential, approved_quote_id: deal.approvedQuoteId, project_id: deal.projectId,
    project_approval: projectApproval ? serializeApproval(req, projectApproval) : null,
    can_edit: isActor,
    can_close_won: Boolean(deal.approvedQuoteId) && deal.status === 'open' && isActor,
    created_at: deal.createdAt,
  };
};

const serializeQuote = async (req, quote, isActor) => {
  const approvals = await CompanyApproval.find({ ...scope(req), resourceType: 'quote', resourceId: quote._id })
    .populate('assigneeId', 'name').sort({ createdAt: 1 });
  return {
    id: quote._id, deal_id: quote.dealId, revision_no: quote.revisionNo, status: quote.status,
    currency: quote.currency, subtotal: quote.subtotal, discount: quote.discount, total: quote.total, terms: quote.terms,
    sent_at: quote.sentAt, accepted_at: quote.acceptedAt, accepted_by: quote.acceptedBy,
    lines: quote.lines.map((line) => ({
      description: line.description, quantity: line.quantity, unit_price: line.unitPrice, total: line.total,
    })),
    approvals: approvals.map((approval) => serializeApproval(req, approval)),
    can_edit: isActor && quote.status === 'draft',
    can_submit: isActor && quote.status === 'draft',
    can_mark_sent: isActor && quote.status === 'approved',
    can_record_acceptance: isActor && quote.status === 'sent' && !quote.acceptedAt,
  };
};

// ── Leads ──

const stringQuery = (value) => (typeof value === 'string' ? value : undefined);

export const listLeads = async (req, res) => {
  if (isGuest(req)) return sendData(req, res, []);
  const filter = { ...scope(req), ...leadVisibility(req) };
  const status = stringQuery(req.query.status);
  if (status) {
    if (!LEAD_STATUSES.includes(status)) throw invalid('סטטוס לא תקין');
    filter.status = status;
  }
  const assignedTo = stringQuery(req.query.assigned_to);
  if (assignedTo) {
    if (!isObjectId(assignedTo)) throw invalid('משתמש לא תקין');
    filter.assignedTo = assignedTo;
  }
  const leads = await CompanyLead.find(filter).populate('assignedTo', 'name').sort({ updatedAt: -1 }).limit(200);
  sendData(req, res, await Promise.all(leads.map((lead) => serializeLead(req, lead))));
};

export const getLead = async (req, res) => {
  sendData(req, res, await serializeLead(req, await loadLead(req, req.params.leadId)));
};

const leadFields = (body) => ({
  personName: clean(body.person_name),
  companyName: clean(body.company_name),
  email: clean(body.email).toLowerCase(),
  phone: clean(body.phone),
});

export const createLeadRecord = async ({ organizationId, createdBy, body, source }) =>
  CompanyLead.create({
    organizationId,
    title: clean(body.title),
    source,
    sourceRef: clean(body.source_ref),
    ...leadFields(body),
    labels: Array.isArray(body.labels) ? body.labels.map(clean).filter(Boolean) : [],
    isConfidential: Boolean(body.is_confidential),
    confidentialTo: body.is_confidential ? [createdBy] : [],
    createdBy,
  });

export const createLead = async (req, res) => {
  if (isGuest(req)) throw denied();
  if (!clean(req.body.title)) throw invalid('כותרת הליד היא שדה חובה');
  const lead = await createLeadRecord({
    organizationId: req.organization._id,
    createdBy: req.user._id,
    body: req.body,
    source: clean(req.body.source) || 'manual',
  });
  await audit(req, 'lead.created', 'lead', lead._id, { confidential: lead.isConfidential });
  sendData(req, res, await serializeLead(req, lead), 201);
};

export const updateLead = async (req, res) => {
  const lead = await loadLead(req, req.params.leadId);
  requireLeadActor(req, lead);
  const { body } = req;
  if (!Number.isInteger(body.version)) throw invalid('חסר מספר גרסה');

  const updates = {};
  if (has(body, 'title')) {
    updates.title = clean(body.title);
    if (!updates.title) throw invalid('כותרת הליד היא שדה חובה');
  }
  if (has(body, 'person_name')) updates.personName = clean(body.person_name);
  if (has(body, 'company_name')) updates.companyName = clean(body.company_name);
  if (has(body, 'email')) updates.email = clean(body.email).toLowerCase();
  if (has(body, 'phone')) updates.phone = clean(body.phone);
  if (has(body, 'source')) updates.source = clean(body.source) || 'manual';
  if (Array.isArray(body.labels)) updates.labels = body.labels.map(clean).filter(Boolean);
  if (has(body, 'next_followup_at')) {
    updates.nextFollowupAt = body.next_followup_at ? new Date(body.next_followup_at) : null;
    if (updates.nextFollowupAt && Number.isNaN(updates.nextFollowupAt.getTime())) throw invalid('תאריך לא תקין');
    updates.followupNotifiedAt = null;
  }
  if (Array.isArray(body.confidential_user_ids)) {
    const ids = [...new Set(body.confidential_user_ids.map(String))];
    await Promise.all(ids.map((id) => requireColleague(req, id)));
    updates.confidentialTo = [...new Set([...ids, String(lead.createdBy)])];
  }
  if (has(body, 'is_confidential')) updates.isConfidential = Boolean(body.is_confidential);

  const updated = await CompanyLead.findOneAndUpdate(
    { _id: lead._id, version: body.version },
    { $set: updates, $inc: { version: 1 } },
    { new: true, runValidators: true }
  ).populate('assignedTo', 'name');
  if (!updated) throw conflict('VERSION_CONFLICT', 'הליד עודכן בינתיים על ידי מישהו אחר');

  if (has(updates, 'isConfidential') && updates.isConfidential !== lead.isConfidential) {
    await audit(req, 'lead.confidentiality_changed', 'lead', lead._id, { confidential: updates.isConfidential });
  }
  sendData(req, res, await serializeLead(req, updated));
};

export const assignLead = async (req, res) => {
  if (!canManage(req)) throw denied();
  const lead = await loadLead(req, req.params.leadId);
  if (['converted', 'disqualified', 'archived'].includes(lead.status)) throw conflict('INVALID_STATE', 'אי אפשר לשייך ליד במצב זה');
  const userId = req.body.user_id;
  await requireColleague(req, userId);

  lead.assignedTo = userId;
  lead.assignmentState = 'pending';
  lead.status = 'assigned';
  lead.assignmentReason = '';
  if (lead.isConfidential && !lead.confidentialTo.some((id) => sameId(id, userId))) lead.confidentialTo.push(userId);
  lead.version += 1;
  await lead.save();
  await lead.populate('assignedTo', 'name');
  await audit(req, 'lead.assigned', 'lead', lead._id, { assigned_to: String(userId) });
  if (!sameId(userId, req.user._id)) {
    await notify(req.organization._id, userId, {
      type: 'lead_assigned',
      title: `ליד ממתין לקבלת אחריות: ${lead.title}`,
      resourceType: 'lead',
      resourceId: String(lead._id),
    });
  }
  sendData(req, res, await serializeLead(req, lead));
};

export const decideAssignment = async (req, res) => {
  const lead = await loadLead(req, req.params.leadId);
  if (!sameId(lead.assignedTo, req.user._id)) throw denied();
  if (lead.assignmentState !== 'pending') throw conflict('INVALID_STATE', 'אין בקשת שיוך פתוחה');
  const { decision } = req.body;
  if (!['accepted', 'rejected'].includes(decision)) throw invalid('החלטה לא תקינה');
  const reason = clean(req.body.reason);
  if (decision === 'rejected' && !reason) throw invalid('סיבת דחייה היא שדה חובה');

  lead.assignmentState = decision;
  lead.assignmentReason = reason;
  lead.status = decision === 'accepted' ? 'accepted' : 'new';
  if (decision === 'rejected') lead.assignedTo = null;
  lead.version += 1;
  await lead.save();
  await audit(req, 'lead.assignment_' + decision, 'lead', lead._id, { reason });
  sendData(req, res, await serializeLead(req, lead));
};

const TRANSITIONS = {
  new: ['disqualified', 'archived'],
  assigned: ['disqualified'],
  accepted: ['contacting', 'qualified', 'nurturing', 'disqualified'],
  contacting: ['qualified', 'nurturing', 'disqualified'],
  nurturing: ['contacting', 'qualified', 'disqualified', 'archived'],
  qualified: ['nurturing', 'disqualified'],
  disqualified: ['archived'],
};

export const transitionLead = async (req, res) => {
  const lead = await loadLead(req, req.params.leadId);
  requireLeadActor(req, lead);
  const status = clean(req.body.status);
  if (!(TRANSITIONS[lead.status] || []).includes(status)) throw conflict('INVALID_TRANSITION', 'מעבר הסטטוס אינו תקין');
  const reason = clean(req.body.reason);
  if (status === 'disqualified') {
    if (!reason) throw invalid('סיבת פסילה היא שדה חובה');
    lead.lostReason = reason;
    lead.disqualifiedAt = new Date();
    lead.disqualifiedBy = req.user._id;
  }
  lead.status = status;
  lead.version += 1;
  await lead.save();
  await audit(req, 'lead.status_changed', 'lead', lead._id, { status, reason });
  sendData(req, res, await serializeLead(req, lead));
};

const dealForResponse = (id) => CompanyDeal.findById(id).populate('accountId', 'name').populate('ownerId', 'name');

export const convertLead = async (req, res) => {
  const lead = await loadLead(req, req.params.leadId);
  requireLeadActor(req, lead);
  if (lead.status === 'converted' && lead.convertedDealId) {
    return sendData(req, res, await serializeDeal(req, await dealForResponse(lead.convertedDealId)));
  }
  if (lead.status !== 'qualified') throw conflict('INVALID_STATE', 'רק ליד מוסמך ניתן להמרה');
  const key = clean(req.get('Idempotency-Key'));
  if (!key) throw invalid('נדרש Idempotency-Key');

  // Validated before the claim, so a bad account can't leave the lead stuck.
  let existingAccount = null;
  if (req.body.account_id) existingAccount = await loadAccount(req, req.body.account_id);

  const claim = await CompanyLead.updateOne(
    { _id: lead._id, ...scope(req), status: 'qualified', conversionKey: null },
    { $set: { conversionKey: key } }
  );
  if (claim.modifiedCount !== 1) {
    const current = await CompanyLead.findById(lead._id);
    if (current?.status === 'converted' && current.convertedDealId) {
      return sendData(req, res, await serializeDeal(req, await dealForResponse(current.convertedDealId)));
    }
    throw conflict('CONVERSION_IN_PROGRESS', 'המרת הליד כבר מתבצעת');
  }

  const ownerId = lead.assignedTo?._id || lead.assignedTo || req.user._id;
  const confidentiality = {
    isConfidential: lead.isConfidential,
    confidentialTo: lead.isConfidential ? [...new Set([...lead.confidentialTo.map(String), String(ownerId)])] : [],
  };
  let account = existingAccount;
  let contact = null;
  let deal = null;
  try {
    if (!account) {
      account = await CompanyAccount.create({
        ...scope(req), name: lead.companyName || lead.personName || lead.title,
        email: lead.email, phone: lead.phone, createdBy: req.user._id, ...confidentiality,
      });
    }
    contact = await CompanyContact.create({
      ...scope(req), accountId: account._id, name: lead.personName || lead.title,
      email: lead.email, phone: lead.phone, createdBy: req.user._id,
    });
    deal = await CompanyDeal.create({
      ...scope(req), accountId: account._id, contactId: contact._id, originLeadId: lead._id,
      title: lead.title, ownerId, stageId: pipelineOf(req)[0].id, ...confidentiality,
    });
    lead.status = 'converted';
    lead.convertedAccountId = account._id;
    lead.convertedContactId = contact._id;
    lead.convertedDealId = deal._id;
    lead.version += 1;
    await lead.save();
    await audit(req, 'lead.converted', 'lead', lead._id, {
      account_id: String(account._id), contact_id: String(contact._id), deal_id: String(deal._id),
    });
    sendData(req, res, await serializeDeal(req, await dealForResponse(deal._id)), 201);
  } catch (error) {
    if (deal) await CompanyDeal.deleteOne({ _id: deal._id });
    if (contact) await CompanyContact.deleteOne({ _id: contact._id });
    if (!existingAccount && account) await CompanyAccount.deleteOne({ _id: account._id });
    await CompanyLead.updateOne({ _id: lead._id, conversionKey: key, status: 'qualified' }, { $set: { conversionKey: null } });
    throw error;
  }
};

const csvCell = (value) => {
  const text = String(value ?? '');
  // A leading =, +, - or @ would run as a formula when the file is opened in Excel.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const exportLeads = async (req, res) => {
  if (!canManage(req)) throw denied();
  const leads = await CompanyLead.find({ ...scope(req), ...leadVisibility(req) }).populate('assignedTo', 'name').sort({ createdAt: -1 }).limit(10000);
  const header = ['כותרת', 'סטטוס', 'מקור', 'איש קשר', 'חברה', 'דוא״ל', 'טלפון', 'אחראי', 'נוצר'];
  const rows = leads.map((lead) => [
    lead.title, lead.status, lead.source, lead.personName, lead.companyName, lead.email, lead.phone,
    lead.assignedTo?.name ?? '', lead.createdAt.toISOString(),
  ]);
  await audit(req, 'lead.exported', 'lead', null, { count: leads.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
  res.send(`﻿${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`);
};

export const rotateLeadWebhookToken = async (req, res) => {
  if (!['owner', 'admin'].includes(req.membership.role)) throw denied();
  const token = crypto.randomBytes(32).toString('base64url');
  req.organization.settings = {
    ...req.organization.settings,
    leadWebhookHash: crypto.createHash('sha256').update(token).digest('hex'),
  };
  req.organization.markModified('settings');
  await req.organization.save();
  await audit(req, 'lead.webhook_rotated', 'organization', req.organization._id);
  // The only moment the token exists in the clear.
  sendData(req, res, { token, url: '/api/company-webhooks/leads' });
};

// ── Activities ──

const loadActivityTarget = async (req) => {
  const { resourceType, resourceId } = req.params;
  if (resourceType === 'lead') return { record: await loadLead(req, resourceId), type: 'lead' };
  if (resourceType === 'deal') return { record: await loadDeal(req, resourceId), type: 'deal' };
  if (resourceType === 'account') return { record: await loadAccount(req, resourceId), type: 'account' };
  throw notFound('הרשומה');
};

const serializeActivity = (activity) => ({
  id: activity._id, type: activity.type, body: activity.body, occurred_at: activity.occurredAt,
  actor_name: activity.actorId?.name ?? null, created_at: activity.createdAt,
});

export const listActivities = async (req, res) => {
  const { record, type } = await loadActivityTarget(req);
  const rows = await CompanyCrmActivity.find({ ...scope(req), resourceType: type, resourceId: record._id })
    .populate('actorId', 'name').sort({ occurredAt: -1 }).limit(200);
  sendData(req, res, rows.map(serializeActivity));
};

export const addActivity = async (req, res) => {
  const { record, type } = await loadActivityTarget(req);
  if (!ACTIVITY_TYPES.includes(req.body.type)) throw invalid('סוג פעילות לא תקין');
  const body = clean(req.body.body);
  if (!body) throw invalid('תוכן הפעילות הוא שדה חובה');
  const occurredAt = req.body.occurred_at ? new Date(req.body.occurred_at) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw invalid('תאריך לא תקין');

  const activity = await CompanyCrmActivity.create({
    ...scope(req), resourceType: type, resourceId: record._id, type: req.body.type,
    body: body.slice(0, 5000), occurredAt, actorId: req.user._id,
  });
  if (type === 'lead' && OUTREACH_TYPES.includes(activity.type)) {
    await CompanyLead.updateOne({ _id: record._id }, { $set: { lastContactAt: occurredAt } });
  }
  await activity.populate('actorId', 'name');
  sendData(req, res, serializeActivity(activity), 201);
};

// ── Accounts and contacts ──

const serializeAccount = (account, openDeals) => ({
  id: account._id, name: account.name, email: account.email, phone: account.phone,
  is_confidential: account.isConfidential, open_deals: openDeals,
});

export const listAccounts = async (req, res) => {
  if (isGuest(req)) return sendData(req, res, []);
  const accounts = await CompanyAccount.find({ ...scope(req), ...accountVisibility(req) }).sort({ name: 1 }).limit(500);
  const open = await CompanyDeal.aggregate([
    { $match: { accountId: { $in: accounts.map((a) => a._id) }, status: 'open' } },
    { $group: { _id: '$accountId', count: { $sum: 1 } } },
  ]);
  const counts = new Map(open.map((row) => [String(row._id), row.count]));
  sendData(req, res, accounts.map((account) => serializeAccount(account, counts.get(String(account._id)) ?? 0)));
};

export const createAccount = async (req, res) => {
  if (isGuest(req)) throw denied();
  const name = clean(req.body.name);
  if (!name) throw invalid('שם הלקוח הוא שדה חובה');
  const account = await CompanyAccount.create({
    ...scope(req), name, email: clean(req.body.email).toLowerCase(), phone: clean(req.body.phone), createdBy: req.user._id,
  });
  await audit(req, 'account.created', 'account', account._id, { name });
  sendData(req, res, serializeAccount(account, 0), 201);
};

export const updateAccount = async (req, res) => {
  const account = await loadAccount(req, req.params.accountId);
  if (!canManage(req) && !sameId(account.createdBy, req.user._id)) throw denied();
  if (has(req.body, 'name')) {
    account.name = clean(req.body.name);
    if (!account.name) throw invalid('שם הלקוח הוא שדה חובה');
  }
  if (has(req.body, 'email')) account.email = clean(req.body.email).toLowerCase();
  if (has(req.body, 'phone')) account.phone = clean(req.body.phone);
  await account.save();
  sendData(req, res, serializeAccount(account, 0));
};

export const getAccount = async (req, res) => {
  const account = await loadAccount(req, req.params.accountId);
  const [contacts, deals] = await Promise.all([
    CompanyContact.find({ ...scope(req), accountId: account._id }).sort({ name: 1 }),
    CompanyDeal.find({ ...scope(req), accountId: account._id, ...dealVisibility(req) })
      .populate('accountId', 'name').populate('ownerId', 'name').sort({ updatedAt: -1 }).limit(100),
  ]);
  const projectIds = deals.map((deal) => deal.projectId).filter(Boolean);
  const projects = await CompanyProject.find({ _id: { $in: projectIds } }).select('name status');
  sendData(req, res, {
    account: serializeAccount(account, deals.filter((deal) => deal.status === 'open').length),
    contacts: contacts.map((c) => ({ id: c._id, name: c.name, email: c.email, phone: c.phone })),
    deals: await Promise.all(deals.map((deal) => serializeDeal(req, deal))),
    projects: projects.map((p) => ({ id: p._id, name: p.name, status: p.status })),
  });
};

export const addContact = async (req, res) => {
  const account = await loadAccount(req, req.params.accountId);
  const name = clean(req.body.name);
  if (!name) throw invalid('שם איש הקשר הוא שדה חובה');
  const contact = await CompanyContact.create({
    ...scope(req), accountId: account._id, name, email: clean(req.body.email).toLowerCase(),
    phone: clean(req.body.phone), createdBy: req.user._id,
  });
  sendData(req, res, { id: contact._id, name: contact.name, email: contact.email, phone: contact.phone }, 201);
};

// ── Deals and pipeline ──

export const getPipeline = async (req, res) => {
  sendData(req, res, pipelineOf(req));
};

export const updatePipeline = async (req, res) => {
  if (!['owner', 'admin'].includes(req.membership.role)) throw denied();
  const { stages } = req.body;
  if (!Array.isArray(stages) || stages.length === 0) throw invalid('נדרש שלב אחד לפחות');
  const cleaned = stages.map((stage) => ({ id: clean(stage.id), name: clean(stage.name) }));
  if (cleaned.some((stage) => !stage.id || !stage.name) || new Set(cleaned.map((s) => s.id)).size !== cleaned.length) {
    throw invalid('שלבי הצינור אינם תקינים');
  }
  const ids = cleaned.map((stage) => stage.id);
  if (await CompanyDeal.exists({ ...scope(req), status: 'open', stageId: { $nin: ids } })) {
    throw conflict('STAGE_IN_USE', 'יש עסקאות פתוחות בשלב שהוסר');
  }
  req.organization.settings = { ...req.organization.settings, pipelineStages: cleaned };
  req.organization.markModified('settings');
  await req.organization.save();
  await audit(req, 'pipeline.updated', 'organization', req.organization._id, { stages: ids });
  sendData(req, res, cleaned);
};

export const listDeals = async (req, res) => {
  if (isGuest(req)) return sendData(req, res, []);
  const filter = { ...scope(req), ...dealVisibility(req) };
  const stage = stringQuery(req.query.stage_id);
  if (stage) filter.stageId = stage;
  const status = stringQuery(req.query.status);
  if (status) filter.status = status;
  const deals = await CompanyDeal.find(filter).populate('accountId', 'name').populate('ownerId', 'name').sort({ updatedAt: -1 }).limit(200);
  sendData(req, res, await Promise.all(deals.map((deal) => serializeDeal(req, deal))));
};

export const createDeal = async (req, res) => {
  if (isGuest(req)) throw denied();
  const title = clean(req.body.title);
  if (!title) throw invalid('כותרת העסקה היא שדה חובה');
  const account = await loadAccount(req, req.body.account_id);
  const ownerId = req.body.owner_id || req.user._id;
  if (!sameId(ownerId, req.user._id)) {
    if (!canManage(req)) throw denied();
    await requireColleague(req, ownerId);
  }
  const currency = clean(req.body.currency) || 'ILS';
  if (!CURRENCIES.includes(currency)) throw invalid('מטבע לא נתמך');
  const forecast = Number(req.body.forecast_value ?? 0);
  if (!Number.isFinite(forecast) || forecast < 0) throw invalid('תחזית לא תקינה');
  let contactId = null;
  if (req.body.contact_id) {
    if (!isObjectId(req.body.contact_id) || !(await CompanyContact.exists({ _id: req.body.contact_id, accountId: account._id }))) {
      throw invalid('איש הקשר אינו שייך ללקוח');
    }
    contactId = req.body.contact_id;
  }
  const deal = await CompanyDeal.create({
    ...scope(req), accountId: account._id, contactId, title, ownerId, currency,
    forecastValue: fromCents(toCents(forecast)), stageId: pipelineOf(req)[0].id,
    isConfidential: account.isConfidential,
    confidentialTo: account.isConfidential ? [...new Set([...account.confidentialTo.map(String), String(ownerId)])] : [],
  });
  await audit(req, 'deal.created', 'deal', deal._id, { title });
  sendData(req, res, await serializeDeal(req, await dealForResponse(deal._id)), 201);
};

export const moveDealStage = async (req, res) => {
  const deal = await loadDeal(req, req.params.dealId);
  requireDealActor(req, deal);
  if (deal.status !== 'open') throw conflict('INVALID_STATE', 'העסקה אינה פתוחה');
  const stageId = clean(req.body.stage_id);
  if (!pipelineOf(req).some((stage) => stage.id === stageId)) throw invalid('שלב לא תקין');
  const before = deal.stageId;
  deal.stageId = stageId;
  await deal.save();
  await audit(req, 'deal.stage_changed', 'deal', deal._id, { before, after: stageId });
  sendData(req, res, await serializeDeal(req, deal));
};

export const closeLost = async (req, res) => {
  const deal = await loadDeal(req, req.params.dealId);
  requireDealActor(req, deal);
  const reason = clean(req.body.reason);
  if (!reason) throw invalid('סיבת ההפסד היא שדה חובה');
  const updated = await CompanyDeal.findOneAndUpdate(
    { _id: deal._id, status: 'open' },
    { $set: { status: 'lost', lostReason: reason, closedAt: new Date() } },
    { new: true }
  ).populate('accountId', 'name').populate('ownerId', 'name');
  if (!updated) throw conflict('INVALID_STATE', 'העסקה אינה פתוחה');
  await CompanyApproval.updateMany(
    { ...scope(req), resourceType: 'quote', status: 'pending', dealId: deal._id },
    { $set: { status: 'superseded', reason: 'העסקה נסגרה כהפסד' } }
  );
  await audit(req, 'deal.lost', 'deal', deal._id, { reason });
  sendData(req, res, await serializeDeal(req, updated));
};

// ── Quotes ──

export const listQuotes = async (req, res) => {
  const deal = await loadDeal(req, req.params.dealId);
  const quotes = await CompanyQuote.find({ ...scope(req), dealId: deal._id }).sort({ revisionNo: -1 });
  const isActor = canManage(req) || sameId(deal.ownerId, req.user._id);
  sendData(req, res, await Promise.all(quotes.map((quote) => serializeQuote(req, quote, isActor))));
};

export const createQuote = async (req, res) => {
  const deal = await loadDeal(req, req.params.dealId);
  requireDealActor(req, deal);
  if (deal.status !== 'open') throw conflict('INVALID_STATE', 'העסקה אינה פתוחה');
  const currency = clean(req.body.currency) || deal.currency;
  if (!CURRENCIES.includes(currency)) throw invalid('מטבע לא נתמך');

  const lines = Array.isArray(req.body.lines) ? req.body.lines.map((line) => {
    const description = clean(line?.description);
    const quantity = Number(line?.quantity);
    const unitCents = toCents(line?.unit_price);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCents) || unitCents < 0) {
      throw invalid('שורת הצעה אינה תקינה');
    }
    return { description, quantity, unitCents, totalCents: Math.round(quantity * unitCents) };
  }) : [];
  if (!lines.length) throw invalid('נדרשת לפחות שורת הצעה אחת');

  const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const discountCents = toCents(req.body.discount ?? 0);
  if (!Number.isFinite(discountCents) || discountCents < 0 || discountCents > subtotalCents) throw invalid('הנחה לא תקינה');

  const previous = await CompanyQuote.findOne({ ...scope(req), dealId: deal._id }).sort({ revisionNo: -1 });
  const open = await CompanyQuote.find({
    ...scope(req), dealId: deal._id, status: { $in: ['draft', 'in_review', 'approved', 'sent'] },
  }).select('_id');
  // Approval belongs to one revision: a new one voids everything before it (AC-14).
  await CompanyQuote.updateMany({ _id: { $in: open.map((q) => q._id) } }, { $set: { status: 'superseded' } });
  await CompanyApproval.updateMany(
    { ...scope(req), resourceType: 'quote', resourceId: { $in: open.map((q) => q._id) }, status: 'pending' },
    { $set: { status: 'superseded', reason: 'נוצרה גרסת הצעה חדשה' } }
  );

  const quote = await CompanyQuote.create({
    ...scope(req), dealId: deal._id, revisionNo: (previous?.revisionNo || 0) + 1, currency,
    lines: lines.map((line) => ({
      description: line.description, quantity: line.quantity,
      unitPrice: fromCents(line.unitCents), total: fromCents(line.totalCents),
    })),
    subtotal: fromCents(subtotalCents), discount: fromCents(discountCents),
    total: fromCents(subtotalCents - discountCents), terms: clean(req.body.terms), createdBy: req.user._id,
  });
  await CompanyDeal.updateOne(
    { _id: deal._id },
    { $set: { currency, forecastValue: quote.total, approvedQuoteId: null } }
  );
  await audit(req, 'quote.created', 'quote', quote._id, { revision: quote.revisionNo, total: quote.total, currency });
  sendData(req, res, await serializeQuote(req, quote, true), 201);
};

const activeApprovers = (req, roles, exclude) =>
  CompanyMember.find({ ...scope(req), status: 'active', role: { $in: roles }, userId: { $nin: exclude } }).sort({ role: 1 });

// One step, or two above the organization's limit: a manager tier, then an owner (FR-SALES-03).
const quoteApproverChain = async (req, total) => {
  const limit = req.organization.settings?.quoteApprovalLimit;
  const requester = req.user._id;
  const needsOwner = typeof limit === 'number' && total > limit;
  const firstTier = needsOwner ? ['admin', 'manager'] : ['owner', 'admin', 'manager'];

  const [first] = await activeApprovers(req, firstTier, [requester]);
  const chain = first ? [first.userId] : [];
  if (needsOwner) {
    const [owner] = await activeApprovers(req, ['owner'], [requester, ...chain]);
    if (owner) chain.push(owner.userId);
  }
  if (chain.length === 0) {
    if (['owner', 'admin'].includes(req.membership.role)) return [requester];
    throw conflict('APPROVER_REQUIRED', 'לא נמצא מאשר הצעות פעיל');
  }
  return chain;
};

const notifyApprover = (req, userId, title, resourceType, resourceId) =>
  notify(req.organization._id, userId, { type: 'approval_requested', title, resourceType, resourceId: String(resourceId) });

const grantDealAccess = (deal, userId) =>
  deal.isConfidential
    ? CompanyDeal.updateOne({ _id: deal._id }, { $addToSet: { confidentialTo: userId } })
    : Promise.resolve();

export const submitQuote = async (req, res) => {
  const { quote, deal } = await loadQuote(req, req.params.quoteId);
  requireDealActor(req, deal);
  const chain = await quoteApproverChain(req, quote.total);
  const claimed = await CompanyQuote.findOneAndUpdate(
    { _id: quote._id, status: 'draft' },
    { $set: { status: 'in_review', approverChain: chain } },
    { new: true }
  );
  if (!claimed) throw conflict('INVALID_STATE', 'רק טיוטה ניתנת לשליחה');
  await CompanyApproval.create({
    ...scope(req), resourceType: 'quote', resourceId: quote._id, revisionId: quote._id, dealId: deal._id,
    assigneeId: chain[0], requestedBy: req.user._id, step: 1, totalSteps: chain.length,
  });
  await grantDealAccess(deal, chain[0]);
  await notifyApprover(req, chain[0], `הצעת מחיר ממתינה לאישור: ${deal.title}`, 'deal', deal._id);
  await audit(req, 'quote.submitted', 'quote', quote._id, { revision: quote.revisionNo, steps: chain.length });
  sendData(req, res, await serializeQuote(req, claimed, true));
};

export const markQuoteSent = async (req, res) => {
  const { quote, deal } = await loadQuote(req, req.params.quoteId);
  requireDealActor(req, deal);
  const updated = await CompanyQuote.findOneAndUpdate(
    { _id: quote._id, status: 'approved' },
    { $set: { status: 'sent', sentAt: new Date(), sentBy: req.user._id } },
    { new: true }
  );
  if (!updated) throw conflict('APPROVAL_REQUIRED', 'אפשר לשלוח ללקוח רק הצעה מאושרת');
  await CompanyDeal.updateOne({ _id: deal._id }, { $set: { stageId: stageAfterSent(req, deal.stageId) } });
  await audit(req, 'quote.sent', 'quote', quote._id, { revision: quote.revisionNo });
  sendData(req, res, await serializeQuote(req, updated, true));
};

const stageAfterSent = (req, current) =>
  pipelineOf(req).some((stage) => stage.id === 'quote_sent') ? 'quote_sent' : current;

export const recordQuoteAcceptance = async (req, res) => {
  const { quote, deal } = await loadQuote(req, req.params.quoteId);
  requireDealActor(req, deal);
  const acceptedBy = clean(req.body.accepted_by);
  if (!acceptedBy) throw invalid('יש לציין מי אישר בצד הלקוח');
  const updated = await CompanyQuote.findOneAndUpdate(
    { _id: quote._id, status: 'sent', acceptedAt: null },
    { $set: { acceptedAt: new Date(), acceptedBy, acceptanceNote: clean(req.body.note) } },
    { new: true }
  );
  if (!updated) throw conflict('INVALID_STATE', 'אפשר לתעד קבלה רק להצעה שנשלחה');
  await audit(req, 'quote.accepted', 'quote', quote._id, { accepted_by: acceptedBy });
  sendData(req, res, await serializeQuote(req, updated, true));
};

// ── Approvals ──

const approvalTitle = async (approval) => {
  if (approval.resourceType === 'document') {
    const document = await CompanyDocument.findById(approval.resourceId).select('title');
    return document?.title ?? 'מסמך';
  }
  const dealId = approval.dealId ?? approval.resourceId;
  const deal = await CompanyDeal.findById(dealId).select('title');
  return deal?.title ?? 'עסקה';
};

export const listApprovals = async (req, res) => {
  const approvals = await CompanyApproval.find({ ...scope(req), assigneeId: req.user._id, status: 'pending' })
    .populate('assigneeId', 'name').sort({ createdAt: -1 }).limit(100);
  sendData(req, res, await Promise.all(approvals.map(async (approval) => ({
    ...serializeApproval(req, approval),
    title: await approvalTitle(approval),
    deal_id: approval.dealId ?? (approval.resourceType === 'project_creation' ? approval.resourceId : null),
    step: approval.step,
    total_steps: approval.totalSteps,
    requested_at: approval.createdAt,
  }))));
};

const claimApproval = async (approval, decision, reason) => {
  const claimed = await CompanyApproval.findOneAndUpdate(
    { _id: approval._id, status: 'pending' },
    { $set: { status: decision, reason, decidedAt: new Date() } },
    { new: true }
  );
  // Two clicks or two devices: only the first decision counts.
  if (!claimed) throw conflict('INVALID_STATE', 'האישור כבר הוכרע');
  return claimed;
};

const setUpProjectFromDeal = async (req, deal, templateId) => {
  let project = await CompanyProject.findOne({ ...scope(req), originDealId: deal._id });
  if (project) return project;

  const ownerActive = await CompanyMember.exists({ ...scope(req), userId: deal.ownerId, status: 'active' });
  const ownerId = ownerActive ? deal.ownerId : req.user._id;
  try {
    project = await CompanyProject.create({
      ...scope(req), name: deal.title, description: 'נוצר מעסקה מאושרת', status: 'planned', ownerId, originDealId: deal._id,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return CompanyProject.findOne({ ...scope(req), originDealId: deal._id });
  }

  await CompanyProjectMember.create({ ...scope(req), projectId: project._id, userId: ownerId, role: 'manager' });
  const template = templateId && isObjectId(templateId)
    ? await CompanyProjectTemplate.findOne({ _id: templateId, ...scope(req) })
    : null;
  const tasks = template
    ? template.tasks.map((task) => ({ title: task.title, description: task.description, priority: task.priority, type: task.type }))
    : DEFAULT_KICKOFF_TASKS.map((title) => ({ title }));
  const milestone = await CompanyMilestone.create({ ...scope(req), projectId: project._id, name: 'Kickoff' });
  await CompanyTask.insertMany(tasks.map((task) => ({
    ...scope(req), ...task, projectId: project._id, milestoneId: milestone._id, createdBy: ownerId,
  })));
  await CompanyConversation.create({
    ...scope(req), type: 'project', visibility: 'private', name: project.name, projectId: project._id, createdBy: ownerId,
  });

  // Everything linked to the deal follows it into the project.
  const links = await CompanyDocumentLink.find({ ...scope(req), resourceType: 'deal', resourceId: deal._id });
  await Promise.all(links.map((link) => CompanyDocumentLink.updateOne(
    { documentId: link.documentId, resourceType: 'project', resourceId: project._id },
    { $setOnInsert: { ...scope(req), createdBy: ownerId } },
    { upsert: true }
  )));
  return project;
};

export const decideApproval = async (req, res) => {
  if (!isObjectId(req.params.approvalId)) throw notFound('האישור');
  const approval = await CompanyApproval.findOne({ _id: req.params.approvalId, ...scope(req) });
  if (!approval || !sameId(approval.assigneeId, req.user._id)) throw notFound('האישור');
  if (approval.status !== 'pending') throw conflict('INVALID_STATE', 'האישור כבר הוכרע');
  const decision = clean(req.body.decision);
  const reason = clean(req.body.reason);
  if (!['approved', 'rejected'].includes(decision)) throw invalid('החלטה לא תקינה');
  if (decision === 'rejected' && !reason) throw invalid('סיבת דחייה היא שדה חובה');

  let decided;
  if (approval.resourceType === 'document') {
    const document = await CompanyDocument.findOne({ _id: approval.resourceId, ...scope(req) });
    if (!document || !document.currentRevisionId.equals(approval.revisionId)) throw conflict('REVISION_CHANGED', 'גרסת המסמך השתנתה');
    decided = await claimApproval(approval, decision, reason);
    await Promise.all([
      CompanyDocumentRevision.updateOne({ _id: approval.revisionId }, { $set: { status: decision } }),
      CompanyDocument.updateOne({ _id: document._id }, { $set: { status: decision } }),
    ]);
  } else if (approval.resourceType === 'quote') {
    const quote = await CompanyQuote.findOne({ _id: approval.resourceId, ...scope(req) });
    if (!quote || quote.status !== 'in_review') throw conflict('REVISION_CHANGED', 'גרסת ההצעה השתנתה');
    decided = await claimApproval(approval, decision, reason);
    const nextApprover = decision === 'approved' ? quote.approverChain[approval.step] : null;
    if (nextApprover) {
      await CompanyApproval.create({
        ...scope(req), resourceType: 'quote', resourceId: quote._id, revisionId: quote._id, dealId: quote.dealId,
        assigneeId: nextApprover, requestedBy: approval.requestedBy, step: approval.step + 1, totalSteps: approval.totalSteps,
      });
      const deal = await CompanyDeal.findById(quote.dealId);
      await grantDealAccess(deal, nextApprover);
      await notifyApprover(req, nextApprover, `הצעת מחיר ממתינה לאישור: ${deal.title}`, 'deal', deal._id);
    } else {
      quote.status = decision;
      await quote.save();
      if (decision === 'approved') {
        await CompanyDeal.updateOne({ _id: quote.dealId, ...scope(req) }, { $set: { approvedQuoteId: quote._id } });
      }
    }
  } else {
    const deal = await CompanyDeal.findOne({ _id: approval.resourceId, ...scope(req) });
    if (!deal || deal.status !== 'won') throw conflict('DEAL_CHANGED', 'מצב העסקה השתנה');
    decided = await claimApproval(approval, decision, reason);
    if (decision === 'approved') {
      const project = await setUpProjectFromDeal(req, deal, req.body.template_id);
      await CompanyDeal.updateOne({ _id: deal._id }, { $set: { projectId: project._id } });
      emitToOrganization(req.organization._id, 'work_changed');
    }
  }

  if (approval.requestedBy && !sameId(approval.requestedBy, req.user._id)) {
    await notify(req.organization._id, approval.requestedBy, {
      type: 'approval_decided',
      title: `${decision === 'approved' ? 'אושר' : 'נדחה'}: ${await approvalTitle(approval)}`,
      body: reason,
      resourceType: approval.resourceType === 'document' ? 'document' : 'deal',
      resourceId: String(approval.dealId ?? approval.resourceId),
    });
  }
  await decided.populate('assigneeId', 'name');
  await audit(req, `${approval.resourceType}.${decision}`, 'approval', approval._id, { target_id: String(approval.resourceId), reason });
  sendData(req, res, serializeApproval(req, decided));
};

export const closeWon = async (req, res) => {
  const deal = await loadDeal(req, req.params.dealId);
  requireDealActor(req, deal);
  if (deal.status === 'won') return sendData(req, res, await serializeDeal(req, deal));
  if (deal.status !== 'open') throw conflict('INVALID_STATE', 'העסקה אינה פתוחה');
  const quote = deal.approvedQuoteId
    ? await CompanyQuote.findOne({ _id: deal.approvedQuoteId, status: { $in: ['approved', 'sent'] } })
    : null;
  if (!quote) throw conflict('APPROVED_QUOTE_REQUIRED', 'נדרשת הצעת מחיר מאושרת');
  if (!clean(req.get('Idempotency-Key'))) throw invalid('נדרש Idempotency-Key');

  const [approver] = await activeApprovers(req, ['owner', 'admin', 'manager'], [req.user._id]);
  const assigneeId = approver?.userId ?? (['owner', 'admin'].includes(req.membership.role) ? req.user._id : null);
  if (!assigneeId) throw conflict('APPROVER_REQUIRED', 'לא נמצא מאשר פעיל');

  // Atomic: of two simultaneous closes, only one opens a project request.
  const won = await CompanyDeal.findOneAndUpdate(
    { _id: deal._id, status: 'open' },
    { $set: { status: 'won', closedAt: new Date(), bookedValue: quote.total } },
    { new: true }
  ).populate('accountId', 'name').populate('ownerId', 'name');
  if (!won) return sendData(req, res, await serializeDeal(req, await dealForResponse(deal._id)));

  const approval = await CompanyApproval.create({
    ...scope(req), resourceType: 'project_creation', resourceId: deal._id, revisionId: deal._id,
    assigneeId, requestedBy: req.user._id,
  });
  await grantDealAccess(won, assigneeId);
  await notifyApprover(req, assigneeId, `בקשה להקמת פרויקט: ${deal.title}`, 'deal', deal._id);
  await audit(req, 'deal.won', 'deal', deal._id, { project_request_id: String(approval._id), booked: quote.total });
  sendData(req, res, await serializeDeal(req, won));
};

// ── Background: follow-up reminders ──

const FOLLOWUP_INTERVAL_MS = 15 * 60 * 1000;

export const deliverFollowupReminders = async () => {
  const due = await CompanyLead.find({
    nextFollowupAt: { $ne: null, $lte: new Date() },
    followupNotifiedAt: null,
    assignedTo: { $ne: null },
    status: { $nin: ['converted', 'disqualified', 'archived'] },
  }).limit(200);
  await Promise.all(due.map(async (lead) => {
    const claimed = await CompanyLead.findOneAndUpdate(
      { _id: lead._id, followupNotifiedAt: null },
      { $set: { followupNotifiedAt: new Date() } }
    );
    if (!claimed) return;
    await notify(lead.organizationId, lead.assignedTo, {
      type: 'lead_followup',
      title: `תזכורת מעקב: ${lead.title}`,
      resourceType: 'lead',
      resourceId: String(lead._id),
    });
  }));
};

export const startFollowupWorker = () =>
  setInterval(() => deliverFollowupReminders().catch((error) => console.error('[companyos] followups', error)), FOLLOWUP_INTERVAL_MS);
