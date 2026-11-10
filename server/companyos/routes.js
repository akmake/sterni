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
import * as teams from './teamController.js';
import * as mfa from './mfaController.js';
import * as push from './push.js';
import * as knowledge from './knowledgeController.js';
import * as crm from './crmController.js';
import { notifyWorkChanged } from './realtime.js';

const router = express.Router();
router.use(attachRequestId);

// Public: the invite link itself is the credential.
router.get('/invites/:token', authLimiter, wrap(company.getInvite));
router.post('/invites/:token/accept', authLimiter, wrap(company.acceptInvite));

router.use(requireAuth);

router.get('/me', wrap(company.getMe));
router.get('/push', wrap(push.getPushConfig));
router.post('/push/subscribe', wrap(push.subscribe));
router.post('/push/unsubscribe', wrap(push.unsubscribe));
router.get('/mfa', wrap(mfa.getMfaStatus));
router.post('/mfa/setup', authLimiter, wrap(mfa.startSetup));
router.post('/mfa/enable', authLimiter, wrap(mfa.enable));
router.post('/mfa/verify', authLimiter, wrap(mfa.verify));
router.post('/mfa/disable', authLimiter, wrap(mfa.disable));
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

org.get('/search', wrap(knowledge.search));
org.get('/documents', wrap(knowledge.listDocuments));
org.post('/documents', requirePermission('create_documents'), wrap(knowledge.createDocument));
org.get('/documents/:documentId', wrap(knowledge.getDocument));
org.post('/documents/:documentId/revisions', wrap(knowledge.createRevision));
org.post('/documents/:documentId/submit-for-approval', wrap(knowledge.submitDocument));
org.post('/documents/:documentId/publish', wrap(knowledge.publishDocument));
org.patch('/documents/:documentId', wrap(knowledge.updateDocument));
org.post('/documents/:documentId/restore', wrap(knowledge.restoreRevision));
org.post('/documents/:documentId/archive', wrap(knowledge.setArchived));
org.post('/documents/:documentId/links', wrap(knowledge.addLink));
org.delete('/documents/:documentId/links/:linkId', wrap(knowledge.removeLink));
org.post('/documents/:documentId/files', extras.uploadMiddleware, wrap(knowledge.uploadDocumentFile));

org.get('/leads/export', wrap(crm.exportLeads));
org.post('/crm/webhook-token', wrap(crm.rotateLeadWebhookToken));
org.get('/crm/:resourceType/:resourceId/activities', wrap(crm.listActivities));
org.post('/crm/:resourceType/:resourceId/activities', wrap(crm.addActivity));
org.get('/pipeline', wrap(crm.getPipeline));
org.patch('/pipeline', wrap(crm.updatePipeline));
org.get('/approvals', wrap(crm.listApprovals));
org.post('/accounts', wrap(crm.createAccount));
org.get('/accounts/:accountId', wrap(crm.getAccount));
org.patch('/accounts/:accountId', wrap(crm.updateAccount));
org.post('/accounts/:accountId/contacts', wrap(crm.addContact));
org.post('/deals', wrap(crm.createDeal));
org.post('/deals/:dealId/stage', wrap(crm.moveDealStage));
org.post('/deals/:dealId/close-lost', wrap(crm.closeLost));
org.post('/quotes/:quoteId/mark-sent', wrap(crm.markQuoteSent));
org.post('/quotes/:quoteId/record-acceptance', wrap(crm.recordQuoteAcceptance));
org.patch('/leads/:leadId', wrap(crm.updateLead));
org.get('/leads', wrap(crm.listLeads));
org.post('/leads', requirePermission('create_leads'), wrap(crm.createLead));
org.get('/leads/:leadId', wrap(crm.getLead));
org.post('/leads/:leadId/assign', wrap(crm.assignLead));
org.post('/leads/:leadId/assignment-decision', wrap(crm.decideAssignment));
org.post('/leads/:leadId/transition', wrap(crm.transitionLead));
org.post('/leads/:leadId/convert', wrap(crm.convertLead));
org.get('/accounts', wrap(crm.listAccounts));
org.get('/deals', wrap(crm.listDeals));
org.get('/deals/:dealId/quotes', wrap(crm.listQuotes));
org.post('/deals/:dealId/quotes', wrap(crm.createQuote));
org.post('/quotes/:quoteId/submit-for-approval', wrap(crm.submitQuote));
org.post('/approvals/:approvalId/decide', wrap(crm.decideApproval));
org.post('/deals/:dealId/close-won', wrap(crm.closeWon));

org.get('/teams', requirePermission('view_members'), wrap(teams.listTeams));
org.post('/teams', requirePermission('manage_members'), wrap(teams.createTeam));
org.patch('/teams/:teamId', requirePermission('manage_members'), wrap(teams.renameTeam));
org.delete('/teams/:teamId', requirePermission('manage_members'), wrap(teams.deleteTeam));
org.post('/teams/:teamId/members', requirePermission('manage_members'), wrap(teams.addTeamMember));
org.delete('/teams/:teamId/members/:userId', requirePermission('manage_members'), wrap(teams.removeTeamMember));

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
org.use(['/projects', '/tasks', '/leads', '/deals', '/quotes', '/accounts', '/documents', '/approvals'], notifyWorkChanged);

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
