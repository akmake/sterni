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

org.get('/home', wrap(work.getHome));
org.use(['/projects', '/tasks'], notifyWorkChanged);

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
