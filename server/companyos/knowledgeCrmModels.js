import mongoose from 'mongoose';

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;
const base = { timestamps: true, versionKey: false };

export const DOCUMENT_TYPES = ['spec', 'meeting_summary', 'quote', 'contract', 'sop', 'decision', 'postmortem', 'onboarding', 'other'];

const documentSchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  projectId: { type: ObjectId, ref: 'CompanyProject', default: null },
  title: { type: String, required: true, trim: true, maxlength: 300 },
  summary: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['draft', 'in_review', 'approved', 'published', 'rejected'], default: 'draft' },
  currentRevisionId: { type: ObjectId, ref: 'CompanyDocumentRevision', default: null },
  publishedRevisionId: { type: ObjectId, ref: 'CompanyDocumentRevision', default: null },
  type: { type: String, enum: DOCUMENT_TYPES, default: 'other' },
  tags: [{ type: String, trim: true, maxlength: 50 }],
  parentId: { type: ObjectId, ref: 'CompanyDocument', default: null },
  visibility: { type: String, enum: ['organization', 'restricted'], default: 'organization' },
  allowedUserIds: [{ type: ObjectId, ref: 'User' }],
  isTemplate: { type: Boolean, default: false },
  decision: { type: Schema.Types.Mixed, default: null },
  archivedAt: { type: Date, default: null },
  searchText: { type: String, default: '' },
  ownerId: { type: ObjectId, ref: 'User', required: true },
}, { ...base, collection: 'company_documents' });
documentSchema.index({ organizationId: 1, updatedAt: -1 });
documentSchema.index({ organizationId: 1, projectId: 1 });

const revisionSchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  documentId: { type: ObjectId, ref: 'CompanyDocument', required: true },
  revisionNo: { type: Number, required: true },
  title: { type: String, required: true, trim: true, maxlength: 300 },
  content: { type: String, default: '', maxlength: 200000 },
  status: { type: String, enum: ['draft', 'in_review', 'approved', 'published', 'rejected', 'superseded'], default: 'draft' },
  createdBy: { type: ObjectId, ref: 'User', required: true },
}, { ...base, collection: 'company_document_revisions' });
revisionSchema.index({ documentId: 1, revisionNo: 1 }, { unique: true });

const approvalSchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  resourceType: { type: String, enum: ['document', 'quote', 'project_creation'], required: true },
  resourceId: { type: ObjectId, required: true },
  revisionId: { type: ObjectId, required: true },
  assigneeId: { type: ObjectId, ref: 'User', required: true },
  requestedBy: { type: ObjectId, ref: 'User', default: null },
  dealId: { type: ObjectId, ref: 'CompanyDeal', default: null },
  step: { type: Number, default: 1 },
  totalSteps: { type: Number, default: 1 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'superseded'], default: 'pending' },
  reason: { type: String, default: '', maxlength: 2000 },
  decidedAt: { type: Date, default: null },
}, { ...base, collection: 'company_approvals' });
approvalSchema.index({ organizationId: 1, assigneeId: 1, status: 1 });
approvalSchema.index({ resourceType: 1, resourceId: 1, revisionId: 1 });

const leadSchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  title: { type: String, required: true, trim: true, maxlength: 300 },
  source: { type: String, default: 'manual', maxlength: 100 },
  sourceRef: { type: String, default: '', maxlength: 300 },
  personName: { type: String, default: '', maxlength: 200 },
  companyName: { type: String, default: '', maxlength: 200 },
  email: { type: String, default: '', lowercase: true, trim: true, maxlength: 320 },
  phone: { type: String, default: '', trim: true, maxlength: 50 },
  status: { type: String, enum: ['new', 'assigned', 'accepted', 'contacting', 'qualified', 'converted', 'nurturing', 'disqualified', 'archived'], default: 'new' },
  assignedTo: { type: ObjectId, ref: 'User', default: null },
  assignmentState: { type: String, enum: ['unassigned', 'pending', 'accepted', 'rejected'], default: 'unassigned' },
  assignmentReason: { type: String, default: '', maxlength: 1000 },
  isConfidential: { type: Boolean, default: false },
  confidentialTo: [{ type: ObjectId, ref: 'User' }],
  score: { type: Number, min: 0, max: 100, default: null },
  scoreExplanation: { type: String, default: '', maxlength: 2000 },
  nextFollowupAt: { type: Date, default: null },
  followupNotifiedAt: { type: Date, default: null },
  lastContactAt: { type: Date, default: null },
  labels: [{ type: String, trim: true, maxlength: 50 }],
  disqualifiedAt: { type: Date, default: null },
  disqualifiedBy: { type: ObjectId, ref: 'User', default: null },
  lostReason: { type: String, default: '', maxlength: 2000 },
  convertedAccountId: { type: ObjectId, ref: 'CompanyAccount', default: null },
  convertedContactId: { type: ObjectId, ref: 'CompanyContact', default: null },
  convertedDealId: { type: ObjectId, ref: 'CompanyDeal', default: null },
  conversionKey: { type: String, default: null },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  version: { type: Number, default: 1 },
}, { ...base, collection: 'company_leads' });
leadSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
leadSchema.index({ organizationId: 1, email: 1 });
leadSchema.index({ organizationId: 1, phone: 1 });
leadSchema.index({ organizationId: 1, conversionKey: 1 }, { unique: true, partialFilterExpression: { conversionKey: { $type: 'string' } } });

const accountSchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  name: { type: String, required: true, trim: true, maxlength: 250 },
  email: { type: String, default: '', lowercase: true, trim: true },
  phone: { type: String, default: '', trim: true },
  isConfidential: { type: Boolean, default: false },
  confidentialTo: [{ type: ObjectId, ref: 'User' }],
  createdBy: { type: ObjectId, ref: 'User', required: true },
}, { ...base, collection: 'company_accounts' });
accountSchema.index({ organizationId: 1, name: 1 });

const contactSchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  accountId: { type: ObjectId, ref: 'CompanyAccount', required: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  email: { type: String, default: '', lowercase: true, trim: true },
  phone: { type: String, default: '', trim: true },
  createdBy: { type: ObjectId, ref: 'User', required: true },
}, { ...base, collection: 'company_contacts' });
contactSchema.index({ organizationId: 1, email: 1 });

const dealSchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  accountId: { type: ObjectId, ref: 'CompanyAccount', required: true },
  contactId: { type: ObjectId, ref: 'CompanyContact', default: null },
  originLeadId: { type: ObjectId, ref: 'CompanyLead', default: null },
  title: { type: String, required: true, trim: true, maxlength: 300 },
  ownerId: { type: ObjectId, ref: 'User', required: true },
  stageId: { type: String, default: 'discovery' },
  bookedValue: { type: Number, min: 0, default: null },
  lostReason: { type: String, default: '', maxlength: 2000 },
  closedAt: { type: Date, default: null },
  isConfidential: { type: Boolean, default: false },
  confidentialTo: [{ type: ObjectId, ref: 'User' }],
  currency: { type: String, enum: ['ILS', 'USD', 'EUR'], default: 'ILS' },
  forecastValue: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['open', 'won', 'lost'], default: 'open' },
  approvedQuoteId: { type: ObjectId, ref: 'CompanyQuote', default: null },
  projectId: { type: ObjectId, ref: 'CompanyProject', default: null },
}, { ...base, collection: 'company_deals' });
dealSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
dealSchema.index({ organizationId: 1, originLeadId: 1 }, { unique: true, partialFilterExpression: { originLeadId: { $type: 'objectId' } } });

const quoteLineSchema = new Schema({
  description: { type: String, required: true, maxlength: 500 },
  quantity: { type: Number, min: 0.001, required: true },
  unitPrice: { type: Number, min: 0, required: true },
  total: { type: Number, min: 0, required: true },
}, { _id: false });

const quoteSchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  dealId: { type: ObjectId, ref: 'CompanyDeal', required: true },
  revisionNo: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'in_review', 'approved', 'rejected', 'sent', 'superseded'], default: 'draft' },
  currency: { type: String, enum: ['ILS', 'USD', 'EUR'], default: 'ILS' },
  lines: { type: [quoteLineSchema], default: [] },
  subtotal: { type: Number, min: 0, default: 0 },
  discount: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 },
  terms: { type: String, default: '', maxlength: 10000 },
  approverChain: [{ type: ObjectId, ref: 'User' }],
  sentAt: { type: Date, default: null },
  sentBy: { type: ObjectId, ref: 'User', default: null },
  acceptedAt: { type: Date, default: null },
  acceptedBy: { type: String, default: '', maxlength: 200 },
  acceptanceNote: { type: String, default: '', maxlength: 2000 },
  createdBy: { type: ObjectId, ref: 'User', required: true },
}, { ...base, collection: 'company_quotes' });
quoteSchema.index({ dealId: 1, revisionNo: 1 }, { unique: true });

const crmActivitySchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  resourceType: { type: String, enum: ['lead', 'deal', 'account'], required: true },
  resourceId: { type: ObjectId, required: true },
  type: { type: String, enum: ['note', 'call', 'meeting', 'email'], required: true },
  body: { type: String, required: true, maxlength: 5000 },
  occurredAt: { type: Date, required: true },
  actorId: { type: ObjectId, ref: 'User', required: true },
}, { ...base, collection: 'company_crm_activities' });
crmActivitySchema.index({ resourceType: 1, resourceId: 1, occurredAt: -1 });

const documentLinkSchema = new Schema({
  organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
  documentId: { type: ObjectId, ref: 'CompanyDocument', required: true },
  resourceType: { type: String, enum: ['project', 'task', 'deal', 'lead', 'account'], required: true },
  resourceId: { type: ObjectId, required: true },
  createdBy: { type: ObjectId, ref: 'User', required: true },
}, { ...base, collection: 'company_document_links' });
documentLinkSchema.index({ documentId: 1, resourceType: 1, resourceId: 1 }, { unique: true });
documentLinkSchema.index({ organizationId: 1, resourceType: 1, resourceId: 1 });

export const CompanyCrmActivity = mongoose.models.CompanyCrmActivity || mongoose.model('CompanyCrmActivity', crmActivitySchema);
export const CompanyDocumentLink = mongoose.models.CompanyDocumentLink || mongoose.model('CompanyDocumentLink', documentLinkSchema);
export const CompanyDocument = mongoose.models.CompanyDocument || mongoose.model('CompanyDocument', documentSchema);
export const CompanyDocumentRevision = mongoose.models.CompanyDocumentRevision || mongoose.model('CompanyDocumentRevision', revisionSchema);
export const CompanyApproval = mongoose.models.CompanyApproval || mongoose.model('CompanyApproval', approvalSchema);
export const CompanyLead = mongoose.models.CompanyLead || mongoose.model('CompanyLead', leadSchema);
export const CompanyAccount = mongoose.models.CompanyAccount || mongoose.model('CompanyAccount', accountSchema);
export const CompanyContact = mongoose.models.CompanyContact || mongoose.model('CompanyContact', contactSchema);
export const CompanyDeal = mongoose.models.CompanyDeal || mongoose.model('CompanyDeal', dealSchema);
export const CompanyQuote = mongoose.models.CompanyQuote || mongoose.model('CompanyQuote', quoteSchema);
