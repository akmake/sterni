import api from '@/utils/api';

const data = (response) => response.data.data;

export const companyApi = {
  me: () => api.get('/v1/me').then(data),
  createOrganization: (name) => api.post('/v1/orgs', { name }).then(data),
  updateOrganization: (orgId, name) => api.patch(`/v1/orgs/${orgId}`, { name }).then(data),

  // Returns the whole body: `meta` carries the roles this user may assign.
  members: (orgId) => api.get(`/v1/orgs/${orgId}/members`).then((r) => r.data),
  updateMember: (orgId, memberId, changes) =>
    api.patch(`/v1/orgs/${orgId}/members/${memberId}`, changes).then(data),

  invites: (orgId) => api.get(`/v1/orgs/${orgId}/invites`).then((r) => r.data),
  createInvite: (orgId, email, role) =>
    api.post(`/v1/orgs/${orgId}/invites`, { email, role }).then(data),
  revokeInvite: (orgId, inviteId) => api.delete(`/v1/orgs/${orgId}/invites/${inviteId}`).then(data),

  audit: (orgId, cursor) =>
    api.get(`/v1/orgs/${orgId}/audit`, { params: { cursor } }).then((r) => r.data),

  getInvite: (token) => api.get(`/v1/invites/${token}`).then(data),
  acceptInvite: (token, body) => api.post(`/v1/invites/${token}/accept`, body).then(data),

  projects: (orgId) => api.get(`/v1/orgs/${orgId}/projects`).then((r) => r.data),
  project: (orgId, id) => api.get(`/v1/orgs/${orgId}/projects/${id}`).then(data),
  createProject: (orgId, body) => api.post(`/v1/orgs/${orgId}/projects`, body).then(data),
  updateProject: (orgId, id, body) => api.patch(`/v1/orgs/${orgId}/projects/${id}`, body).then(data),

  projectMembers: (orgId, id) => api.get(`/v1/orgs/${orgId}/projects/${id}/members`).then(data),
  addProjectMember: (orgId, id, body) => api.post(`/v1/orgs/${orgId}/projects/${id}/members`, body).then(data),
  updateProjectMember: (orgId, id, memberId, role) =>
    api.patch(`/v1/orgs/${orgId}/projects/${id}/members/${memberId}`, { role }).then(data),
  removeProjectMember: (orgId, id, memberId) =>
    api.delete(`/v1/orgs/${orgId}/projects/${id}/members/${memberId}`).then(data),

  tasks: (orgId, params) => api.get(`/v1/orgs/${orgId}/tasks`, { params }).then((r) => r.data),
  createTask: (orgId, body) => api.post(`/v1/orgs/${orgId}/tasks`, body).then(data),
  updateTask: (orgId, id, body) => api.patch(`/v1/orgs/${orgId}/tasks/${id}`, body).then(data),

  bulkUpdateTasks: (orgId, body) => api.patch(`/v1/orgs/${orgId}/tasks/bulk`, body).then(data),
  taskComments: (orgId, id) => api.get(`/v1/orgs/${orgId}/tasks/${id}/comments`).then(data),
  addTaskComment: (orgId, id, body) => api.post(`/v1/orgs/${orgId}/tasks/${id}/comments`, { body }).then(data),
  deleteTaskComment: (orgId, id, commentId) => api.delete(`/v1/orgs/${orgId}/tasks/${id}/comments/${commentId}`).then(data),
  taskTime: (orgId, id) => api.get(`/v1/orgs/${orgId}/tasks/${id}/time`).then((r) => r.data),
  addTaskTime: (orgId, id, minutes) => api.post(`/v1/orgs/${orgId}/tasks/${id}/time`, { minutes }).then(data),
  deleteTaskTime: (orgId, id, entryId) => api.delete(`/v1/orgs/${orgId}/tasks/${id}/time/${entryId}`).then(data),
  timeSummary: (orgId, id) => api.get(`/v1/orgs/${orgId}/projects/${id}/time-summary`).then(data),
  planItems: (orgId, id, kind) => api.get(`/v1/orgs/${orgId}/projects/${id}/${kind}`).then(data),
  createPlanItem: (orgId, id, kind, body) => api.post(`/v1/orgs/${orgId}/projects/${id}/${kind}`, body).then(data),
  updatePlanItem: (orgId, id, kind, itemId, body) => api.patch(`/v1/orgs/${orgId}/projects/${id}/${kind}/${itemId}`, body).then(data),
  deletePlanItem: (orgId, id, kind, itemId) => api.delete(`/v1/orgs/${orgId}/projects/${id}/${kind}/${itemId}`).then(data),
  templates: (orgId) => api.get(`/v1/orgs/${orgId}/project-templates`).then(data),
  saveAsTemplate: (orgId, id, name) => api.post(`/v1/orgs/${orgId}/projects/${id}/save-as-template`, { name }).then(data),
  projectFromTemplate: (orgId, templateId, name) =>
    api.post(`/v1/orgs/${orgId}/projects/from-template`, { template_id: templateId, name }).then(data),
  workload: (orgId) => api.get(`/v1/orgs/${orgId}/workload`).then(data),

  requirements: (orgId, id) => api.get(`/v1/orgs/${orgId}/projects/${id}/requirements`).then(data),
  createRequirement: (orgId, id, body) => api.post(`/v1/orgs/${orgId}/projects/${id}/requirements`, body).then(data),
  updateRequirement: (orgId, id, requirementId, body) =>
    api.patch(`/v1/orgs/${orgId}/projects/${id}/requirements/${requirementId}`, body).then(data),

  tests: (orgId, id) => api.get(`/v1/orgs/${orgId}/projects/${id}/tests`).then(data),
  createTest: (orgId, id, body) => api.post(`/v1/orgs/${orgId}/projects/${id}/tests`, body).then(data),
  updateTest: (orgId, id, testId, body) =>
    api.patch(`/v1/orgs/${orgId}/projects/${id}/tests/${testId}`, body).then(data),

  home: (orgId) => api.get(`/v1/orgs/${orgId}/home`).then(data),

  conversations: (orgId) => api.get(`/v1/orgs/${orgId}/conversations`).then(data),
  createChannel: (orgId, body) => api.post(`/v1/orgs/${orgId}/conversations`, body).then(data),
  openDirectMessage: (orgId, userId) =>
    api.post(`/v1/orgs/${orgId}/conversations/dm`, { user_id: userId }).then(data),
  messages: (orgId, id, beforeSeq) =>
    api.get(`/v1/orgs/${orgId}/conversations/${id}/messages`, { params: { before_seq: beforeSeq } }).then((r) => r.data),
  sendMessage: (orgId, id, message) =>
    api.post(`/v1/orgs/${orgId}/conversations/${id}/messages`, message).then(data),
  createGroup: (orgId, userIds) => api.post(`/v1/orgs/${orgId}/conversations/group`, { user_ids: userIds }).then(data),
  openProjectConversation: (orgId, projectId) =>
    api.post(`/v1/orgs/${orgId}/projects/${projectId}/conversation`, {}).then(data),
  replies: (orgId, id, messageId) =>
    api.get(`/v1/orgs/${orgId}/conversations/${id}/messages/${messageId}/replies`).then(data),
  toggleReaction: (orgId, id, messageId, emoji) =>
    api.post(`/v1/orgs/${orgId}/conversations/${id}/messages/${messageId}/reactions`, { emoji }).then(data),
  togglePin: (orgId, id, messageId) =>
    api.post(`/v1/orgs/${orgId}/conversations/${id}/messages/${messageId}/pin`, {}).then(data),
  pins: (orgId, id) => api.get(`/v1/orgs/${orgId}/conversations/${id}/pins`).then(data),
  saveMessage: (orgId, id, messageId, remindAt) =>
    api.post(`/v1/orgs/${orgId}/conversations/${id}/messages/${messageId}/save`, { remind_at: remindAt }).then(data),
  savedMessages: (orgId) => api.get(`/v1/orgs/${orgId}/saved-messages`).then(data),
  markUnread: (orgId, id, seq) => api.post(`/v1/orgs/${orgId}/conversations/${id}/unread`, { seq }).then(data),
  setMuted: (orgId, id, muted) => api.patch(`/v1/orgs/${orgId}/conversations/${id}/settings`, { muted }).then(data),
  searchMessages: (orgId, q) => api.get(`/v1/orgs/${orgId}/messages/search`, { params: { q } }).then(data),
  taskFromMessage: (orgId, id, messageId, projectId) =>
    api.post(`/v1/orgs/${orgId}/conversations/${id}/messages/${messageId}/task`, { project_id: projectId }).then(data),
  uploadFile: (orgId, id, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/v1/orgs/${orgId}/conversations/${id}/files`, form).then(data);
  },
  fileUrl: (orgId, fileId) => `/api/v1/orgs/${orgId}/files/${fileId}`,
  notifications: (orgId) => api.get(`/v1/orgs/${orgId}/notifications`).then((r) => r.data),
  markNotificationsRead: (orgId, ids) => api.post(`/v1/orgs/${orgId}/notifications/read`, { ids }).then(data),
  updatePresence: (orgId, body) => api.patch(`/v1/orgs/${orgId}/presence`, body).then(data),
  search: (orgId, q, type) =>
    api.get('/v1/orgs/' + orgId + '/search', { params: { q, type: type === 'all' ? undefined : type } }).then(data),
  documents: (orgId, params) => api.get('/v1/orgs/' + orgId + '/documents', { params }).then(data),
  document: (orgId, id) => api.get('/v1/orgs/' + orgId + '/documents/' + id).then(data),
  createDocument: (orgId, body) => api.post('/v1/orgs/' + orgId + '/documents', body).then(data),
  createDocumentRevision: (orgId, id, body) =>
    api.post('/v1/orgs/' + orgId + '/documents/' + id + '/revisions', body).then(data),
  submitDocument: (orgId, id) =>
    api.post('/v1/orgs/' + orgId + '/documents/' + id + '/submit-for-approval', {}).then(data),
  publishDocument: (orgId, id) =>
    api.post('/v1/orgs/' + orgId + '/documents/' + id + '/publish', {}).then(data),
  decideApproval: (orgId, id, decision, reason, templateId) =>
    api.post('/v1/orgs/' + orgId + '/approvals/' + id + '/decide', { decision, reason, template_id: templateId || undefined }).then(data),
  approvals: (orgId) => api.get(`/v1/orgs/${orgId}/approvals`).then(data),
  updateDocument: (orgId, id, body) => api.patch(`/v1/orgs/${orgId}/documents/${id}`, body).then(data),
  restoreRevision: (orgId, id, revisionId) =>
    api.post(`/v1/orgs/${orgId}/documents/${id}/restore`, { revision_id: revisionId }).then(data),
  archiveDocument: (orgId, id, archived) => api.post(`/v1/orgs/${orgId}/documents/${id}/archive`, { archived }).then(data),
  addDocumentLink: (orgId, id, type, resourceId) =>
    api.post(`/v1/orgs/${orgId}/documents/${id}/links`, { resource_type: type, resource_id: resourceId }).then(data),
  removeDocumentLink: (orgId, id, linkId) => api.delete(`/v1/orgs/${orgId}/documents/${id}/links/${linkId}`).then(data),
  uploadDocumentFile: (orgId, id, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/v1/orgs/${orgId}/documents/${id}/files`, form).then(data);
  },
  lead: (orgId, id) => api.get(`/v1/orgs/${orgId}/leads/${id}`).then(data),
  updateLead: (orgId, id, body) => api.patch(`/v1/orgs/${orgId}/leads/${id}`, body).then(data),
  leadsExportUrl: (orgId) => `/api/v1/orgs/${orgId}/leads/export`,
  crmActivities: (orgId, type, id) => api.get(`/v1/orgs/${orgId}/crm/${type}/${id}/activities`).then(data),
  addCrmActivity: (orgId, type, id, body) => api.post(`/v1/orgs/${orgId}/crm/${type}/${id}/activities`, body).then(data),
  pipeline: (orgId) => api.get(`/v1/orgs/${orgId}/pipeline`).then(data),
  account: (orgId, id) => api.get(`/v1/orgs/${orgId}/accounts/${id}`).then(data),
  createAccount: (orgId, body) => api.post(`/v1/orgs/${orgId}/accounts`, body).then(data),
  addContact: (orgId, id, body) => api.post(`/v1/orgs/${orgId}/accounts/${id}/contacts`, body).then(data),
  createDeal: (orgId, body) => api.post(`/v1/orgs/${orgId}/deals`, body).then(data),
  moveDealStage: (orgId, id, stageId) => api.post(`/v1/orgs/${orgId}/deals/${id}/stage`, { stage_id: stageId }).then(data),
  closeLost: (orgId, id, reason) => api.post(`/v1/orgs/${orgId}/deals/${id}/close-lost`, { reason }).then(data),
  markQuoteSent: (orgId, id) => api.post(`/v1/orgs/${orgId}/quotes/${id}/mark-sent`, {}).then(data),
  recordQuoteAcceptance: (orgId, id, acceptedBy) =>
    api.post(`/v1/orgs/${orgId}/quotes/${id}/record-acceptance`, { accepted_by: acceptedBy }).then(data),

  leads: (orgId) => api.get('/v1/orgs/' + orgId + '/leads').then(data),
  createLead: (orgId, body) => api.post('/v1/orgs/' + orgId + '/leads', body).then(data),
  assignLead: (orgId, id, userId) =>
    api.post('/v1/orgs/' + orgId + '/leads/' + id + '/assign', { user_id: userId }).then(data),
  decideLeadAssignment: (orgId, id, decision, reason) =>
    api.post('/v1/orgs/' + orgId + '/leads/' + id + '/assignment-decision', { decision, reason }).then(data),
  transitionLead: (orgId, id, status, reason) =>
    api.post('/v1/orgs/' + orgId + '/leads/' + id + '/transition', { status, reason }).then(data),
  convertLead: (orgId, id, accountId) =>
    api.post('/v1/orgs/' + orgId + '/leads/' + id + '/convert', { account_id: accountId || '' }, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }).then(data),
  accounts: (orgId) => api.get('/v1/orgs/' + orgId + '/accounts').then(data),
  deals: (orgId) => api.get('/v1/orgs/' + orgId + '/deals').then(data),
  quotes: (orgId, dealId) => api.get('/v1/orgs/' + orgId + '/deals/' + dealId + '/quotes').then(data),
  createQuote: (orgId, dealId, body) =>
    api.post('/v1/orgs/' + orgId + '/deals/' + dealId + '/quotes', body).then(data),
  submitQuote: (orgId, id) =>
    api.post('/v1/orgs/' + orgId + '/quotes/' + id + '/submit-for-approval', {}).then(data),
  closeWon: (orgId, dealId) =>
    api.post('/v1/orgs/' + orgId + '/deals/' + dealId + '/close-won', {}, {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }).then(data),

  editMessage: (orgId, id, messageId, body) =>
    api.patch(`/v1/orgs/${orgId}/conversations/${id}/messages/${messageId}`, { body }).then(data),
  deleteMessage: (orgId, id, messageId) =>
    api.delete(`/v1/orgs/${orgId}/conversations/${id}/messages/${messageId}`).then(data),
  markRead: (orgId, id, seq) => api.post(`/v1/orgs/${orgId}/conversations/${id}/read`, { seq }).then(data),

  pushConfig: () => api.get('/v1/push').then(data),
  pushSubscribe: (subscription) => api.post('/v1/push/subscribe', subscription).then(data),
  pushUnsubscribe: (endpoint) => api.post('/v1/push/unsubscribe', { endpoint }).then(data),
  mfaSetup: () => api.post('/v1/mfa/setup', {}).then(data),
  mfaEnable: (code) => api.post('/v1/mfa/enable', { code }).then(data),
  mfaVerify: (code) => api.post('/v1/mfa/verify', { code }).then(data),
  mfaDisable: (code) => api.post('/v1/mfa/disable', { code }).then(data),
  updateOrganizationSettings: (orgId, body) => api.patch(`/v1/orgs/${orgId}`, body).then(data),

  teams: (orgId) => api.get(`/v1/orgs/${orgId}/teams`).then(data),
  createTeam: (orgId, name) => api.post(`/v1/orgs/${orgId}/teams`, { name }).then(data),
  deleteTeam: (orgId, id) => api.delete(`/v1/orgs/${orgId}/teams/${id}`).then(data),
  addTeamMember: (orgId, id, userId) => api.post(`/v1/orgs/${orgId}/teams/${id}/members`, { user_id: userId }).then(data),
  removeTeamMember: (orgId, id, userId) => api.delete(`/v1/orgs/${orgId}/teams/${id}/members/${userId}`).then(data),

  login: (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
};

export const errorMessage = (error, fallback = 'משהו השתבש, נסה שוב') =>
  error?.response?.data?.error?.message || error?.response?.data?.message || fallback;

export const errorCode = (error) => error?.response?.data?.error?.code;

export const ROLE_LABELS = {
  owner: 'בעלים',
  admin: 'מנהל מערכת',
  manager: 'מנהל',
  member: 'חבר צוות',
  guest: 'אורח',
};

export const AVAILABILITY_LABELS = { active: 'זמין', away: 'לא בעמדה', dnd: 'נא לא להפריע' };

export const STATUS_LABELS = {
  active: 'פעיל',
  suspended: 'מושעה',
  left: 'עזב',
};

export const AUDIT_LABELS = {
  'organization.created': 'הארגון נוצר',
  'organization.updated': 'פרטי הארגון עודכנו',
  'member.updated': 'חבר צוות עודכן',
  'invite.created': 'נשלחה הזמנה',
  'invite.revoked': 'הזמנה בוטלה',
  'invite.accepted': 'הזמנה התקבלה',
  'conversation.created': 'ערוץ נוצר',
  'conversation.member_added': 'חבר נוסף לערוץ',
  'project.created': 'פרויקט נוצר',
  'auth.login': 'כניסה למערכת',
  'auth.login_failed': 'ניסיון כניסה שנכשל',
  'member.role_expired': 'הרשאה זמנית הסתיימה',
  'organization.mfa_policy_changed': 'מדיניות אימות דו-שלבי השתנתה',
  'team.created': 'צוות נוצר',
  'team.deleted': 'צוות נמחק',
  'team.member_added': 'חבר נוסף לצוות',
  'team.member_removed': 'חבר הוסר מצוות',
  'project.status_changed': 'סטטוס פרויקט השתנה',
  'project.member_added': 'חבר נוסף לפרויקט',
  'project.member_updated': 'תפקיד בפרויקט השתנה',
  'project.member_removed': 'חבר הוסר מפרויקט',
  'task.created': 'משימה נוצרה',
  'task.updated': 'משימה עודכנה',
  'task.bulk_updated': 'עדכון מרובה של משימות',
  'template.created': 'תבנית נוצרה',
  'requirement.created': 'דרישה נוצרה',
  'test.created': 'בדיקה נוצרה',
  'test.result_recorded': 'תוצאת בדיקה נרשמה',
  'document.created': 'מסמך נוצר',
  'document.revision_created': 'נוצרה גרסת מסמך',
  'document.submitted': 'מסמך נשלח לאישור',
  'document.published': 'מסמך פורסם',
  'lead.created': 'ליד נוצר',
  'lead.assigned': 'ליד שויך',
  'lead.assignment_accepted': 'אחריות על ליד התקבלה',
  'lead.assignment_rejected': 'שיוך ליד נדחה',
  'lead.status_changed': 'סטטוס ליד השתנה',
  'lead.converted': 'ליד הומר לעסקה',
  'quote.created': 'הצעת מחיר נוצרה',
  'quote.submitted': 'הצעת מחיר נשלחה לאישור',
  'quote.approved': 'הצעת מחיר אושרה',
  'quote.rejected': 'הצעת מחיר נדחתה',
  'document.approved': 'מסמך אושר',
  'document.rejected': 'מסמך נדחה',
  'project_creation.approved': 'הקמת פרויקט אושרה',
  'project_creation.rejected': 'הקמת פרויקט נדחתה',
  'deal.won': 'עסקה נסגרה כזכייה',
};

export const PROJECT_STATUS_LABELS = {
  planned: 'מתוכנן',
  active: 'פעיל',
  on_hold: 'בהמתנה',
  blocked: 'חסום',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

export const PROJECT_ROLE_LABELS = {
  manager: 'מנהל פרויקט',
  contributor: 'משתתף',
  viewer: 'צופה',
};

export const TASK_STATUS_LABELS = {
  backlog: 'Backlog',
  todo: 'לביצוע',
  in_progress: 'בעבודה',
  in_review: 'בבדיקה',
  blocked: 'חסום',
  done: 'הושלם',
  cancelled: 'בוטל',
};

export const PRIORITY_LABELS = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', urgent: 'דחופה' };

export const TASK_TYPE_LABELS = {
  task: 'משימה',
  feature: 'פיצ׳ר',
  bug: 'באג',
  tech_debt: 'חוב טכני',
  incident: 'תקלה',
  spike: 'מחקר',
};

export const SEVERITY_LABELS = { low: 'נמוכה', medium: 'בינונית', high: 'גבוהה', critical: 'קריטית' };

export const REQUIREMENT_STATUS_LABELS = {
  draft: 'טיוטה',
  approved: 'מאושרת',
  implemented: 'מומשה',
  verified: 'אומתה',
};

export const RECURRENCE_LABELS = { '': 'ללא חזרה', daily: 'יומית', weekly: 'שבועית', monthly: 'חודשית' };

export const TEST_RESULT_LABELS = { not_run: 'לא הורצה', pass: 'עברה', fail: 'נכשלה' };
