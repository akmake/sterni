import { ApiError, isObjectId, recordAudit, sendData } from './access.js';
import { CompanyMember, CompanyProject, CompanyProjectMember } from './models.js';
import {
  CompanyAccount, CompanyApproval, CompanyContact, CompanyDeal, CompanyDocument,
  CompanyDocumentRevision, CompanyLead, CompanyQuote,
} from './knowledgeCrmModels.js';
import { serializeApproval } from './knowledgeController.js';

const scope = (req) => ({ organizationId: req.organization._id });
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const invalid = (message) => new ApiError(400, 'VALIDATION_ERROR', message);
const denied = () => new ApiError(403, 'ACCESS_DENIED', 'אין לך הרשאה לפעולה זו');
const notFound = (label = 'הרשומה') => new ApiError(404, 'NOT_FOUND', label + ' לא נמצאה');
const canManage = (req) => ['owner', 'admin', 'manager'].includes(req.membership.role);

const leadVisibility = (req) => ({
  $or: [
    { isConfidential: false }, { confidentialTo: req.user._id },
    { createdBy: req.user._id }, { assignedTo: req.user._id },
  ],
});

const loadLead = async (req, id) => {
  if (!isObjectId(id)) throw notFound('הליד');
  const lead = await CompanyLead.findOne({ _id: id, ...scope(req), ...leadVisibility(req) })
    .populate('assignedTo', 'name');
  if (!lead) throw notFound('הליד');
  return lead;
};

const duplicateCandidates = async (req, lead) => {
  const clauses = [];
  if (lead.email) clauses.push({ email: lead.email });
  if (lead.phone) clauses.push({ phone: lead.phone });
  if (lead.companyName) clauses.push({ name: lead.companyName });
  if (!clauses.length) return [];
  const accounts = await CompanyAccount.find({ ...scope(req), $or: clauses }).limit(5);
  return accounts.map((account) => ({
    id: account._id, label: account.name,
    confidence: account.email === lead.email || account.phone === lead.phone ? 0.95 : 0.7,
  }));
};

const serializeLead = async (req, lead) => ({
  id: lead._id, title: lead.title, source: lead.source, status: lead.status,
  person_name: lead.personName, company_name: lead.companyName, email: lead.email, phone: lead.phone,
  assigned_to: lead.assignedTo?._id || lead.assignedTo,
  assigned_name: lead.assignedTo?.name,
  assignment_state: lead.assignmentState, is_confidential: lead.isConfidential,
  score: lead.score, score_explanation: lead.scoreExplanation,
  next_followup_at: lead.nextFollowupAt,
  duplicate_candidates: await duplicateCandidates(req, lead),
  can_edit: canManage(req) || String(lead.assignedTo?._id || lead.assignedTo) === String(req.user._id),
  can_assign: canManage(req),
  can_convert: (canManage(req) || String(lead.assignedTo?._id || lead.assignedTo) === String(req.user._id)) &&
    lead.status === 'qualified',
  created_at: lead.createdAt,
});

const serializeDeal = async (req, deal) => {
  const projectApproval = await CompanyApproval.findOne({
    ...scope(req), resourceType: 'project_creation', resourceId: deal._id,
  }).populate('assigneeId', 'name').sort({ createdAt: -1 });
  return {
    id: deal._id, title: deal.title, account_id: deal.accountId?._id || deal.accountId,
    account_name: deal.accountId?.name, stage_id: deal.stageId, stage_name: deal.stageName,
    owner_id: deal.ownerId?._id || deal.ownerId, owner_name: deal.ownerId?.name,
    currency: deal.currency, forecast_value: deal.forecastValue, status: deal.status,
    approved_quote_id: deal.approvedQuoteId, project_id: deal.projectId,
    project_approval: projectApproval ? serializeApproval(req, projectApproval) : null,
    can_edit: canManage(req) || String(deal.ownerId?._id || deal.ownerId) === String(req.user._id),
    can_close_won: Boolean(deal.approvedQuoteId) && deal.status === 'open' &&
      (canManage(req) || String(deal.ownerId?._id || deal.ownerId) === String(req.user._id)),
    created_at: deal.createdAt,
  };
};

const serializeQuote = async (req, quote) => {
  const approvals = await CompanyApproval.find({
    ...scope(req), resourceType: 'quote', resourceId: quote._id,
  }).populate('assigneeId', 'name').sort({ createdAt: 1 });
  return {
    id: quote._id, deal_id: quote.dealId, revision_no: quote.revisionNo,
    status: quote.status, currency: quote.currency, subtotal: quote.subtotal,
    discount: quote.discount, total: quote.total, terms: quote.terms,
    lines: quote.lines.map((line) => ({
      description: line.description, quantity: line.quantity,
      unit_price: line.unitPrice, total: line.total,
    })),
    approvals: approvals.map((approval) => serializeApproval(req, approval)),
    can_edit: quote.status === 'draft',
    can_submit: quote.status === 'draft',
  };
};

export const listLeads = async (req, res) => {
  if (req.membership.role === 'guest') return sendData(req, res, []);
  const filter = { ...scope(req), ...leadVisibility(req) };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assigned_to) filter.assignedTo = req.query.assigned_to;
  const leads = await CompanyLead.find(filter).populate('assignedTo', 'name').sort({ updatedAt: -1 }).limit(200);
  sendData(req, res, await Promise.all(leads.map((lead) => serializeLead(req, lead))));
};

export const getLead = async (req, res) => {
  sendData(req, res, await serializeLead(req, await loadLead(req, req.params.leadId)));
};

export const createLead = async (req, res) => {
  if (req.membership.role === 'guest') throw denied();
  const title = clean(req.body.title);
  if (!title) throw invalid('כותרת הליד היא שדה חובה');
  const confidentialTo = req.body.is_confidential ? [req.user._id] : [];
  const lead = await CompanyLead.create({
    ...scope(req), title, source: clean(req.body.source) || 'manual',
    sourceRef: clean(req.body.source_ref), personName: clean(req.body.person_name),
    companyName: clean(req.body.company_name), email: clean(req.body.email).toLowerCase(),
    phone: clean(req.body.phone), isConfidential: Boolean(req.body.is_confidential),
    confidentialTo, createdBy: req.user._id,
  });
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'lead.created',
    resourceType: 'lead', resourceId: lead._id, metadata: { confidential: lead.isConfidential },
  });
  sendData(req, res, await serializeLead(req, lead), 201);
};

export const assignLead = async (req, res) => {
  if (!canManage(req)) throw denied();
  const lead = await loadLead(req, req.params.leadId);
  const userId = req.body.user_id;
  if (!isObjectId(userId) || !(await CompanyMember.exists({ ...scope(req), userId, status: 'active' }))) {
    throw invalid('המשתמש אינו חבר פעיל בארגון');
  }
  lead.assignedTo = userId;
  lead.assignmentState = 'pending';
  lead.status = 'assigned';
  lead.assignmentReason = '';
  if (lead.isConfidential && !lead.confidentialTo.some((id) => String(id) === String(userId))) {
    lead.confidentialTo.push(userId);
  }
  lead.version += 1;
  await lead.save();
  await lead.populate('assignedTo', 'name');
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'lead.assigned',
    resourceType: 'lead', resourceId: lead._id, metadata: { assigned_to: String(userId) },
  });
  sendData(req, res, await serializeLead(req, lead));
};

export const decideAssignment = async (req, res) => {
  const lead = await loadLead(req, req.params.leadId);
  if (String(lead.assignedTo?._id || lead.assignedTo) !== String(req.user._id)) throw denied();
  const decision = req.body.decision;
  if (!['accepted', 'rejected'].includes(decision)) throw invalid('החלטה לא תקינה');
  const reason = clean(req.body.reason);
  if (decision === 'rejected' && !reason) throw invalid('סיבת דחייה היא שדה חובה');
  lead.assignmentState = decision;
  lead.assignmentReason = reason;
  lead.status = decision === 'accepted' ? 'accepted' : 'new';
  if (decision === 'rejected') lead.assignedTo = null;
  lead.version += 1;
  await lead.save();
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'lead.assignment_' + decision,
    resourceType: 'lead', resourceId: lead._id, metadata: { reason },
  });
  sendData(req, res, await serializeLead(req, lead));
};

const TRANSITIONS = {
  new: ['assigned', 'disqualified', 'archived'],
  assigned: ['accepted', 'new', 'disqualified'],
  accepted: ['contacting', 'qualified', 'nurturing', 'disqualified'],
  contacting: ['qualified', 'nurturing', 'disqualified'],
  nurturing: ['contacting', 'qualified', 'disqualified'],
  qualified: ['converted', 'disqualified'],
};

export const transitionLead = async (req, res) => {
  const lead = await loadLead(req, req.params.leadId);
  const actorAllowed = canManage(req) || String(lead.assignedTo?._id || lead.assignedTo) === String(req.user._id);
  if (!actorAllowed) throw denied();
  const status = clean(req.body.status);
  if (!(TRANSITIONS[lead.status] || []).includes(status)) {
    throw new ApiError(409, 'INVALID_TRANSITION', 'מעבר הסטטוס אינו תקין');
  }
  const reason = clean(req.body.reason);
  if (status === 'disqualified' && !reason) throw invalid('סיבת פסילה היא שדה חובה');
  lead.status = status;
  if (status === 'disqualified') lead.lostReason = reason;
  lead.version += 1;
  await lead.save();
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'lead.status_changed',
    resourceType: 'lead', resourceId: lead._id, metadata: { status, reason },
  });
  sendData(req, res, await serializeLead(req, lead));
};

export const convertLead = async (req, res) => {
  const lead = await loadLead(req, req.params.leadId);
  const actorAllowed = canManage(req) || String(lead.assignedTo?._id || lead.assignedTo) === String(req.user._id);
  if (!actorAllowed) throw denied();
  if (lead.status === 'converted' && lead.convertedDealId) {
    const existing = await CompanyDeal.findById(lead.convertedDealId).populate('accountId', 'name').populate('ownerId', 'name');
    return sendData(req, res, await serializeDeal(req, existing));
  }
  if (lead.status !== 'qualified') throw new ApiError(409, 'INVALID_STATE', 'רק ליד מוסמך ניתן להמרה');
  const key = clean(req.get('Idempotency-Key'));
  if (!key) throw invalid('נדרש Idempotency-Key');
  const claim = await CompanyLead.updateOne(
    { _id: lead._id, ...scope(req), status: 'qualified', conversionKey: null },
    { $set: { conversionKey: key } }
  );
  if (claim.modifiedCount !== 1) {
    const current = await CompanyLead.findById(lead._id);
    if (current?.status === 'converted' && current.convertedDealId) {
      const existing = await CompanyDeal.findById(current.convertedDealId)
        .populate('accountId', 'name').populate('ownerId', 'name');
      return sendData(req, res, await serializeDeal(req, existing));
    }
    throw new ApiError(409, 'CONVERSION_IN_PROGRESS', 'המרת הליד כבר מתבצעת');
  }
  let account = null;
  let createdAccount = false;
  let contact = null;
  let deal = null;
  try {
  if (req.body.account_id) {
    account = await CompanyAccount.findOne({ _id: req.body.account_id, ...scope(req) });
    if (!account) throw invalid('הלקוח לא נמצא');
  }
  if (!account) {
    account = await CompanyAccount.create({
      ...scope(req), name: lead.companyName || lead.personName || lead.title,
      email: lead.email, phone: lead.phone, createdBy: req.user._id,
    });
    createdAccount = true;
  }
  contact = await CompanyContact.create({
    ...scope(req), accountId: account._id, name: lead.personName || lead.title,
    email: lead.email, phone: lead.phone, createdBy: req.user._id,
  });
  deal = await CompanyDeal.create({
    ...scope(req), accountId: account._id, contactId: contact._id, originLeadId: lead._id,
    title: lead.title, ownerId: lead.assignedTo?._id || lead.assignedTo || req.user._id,
  });
  lead.status = 'converted';
  lead.conversionKey = key;
  lead.convertedAccountId = account._id;
  lead.convertedContactId = contact._id;
  lead.convertedDealId = deal._id;
  lead.version += 1;
  await lead.save();
  await deal.populate('accountId', 'name');
  await deal.populate('ownerId', 'name');
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'lead.converted',
    resourceType: 'lead', resourceId: lead._id,
    metadata: { account_id: String(account._id), contact_id: String(contact._id), deal_id: String(deal._id) },
  });
  sendData(req, res, await serializeDeal(req, deal), 201);
  } catch (error) {
    if (deal) await CompanyDeal.deleteOne({ _id: deal._id });
    if (contact) await CompanyContact.deleteOne({ _id: contact._id });
    if (createdAccount && account) await CompanyAccount.deleteOne({ _id: account._id });
    await CompanyLead.updateOne(
      { _id: lead._id, conversionKey: key, status: 'qualified' },
      { $set: { conversionKey: null } }
    );
    throw error;
  }
};

export const listAccounts = async (req, res) => {
  if (req.membership.role === 'guest') return sendData(req, res, []);
  const accounts = await CompanyAccount.find(scope(req)).sort({ name: 1 }).limit(500);
  const rows = await Promise.all(accounts.map(async (account) => ({
    id: account._id, name: account.name, email: account.email, phone: account.phone,
    open_deals: await CompanyDeal.countDocuments({ ...scope(req), accountId: account._id, status: 'open' }),
  })));
  sendData(req, res, rows);
};

export const listDeals = async (req, res) => {
  if (req.membership.role === 'guest') return sendData(req, res, []);
  const filter = { ...scope(req) };
  if (req.query.stage_id) filter.stageId = req.query.stage_id;
  const deals = await CompanyDeal.find(filter).populate('accountId', 'name').populate('ownerId', 'name')
    .sort({ updatedAt: -1 }).limit(200);
  sendData(req, res, await Promise.all(deals.map((deal) => serializeDeal(req, deal))));
};

export const listQuotes = async (req, res) => {
  const deal = await CompanyDeal.findOne({ _id: req.params.dealId, ...scope(req) });
  if (!deal || req.membership.role === 'guest') throw notFound('העסקה');
  const quotes = await CompanyQuote.find({ ...scope(req), dealId: deal._id }).sort({ revisionNo: -1 });
  sendData(req, res, await Promise.all(quotes.map((quote) => serializeQuote(req, quote))));
};

export const createQuote = async (req, res) => {
  const deal = await CompanyDeal.findOne({ _id: req.params.dealId, ...scope(req) });
  if (!deal) throw notFound('העסקה');
  if (!(canManage(req) || deal.ownerId.equals(req.user._id))) throw denied();
  if (deal.status !== 'open') throw new ApiError(409, 'INVALID_STATE', 'העסקה אינה פתוחה');
  const currency = clean(req.body.currency) || deal.currency;
  if (!['ILS', 'USD', 'EUR'].includes(currency)) throw invalid('מטבע לא נתמך');
  const lines = Array.isArray(req.body.lines) ? req.body.lines.map((line) => {
    const description = clean(line.description);
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unit_price);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw invalid('שורת הצעה אינה תקינה');
    }
    return { description, quantity, unitPrice, total: quantity * unitPrice };
  }) : [];
  if (!lines.length) throw invalid('נדרשת לפחות שורת הצעה אחת');
  const previous = await CompanyQuote.findOne({ ...scope(req), dealId: deal._id }).sort({ revisionNo: -1 });
  await CompanyQuote.updateMany(
    { ...scope(req), dealId: deal._id, status: { $in: ['draft', 'in_review'] } },
    { $set: { status: 'superseded' } }
  );
  if (previous) {
    await CompanyApproval.updateMany(
      { ...scope(req), resourceType: 'quote', resourceId: previous._id, status: 'pending' },
      { $set: { status: 'superseded', reason: 'נוצרה גרסת הצעה חדשה' } }
    );
  }
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const discount = Math.max(Number(req.body.discount) || 0, 0);
  const quote = await CompanyQuote.create({
    ...scope(req), dealId: deal._id, revisionNo: (previous?.revisionNo || 0) + 1,
    currency, lines, subtotal, discount, total: Math.max(subtotal - discount, 0),
    terms: clean(req.body.terms), createdBy: req.user._id,
  });
  deal.currency = currency;
  deal.forecastValue = quote.total;
  await deal.save();
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'quote.created',
    resourceType: 'quote', resourceId: quote._id, metadata: { revision: quote.revisionNo, total: quote.total, currency },
  });
  sendData(req, res, await serializeQuote(req, quote), 201);
};

const chooseApprover = async (req) => {
  const member = await CompanyMember.findOne({
    ...scope(req), status: 'active', role: { $in: ['owner', 'admin'] },
    userId: { $ne: req.user._id },
  }).sort({ role: 1 });
  if (member) return member.userId;
  if (['owner', 'admin'].includes(req.membership.role)) return req.user._id;
  throw new ApiError(409, 'APPROVER_REQUIRED', 'לא נמצא מאשר הצעות פעיל');
};

export const submitQuote = async (req, res) => {
  const quote = await CompanyQuote.findOne({ _id: req.params.quoteId, ...scope(req) });
  if (!quote) throw notFound('הצעת המחיר');
  if (quote.status !== 'draft') throw new ApiError(409, 'INVALID_STATE', 'רק טיוטה ניתנת לשליחה');
  const deal = await CompanyDeal.findById(quote.dealId);
  if (!(canManage(req) || deal.ownerId.equals(req.user._id))) throw denied();
  await CompanyApproval.create({
    ...scope(req), resourceType: 'quote', resourceId: quote._id,
    revisionId: quote._id, assigneeId: await chooseApprover(req),
  });
  quote.status = 'in_review';
  await quote.save();
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'quote.submitted',
    resourceType: 'quote', resourceId: quote._id, metadata: { revision: quote.revisionNo },
  });
  sendData(req, res, await serializeQuote(req, quote));
};

export const decideApproval = async (req, res) => {
  if (!isObjectId(req.params.approvalId)) throw notFound('האישור');
  const approval = await CompanyApproval.findOne({ _id: req.params.approvalId, ...scope(req) });
  if (!approval || String(approval.assigneeId) !== String(req.user._id)) throw notFound('האישור');
  if (approval.status !== 'pending') throw new ApiError(409, 'INVALID_STATE', 'האישור כבר הוכרע');
  const decision = clean(req.body.decision);
  const reason = clean(req.body.reason);
  if (!['approved', 'rejected'].includes(decision)) throw invalid('החלטה לא תקינה');
  if (decision === 'rejected' && !reason) throw invalid('סיבת דחייה היא שדה חובה');
  if (approval.resourceType === 'document') {
    const document = await CompanyDocument.findOne({ _id: approval.resourceId, ...scope(req) });
    if (!document || !document.currentRevisionId.equals(approval.revisionId)) {
      throw new ApiError(409, 'REVISION_CHANGED', 'גרסת המסמך השתנתה');
    }
    const revision = await CompanyDocumentRevision.findById(approval.revisionId);
    approval.status = decision;
    approval.reason = reason;
    approval.decidedAt = new Date();
    revision.status = decision;
    document.status = decision;
    await Promise.all([approval.save(), revision.save(), document.save()]);
  } else if (approval.resourceType === 'quote') {
    const quote = await CompanyQuote.findOne({ _id: approval.resourceId, ...scope(req) });
    if (!quote || !quote._id.equals(approval.revisionId)) throw new ApiError(409, 'REVISION_CHANGED', 'גרסת ההצעה השתנתה');
    approval.status = decision;
    approval.reason = reason;
    approval.decidedAt = new Date();
    quote.status = decision;
    await Promise.all([approval.save(), quote.save()]);
    if (decision === 'approved') {
      await CompanyDeal.updateOne({ _id: quote.dealId, ...scope(req) }, { $set: { approvedQuoteId: quote._id } });
    }
  } else {
    const deal = await CompanyDeal.findOne({ _id: approval.resourceId, ...scope(req) });
    if (!deal || !deal._id.equals(approval.revisionId) || deal.status !== 'won') {
      throw new ApiError(409, 'DEAL_CHANGED', 'מצב העסקה השתנה');
    }
    approval.status = decision;
    approval.reason = reason;
    approval.decidedAt = new Date();
    if (decision === 'approved') {
      let project = await CompanyProject.findOne({ ...scope(req), originDealId: deal._id });
      if (!project) {
        try {
          project = await CompanyProject.create({
            ...scope(req), name: deal.title, description: 'נוצר מעסקה מאושרת',
            status: 'planned', ownerId: deal.ownerId, originDealId: deal._id,
          });
          await CompanyProjectMember.create({
            ...scope(req), projectId: project._id, userId: deal.ownerId, role: 'manager',
          });
        } catch (error) {
          if (error?.code !== 11000) throw error;
          project = await CompanyProject.findOne({ ...scope(req), originDealId: deal._id });
        }
      }
      deal.projectId = project._id;
      await deal.save();
    }
    await approval.save();
  }
  await approval.populate('assigneeId', 'name');
  await recordAudit(req, {
    organizationId: req.organization._id, action: approval.resourceType + '.' + decision,
    resourceType: 'approval', resourceId: approval._id,
    metadata: { target_id: String(approval.resourceId), reason },
  });
  sendData(req, res, serializeApproval(req, approval));
};

export const closeWon = async (req, res) => {
  const deal = await CompanyDeal.findOne({ _id: req.params.dealId, ...scope(req) })
    .populate('accountId', 'name').populate('ownerId', 'name');
  if (!deal) throw notFound('העסקה');
  if (!(canManage(req) || String(deal.ownerId?._id || deal.ownerId) === String(req.user._id))) throw denied();
  if (deal.status === 'won') return sendData(req, res, await serializeDeal(req, deal));
  if (!deal.approvedQuoteId || !(await CompanyQuote.exists({ _id: deal.approvedQuoteId, status: 'approved' }))) {
    throw new ApiError(409, 'APPROVED_QUOTE_REQUIRED', 'נדרשת הצעת מחיר מאושרת');
  }
  const key = clean(req.get('Idempotency-Key'));
  if (!key) throw invalid('נדרש Idempotency-Key');
  const approval = await CompanyApproval.create({
    ...scope(req), resourceType: 'project_creation', resourceId: deal._id,
    revisionId: deal._id, assigneeId: await chooseApprover(req),
  });
  deal.status = 'won';
  await deal.save();
  await recordAudit(req, {
    organizationId: req.organization._id, action: 'deal.won',
    resourceType: 'deal', resourceId: deal._id,
    metadata: { project_request_id: String(approval._id), idempotency_key: key },
  });
  sendData(req, res, await serializeDeal(req, deal));
};
