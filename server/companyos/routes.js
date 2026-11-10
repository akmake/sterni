import express from 'express';
import { requireAdmin, requireAuth } from '../middlewares/authMiddleware.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import {
  ApiError,
  attachRequestId,
  errorResponder,
  requireOrgMember,
  requirePermission,
  wrap,
} from './access.js';
import * as company from './controller.js';
import * as work from './workController.js';
import * as chat from './chatController.js';
import * as extras from './chatExtrasController.js';
import * as planning from './workExtrasController.js';
import { notifyWorkChanged } from './realtime.js';

const router = express.Router();
router.use(attachRequestId);

// Public: the invite link itself is the credential.
router.get('/invites/:token', authLimiter, wrap(company.getInvite));
router.post('/invites/:token/accept', authLimiter, wrap(company.acceptInvite));

router.use(requireAuth);

router.get('/me', wrap(company.getMe));
router.post('/orgs', requireAdmin, wrap(company.createOrganization));

const org = express.Router({ mergeParams: true });
org.use(requireOrgMember);

org.patch('/', requirePermission('manage_organization'), wrap(company.updateOrganization));

org.get('/members', requirePermission('view_members'), wrap(company.listMembers));
org.patch('/members/:memberId', requirePermission('manage_members'), wrap(company.updateMember));

org.get('/invites', requirePermission('manage_members'), wrap(company.listInvites));
org.post('/invites', requirePermission('manage_members'), wrap(company.createInvite));
org.delete('/invites/:inviteId', requirePermission('manage_members'), wrap(company.revokeInvite));

org.get('/audit', requirePermission('view_audit'), wrap(company.listAudit));

org.get('/conversations', wrap(chat.listConversations));
org.post('/conversations', wrap(chat.createChannel));
org.post('/conversations/dm', wrap(chat.openDirectMessage));
org.get('/conversations/:conversationId/members', wrap(chat.listConversationMembers));
org.post('/conversations/:conversationId/members', wrap(chat.addConversationMember));
org.get('/conversations/:conversationId/messages', wrap(chat.listMessages));
org.post('/conversations/:conversationId/messages', wrap(chat.sendMessage));
org.patch('/conversations/:conversationId/messages/:messageId', wrap(chat.editMessage));
org.delete('/conversations/:conversationId/messages/:messageId', wrap(chat.deleteMessage));
org.post('/conversations/:conversationId/read', wrap(chat.markConversationRead));

org.post('/conversations/group', wrap(extras.createGroup));
org.get('/messages/search', wrap(extras.searchMessages));
org.get('/saved-messages', wrap(extras.listSaved));
org.post('/projects/:projectId/conversation', wrap(extras.openProjectConversation));
org.patch('/conversations/:conversationId/settings', wrap(extras.updateConversationSettings));
org.post('/conversations/:conversationId/unread', wrap(extras.markUnread));
org.get('/conversations/:conversationId/pins', wrap(extras.listPins));
org.post('/conversations/:conversationId/files', extras.uploadMiddleware, wrap(extras.uploadFile));
org.get('/conversations/:conversationId/messages/:messageId/replies', wrap(extras.listReplies));
org.post('/conversations/:conversationId/messages/:messageId/reactions', wrap(extras.toggleReaction));
org.post('/conversations/:conversationId/messages/:messageId/pin', wrap(extras.togglePin));
org.post('/conversations/:conversationId/messages/:messageId/save', wrap(extras.saveMessage));
org.delete('/conversations/:conversationId/messages/:messageId/save', wrap(extras.unsaveMessage));
org.post('/conversations/:conversationId/messages/:messageId/task', wrap(extras.createTaskFromMessage));
org.get('/files/:fileId', wrap(extras.downloadFile));
org.get('/notifications', wrap(extras.listNotifications));
org.post('/notifications/read', wrap(extras.markNotificationsRead));
org.patch('/presence', wrap(extras.updatePresence));

org.get('/home', wrap(work.getHome));
org.use(['/projects', '/tasks'], notifyWorkChanged);

org.get('/workload', wrap(planning.getWorkload));
org.get('/project-templates', wrap(planning.listTemplates));
org.delete('/project-templates/:templateId', requirePermission('create_projects'), wrap(planning.deleteTemplate));
org.post('/projects/from-template', requirePermission('create_projects'), wrap(planning.createProjectFromTemplate));
org.post('/projects/:projectId/save-as-template', requirePermission('create_projects'), wrap(planning.saveAsTemplate));
org.get('/projects/:projectId/time-summary', wrap(planning.projectTimeSummary));

org.get('/projects/:projectId/milestones', wrap(planning.milestones.list));
org.post('/projects/:projectId/milestones', wrap(planning.milestones.create));
org.patch('/projects/:projectId/milestones/:itemId', wrap(planning.milestones.update));
org.delete('/projects/:projectId/milestones/:itemId', wrap(planning.milestones.remove));
org.get('/projects/:projectId/cycles', wrap(planning.cycles.list));
org.post('/projects/:projectId/cycles', wrap(planning.cycles.create));
org.patch('/projects/:projectId/cycles/:itemId', wrap(planning.cycles.update));
org.delete('/projects/:projectId/cycles/:itemId', wrap(planning.cycles.remove));

org.patch('/tasks/bulk', wrap(planning.bulkUpdateTasks));
org.get('/tasks/:taskId/comments', wrap(planning.listComments));
org.post('/tasks/:taskId/comments', wrap(planning.addComment));
org.delete('/tasks/:taskId/comments/:commentId', wrap(planning.deleteComment));
org.get('/tasks/:taskId/time', wrap(planning.listTimeEntries));
org.post('/tasks/:taskId/time', wrap(planning.addTimeEntry));
org.delete('/tasks/:taskId/time/:entryId', wrap(planning.deleteTimeEntry));

// Project-level access is decided inside each handler, per project.
org.get('/projects', wrap(work.listProjects));
org.post('/projects', requirePermission('create_projects'), wrap(work.createProject));
org.get('/projects/:projectId', wrap(work.getProject));
org.patch('/projects/:projectId', wrap(work.updateProject));

org.get('/projects/:projectId/members', wrap(work.listProjectMembers));
org.post('/projects/:projectId/members', wrap(work.addProjectMember));
org.patch('/projects/:projectId/members/:memberId', wrap(work.updateProjectMember));
org.delete('/projects/:projectId/members/:memberId', wrap(work.removeProjectMember));

org.get('/projects/:projectId/requirements', wrap(work.listRequirements));
org.post('/projects/:projectId/requirements', wrap(work.createRequirement));
org.patch('/projects/:projectId/requirements/:requirementId', wrap(work.updateRequirement));

org.get('/projects/:projectId/tests', wrap(work.listTests));
org.post('/projects/:projectId/tests', wrap(work.createTest));
org.patch('/projects/:projectId/tests/:testId', wrap(work.updateTest));

org.get('/tasks', wrap(work.listTasks));
org.post('/tasks', wrap(work.createTask));
org.get('/tasks/:taskId', wrap(work.getTask));
org.patch('/tasks/:taskId', wrap(work.updateTask));

router.use('/orgs/:orgId', org);

router.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'הנתיב לא נמצא')));
router.use(errorResponder);

export default router;
