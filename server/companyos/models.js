import mongoose from 'mongoose';

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

export const ROLES = ['owner', 'admin', 'manager', 'member', 'guest'];
export const MEMBER_STATUSES = ['active', 'suspended', 'left'];

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false, collection: 'company_organizations' }
);

const memberSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: MEMBER_STATUSES, default: 'active' },
  },
  { timestamps: true, versionKey: false, collection: 'company_members' }
);
memberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
memberSchema.index({ userId: 1, status: 1 });

const inviteSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    // Only the hash is stored: a database leak must not expose usable links.
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: ObjectId, ref: 'User', required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, collection: 'company_invites' }
);
inviteSchema.index({ organizationId: 1, status: 1, email: 1 });

// Append-only: no API or code path updates or deletes these records.
const auditLogSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    actorId: { type: ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    requestId: { type: String },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: 'company_audit_logs' }
);
auditLogSchema.index({ organizationId: 1, _id: -1 });

// ── Work: projects, tasks, requirements, tests ──

export const PROJECT_STATUSES = ['planned', 'active', 'on_hold', 'blocked', 'completed', 'cancelled'];
export const PROJECT_ROLES = ['manager', 'contributor', 'viewer'];
export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled'];
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const TASK_TYPES = ['task', 'feature', 'bug', 'tech_debt', 'incident', 'spike'];
export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const REQUIREMENT_STATUSES = ['draft', 'approved', 'implemented', 'verified'];
export const TEST_RESULTS = ['not_run', 'pass', 'fail'];

const projectSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    status: { type: String, enum: PROJECT_STATUSES, default: 'planned' },
    ownerId: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'company_projects' }
);
projectSchema.index({ organizationId: 1, _id: -1 });

const projectMemberSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    projectId: { type: ObjectId, ref: 'CompanyProject', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, enum: PROJECT_ROLES, required: true },
  },
  { timestamps: true, versionKey: false, collection: 'company_project_members' }
);
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMemberSchema.index({ organizationId: 1, userId: 1 });

const taskSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    projectId: { type: ObjectId, ref: 'CompanyProject', required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '', maxlength: 10000 },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    type: { type: String, enum: TASK_TYPES, default: 'task' },
    severity: { type: String, enum: SEVERITIES, default: null },
    resolution: { type: String, default: '', maxlength: 5000 },
    assigneeId: { type: ObjectId, ref: 'User', default: null },
    dueAt: { type: Date, default: null },
    blockedBy: [{ type: ObjectId, ref: 'CompanyTask' }],
    labels: [{ type: String, trim: true, maxlength: 50 }],
    version: { type: Number, default: 1 },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'company_tasks' }
);
taskSchema.index({ organizationId: 1, projectId: 1, status: 1 });
taskSchema.index({ organizationId: 1, assigneeId: 1, status: 1 });

const requirementSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    projectId: { type: ObjectId, ref: 'CompanyProject', required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '', maxlength: 10000 },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    status: { type: String, enum: REQUIREMENT_STATUSES, default: 'draft' },
    revision: { type: Number, default: 1 },
    taskIds: [{ type: ObjectId, ref: 'CompanyTask' }],
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'company_requirements' }
);
requirementSchema.index({ organizationId: 1, projectId: 1 });

const testCaseSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    projectId: { type: ObjectId, ref: 'CompanyProject', required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    steps: { type: String, default: '', maxlength: 10000 },
    expected: { type: String, default: '', maxlength: 5000 },
    actual: { type: String, default: '', maxlength: 5000 },
    result: { type: String, enum: TEST_RESULTS, default: 'not_run' },
    requirementId: { type: ObjectId, ref: 'CompanyRequirement', default: null },
    taskId: { type: ObjectId, ref: 'CompanyTask', default: null },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'company_test_cases' }
);
testCaseSchema.index({ organizationId: 1, projectId: 1 });

// ── Messaging ──

const conversationSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    type: { type: String, enum: ['channel', 'dm'], required: true },
    visibility: { type: String, enum: ['public', 'private'], default: 'private' },
    name: { type: String, trim: true, maxlength: 80, default: null },
    dmKey: { type: String, default: undefined },
    lastSeq: { type: Number, default: 0 },
    lastMessage: {
      body: { type: String, default: null },
      authorName: { type: String, default: null },
      at: { type: Date, default: null },
    },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'company_conversations' }
);
conversationSchema.index(
  { organizationId: 1, dmKey: 1 },
  { unique: true, partialFilterExpression: { dmKey: { $type: 'string' } } }
);
conversationSchema.index({ organizationId: 1, updatedAt: -1 });

const conversationMemberSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    conversationId: { type: ObjectId, ref: 'CompanyConversation', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    lastReadSeq: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false, collection: 'company_conversation_members' }
);
conversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationMemberSchema.index({ organizationId: 1, userId: 1 });

const messageSchema = new Schema(
  {
    organizationId: { type: ObjectId, ref: 'CompanyOrganization', required: true },
    conversationId: { type: ObjectId, ref: 'CompanyConversation', required: true },
    authorId: { type: ObjectId, ref: 'User', required: true },
    seq: { type: Number, required: true },
    body: { type: String, default: '', maxlength: 10000 },
    clientId: { type: String, default: undefined },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: 'company_messages' }
);
messageSchema.index({ conversationId: 1, seq: 1 }, { unique: true });
// A retried send (same client_id) can never create a second message.
messageSchema.index(
  { conversationId: 1, authorId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }
);

export const CompanyConversation =
  mongoose.models.CompanyConversation || mongoose.model('CompanyConversation', conversationSchema);
export const CompanyConversationMember =
  mongoose.models.CompanyConversationMember || mongoose.model('CompanyConversationMember', conversationMemberSchema);
export const CompanyMessage =
  mongoose.models.CompanyMessage || mongoose.model('CompanyMessage', messageSchema);

export const CompanyProject =
  mongoose.models.CompanyProject || mongoose.model('CompanyProject', projectSchema);
export const CompanyProjectMember =
  mongoose.models.CompanyProjectMember || mongoose.model('CompanyProjectMember', projectMemberSchema);
export const CompanyTask =
  mongoose.models.CompanyTask || mongoose.model('CompanyTask', taskSchema);
export const CompanyRequirement =
  mongoose.models.CompanyRequirement || mongoose.model('CompanyRequirement', requirementSchema);
export const CompanyTestCase =
  mongoose.models.CompanyTestCase || mongoose.model('CompanyTestCase', testCaseSchema);

export const CompanyOrganization =
  mongoose.models.CompanyOrganization || mongoose.model('CompanyOrganization', organizationSchema);
export const CompanyMember =
  mongoose.models.CompanyMember || mongoose.model('CompanyMember', memberSchema);
export const CompanyInvite =
  mongoose.models.CompanyInvite || mongoose.model('CompanyInvite', inviteSchema);
export const CompanyAuditLog =
  mongoose.models.CompanyAuditLog || mongoose.model('CompanyAuditLog', auditLogSchema);
