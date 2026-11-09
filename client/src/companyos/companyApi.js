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
  sendMessage: (orgId, id, body, clientId) =>
    api.post(`/v1/orgs/${orgId}/conversations/${id}/messages`, { body, client_id: clientId }).then(data),
  editMessage: (orgId, id, messageId, body) =>
    api.patch(`/v1/orgs/${orgId}/conversations/${id}/messages/${messageId}`, { body }).then(data),
  deleteMessage: (orgId, id, messageId) =>
    api.delete(`/v1/orgs/${orgId}/conversations/${id}/messages/${messageId}`).then(data),
  markRead: (orgId, id, seq) => api.post(`/v1/orgs/${orgId}/conversations/${id}/read`, { seq }).then(data),

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
  'project.status_changed': 'סטטוס פרויקט השתנה',
  'project.member_added': 'חבר נוסף לפרויקט',
  'project.member_updated': 'תפקיד בפרויקט השתנה',
  'project.member_removed': 'חבר הוסר מפרויקט',
  'task.created': 'משימה נוצרה',
  'task.updated': 'משימה עודכנה',
  'requirement.created': 'דרישה נוצרה',
  'test.created': 'בדיקה נוצרה',
  'test.result_recorded': 'תוצאת בדיקה נרשמה',
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

export const TEST_RESULT_LABELS = { not_run: 'לא הורצה', pass: 'עברה', fail: 'נכשלה' };
