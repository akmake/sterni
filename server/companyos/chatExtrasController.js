import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { ApiError, isObjectId, recordAudit, sendData } from './access.js';
import { accessibleFilter, deliver, loadConversation, markRead, notify, serializeMessage } from './chatController.js';
import {
  AVAILABILITIES,
  CompanyConversation,
  CompanyConversationMember,
  CompanyFile,
  CompanyMember,
  CompanyMessage,
  CompanyNotification,
  CompanySavedMessage,
  CompanyTask,
} from './models.js';
import { emitToOrganization, emitToUsers } from './realtime.js';
import { loadProject, requireWrite } from './workController.js';
import { requireDocumentAccess } from './knowledgeController.js';

const invalid = (message) => new ApiError(400, 'VALIDATION_ERROR', message);
const orgScope = (req) => ({ organizationId: req.organization._id });

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MIN_SEARCH_LENGTH = 2;
const MAX_REACTION_LENGTH = 16;
const REMINDER_INTERVAL_MS = 60 * 1000;

// Deliberately not under /uploads, which both Express and nginx serve publicly.
const FILES_DIR = process.env.COMPANY_FILES_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/company-files');
fs.mkdirSync(FILES_DIR, { recursive: true });

// Scripts and HTML are excluded: they could run in the site's origin if ever rendered.
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: FILES_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new ApiError(415, 'FILE_TYPE_NOT_ALLOWED', 'סוג הקובץ לא נתמך'));
  },
}).single('file');

const loadMessage = async (conversation, messageId) => {
  const missing = new ApiError(404, 'NOT_FOUND', 'ההודעה לא נמצאה');
  if (!isObjectId(messageId)) throw missing;
  const message = await CompanyMessage.findOne({ _id: messageId, conversationId: conversation._id, deletedAt: null });
  if (!message) throw missing;
  return message;
};

// ── Conversations ──

export const createGroup = async (req, res) => {
  if (req.membership.role === 'guest') throw new ApiError(403, 'ACCESS_DENIED', 'אין לך הרשאה לפעולה זו');
  const ids = Array.isArray(req.body.user_ids) ? [...new Set(req.body.user_ids.filter(isObjectId).map(String))] : [];
  const others = ids.filter((id) => id !== String(req.user._id));
  if (others.length < 2) throw invalid('שיחה קבוצתית דורשת לפחות שני משתתפים נוספים');

  const active = await CompanyMember.countDocuments({ ...orgScope(req), userId: { $in: others }, status: 'active' });
  if (active !== others.length) throw invalid('אחד המשתתפים אינו חבר פעיל בארגון');

  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const conversation = await CompanyConversation.create({
    ...orgScope(req),
    type: 'group',
    name: name || null,
    createdBy: req.user._id,
  });
  await CompanyConversationMember.insertMany(
    [String(req.user._id), ...others].map((userId) => ({ ...orgScope(req), conversationId: conversation._id, userId }))
  );
  emitToUsers(others, 'conversations_changed');
  sendData(req, res, { id: conversation._id, type: 'group', name: conversation.name }, 201);
};

export const openProjectConversation = async (req, res) => {
  const { project } = await loadProject(req, req.params.projectId);
  const conversation = await CompanyConversation.findOneAndUpdate(
    { projectId: project._id },
    {
      $setOnInsert: {
        ...orgScope(req),
        type: 'project',
        visibility: 'private',
        name: project.name,
        createdBy: req.user._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  sendData(req, res, { id: conversation._id, type: 'project', name: conversation.name, project_id: project._id });
};

export const updateConversationSettings = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  if (typeof req.body.muted !== 'boolean') throw invalid('ערך לא תקין');
  await CompanyConversationMember.updateOne(
    { conversationId: conversation._id, userId: req.user._id },
    { $set: { muted: req.body.muted }, $setOnInsert: { organizationId: req.organization._id } },
    { upsert: true }
  );
  emitToUsers([String(req.user._id)], 'conversations_changed');
  sendData(req, res, { muted: req.body.muted });
};

export const markUnread = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const seq = Number.parseInt(req.body.seq, 10);
  if (!Number.isInteger(seq) || seq < 1) throw invalid('מיקום לא תקין');
  await CompanyConversationMember.updateOne(
    { conversationId: conversation._id, userId: req.user._id },
    { $set: { lastReadSeq: seq - 1 }, $setOnInsert: { organizationId: req.organization._id } },
    { upsert: true }
  );
  emitToUsers([String(req.user._id)], 'conversations_changed');
  sendData(req, res, { seq: seq - 1 });
};

// ── Message actions ──

export const listReplies = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const parent = await loadMessage(conversation, req.params.messageId);
  const replies = await CompanyMessage.find({ parentId: parent._id }).sort({ seq: 1 }).limit(500).populate('authorId', 'name');
  await parent.populate('authorId', 'name');
  sendData(req, res, { parent: serializeMessage(parent), replies: replies.map((m) => serializeMessage(m)) });
};

export const toggleReaction = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const message = await loadMessage(conversation, req.params.messageId);
  const emoji = typeof req.body.emoji === 'string' ? req.body.emoji.trim() : '';
  if (!emoji || emoji.length > MAX_REACTION_LENGTH) throw invalid('תגובה לא תקינה');

  const removed = await CompanyMessage.findOneAndUpdate(
    { _id: message._id, reactions: { $elemMatch: { emoji, userId: req.user._id } } },
    { $pull: { reactions: { emoji, userId: req.user._id } } },
    { new: true }
  );
  const updated =
    removed ??
    (await CompanyMessage.findByIdAndUpdate(
      message._id,
      { $addToSet: { reactions: { emoji, userId: req.user._id } } },
      { new: true }
    ));

  await updated.populate('authorId', 'name');
  const payload = serializeMessage(updated);
  await deliver(conversation, 'message_updated', payload);
  sendData(req, res, payload);
};

export const togglePin = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const message = await loadMessage(conversation, req.params.messageId);
  message.pinnedAt = message.pinnedAt ? null : new Date();
  message.pinnedBy = message.pinnedAt ? req.user._id : null;
  await message.save();

  await message.populate('authorId', 'name');
  const payload = serializeMessage(message);
  await deliver(conversation, 'message_updated', payload);
  sendData(req, res, payload);
};

export const listPins = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const pins = await CompanyMessage.find({ conversationId: conversation._id, pinnedAt: { $ne: null }, deletedAt: null })
    .sort({ pinnedAt: -1 })
    .limit(100)
    .populate('authorId', 'name');
  sendData(req, res, pins.map((m) => serializeMessage(m)));
};

export const saveMessage = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const message = await loadMessage(conversation, req.params.messageId);

  let remindAt = null;
  if (req.body.remind_at) {
    remindAt = new Date(req.body.remind_at);
    if (Number.isNaN(remindAt.getTime()) || remindAt <= new Date()) throw invalid('מועד תזכורת לא תקין');
  }
  await CompanySavedMessage.findOneAndUpdate(
    { userId: req.user._id, messageId: message._id },
    { $set: { remindAt }, $setOnInsert: { ...orgScope(req), conversationId: conversation._id } },
    { upsert: true }
  );
  sendData(req, res, { message_id: message._id, remind_at: remindAt }, 201);
};

export const unsaveMessage = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  await CompanySavedMessage.deleteOne({ userId: req.user._id, messageId: req.params.messageId, conversationId: conversation._id });
  sendData(req, res, { message_id: req.params.messageId });
};

export const listSaved = async (req, res) => {
  const accessible = await CompanyConversation.find(await accessibleFilter(req)).distinct('_id');
  // Filtered by current access: a saved message from a conversation you left stays hidden.
  const saved = await CompanySavedMessage.find({
    ...orgScope(req),
    userId: req.user._id,
    conversationId: { $in: accessible },
  })
    .sort({ _id: -1 })
    .limit(200)
    .populate({ path: 'messageId', populate: { path: 'authorId', select: 'name' } });

  sendData(
    req,
    res,
    saved
      .filter((row) => row.messageId && !row.messageId.deletedAt)
      .map((row) => ({ remind_at: row.remindAt, message: serializeMessage(row.messageId) }))
  );
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const searchMessages = async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < MIN_SEARCH_LENGTH) throw invalid('יש להקליד לפחות שני תווים');

  // Access is part of the query (spec 27.3): hidden conversations are never matched.
  const conversations = await CompanyConversation.find(await accessibleFilter(req)).select('name type');
  const names = new Map(conversations.map((c) => [String(c._id), c.name]));
  const results = await CompanyMessage.find({
    conversationId: { $in: conversations.map((c) => c._id) },
    deletedAt: null,
    body: { $regex: escapeRegex(query), $options: 'i' },
  })
    .sort({ _id: -1 })
    .limit(50)
    .populate('authorId', 'name');

  sendData(
    req,
    res,
    results.map((m) => ({ ...serializeMessage(m), conversation_name: names.get(String(m.conversationId)) ?? null }))
  );
};

export const createTaskFromMessage = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const message = await loadMessage(conversation, req.params.messageId);
  const access = await loadProject(req, req.body.project_id);
  requireWrite(access);

  const title = (typeof req.body.title === 'string' && req.body.title.trim()) || message.body.slice(0, 120).trim();
  if (!title) throw invalid('כותרת היא שדה חובה');

  const task = await CompanyTask.create({
    ...orgScope(req),
    projectId: access.project._id,
    title,
    description: message.body,
    sourceMessageId: message._id,
    createdBy: req.user._id,
  });
  await recordAudit(req, {
    organizationId: req.organization._id,
    action: 'task.created',
    resourceType: 'task',
    resourceId: task._id,
    metadata: { title, project_id: String(access.project._id), source_message_id: String(message._id) },
  });

  emitToOrganization(req.organization._id, 'work_changed');
  sendData(req, res, { id: task._id, title: task.title, project_id: task.projectId, source_message_id: message._id }, 201);
};

// ── Files ──

export const uploadFile = async (req, res) => {
  if (!req.file) throw invalid('לא נבחר קובץ');
  try {
    const { conversation } = await loadConversation(req, req.params.conversationId);
    // Browsers send non-ASCII filenames as latin1 in multipart headers.
    const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 200);
    const file = await CompanyFile.create({
      ...orgScope(req),
      conversationId: conversation._id,
      uploadedBy: req.user._id,
      name,
      mime: req.file.mimetype,
      size: req.file.size,
      storedName: req.file.filename,
    });
    sendData(req, res, { id: file._id, name, mime: file.mime, size: file.size }, 201);
  } catch (error) {
    fs.promises.unlink(req.file.path).catch(() => {});
    throw error;
  }
};

export const downloadFile = async (req, res) => {
  const missing = new ApiError(404, 'NOT_FOUND', 'הקובץ לא נמצא');
  if (!isObjectId(req.params.fileId)) throw missing;
  const file = await CompanyFile.findOne({ _id: req.params.fileId, ...orgScope(req) });
  if (!file) throw missing;

  try {
    if (file.documentId) await requireDocumentAccess(req, file.documentId);
    else await loadConversation(req, file.conversationId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw missing;
    throw error;
  }

  const isImage = file.mime.startsWith('image/');
  res.setHeader('Content-Type', file.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `${isImage ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`
  );
  res.sendFile(path.resolve(FILES_DIR, file.storedName));
};

// ── Inbox and presence ──

export const listNotifications = async (req, res) => {
  const items = await CompanyNotification.find({ ...orgScope(req), userId: req.user._id }).sort({ _id: -1 }).limit(100);
  sendData(
    req,
    res,
    items.map((n) => ({
      id: n._id,
      type: n.type,
      title: n.title,
      body: n.body,
      is_read: Boolean(n.readAt),
      resource_type: n.resourceType,
      resource_id: n.resourceId,
      created_at: n.createdAt,
    })),
    200,
    { unread: items.filter((n) => !n.readAt).length }
  );
};

export const markNotificationsRead = async (req, res) => {
  const filter = { ...orgScope(req), userId: req.user._id, readAt: null };
  if (Array.isArray(req.body.ids)) filter._id = { $in: req.body.ids.filter(isObjectId) };
  await CompanyNotification.updateMany(filter, { readAt: new Date() });
  emitToUsers([String(req.user._id)], 'notification_new');
  sendData(req, res, { ok: true });
};

export const updatePresence = async (req, res) => {
  const updates = {};
  if (req.body.availability !== undefined) {
    if (!AVAILABILITIES.includes(req.body.availability)) throw invalid('זמינות לא תקינה');
    updates.availability = req.body.availability;
  }
  if (req.body.status_text !== undefined) {
    updates.statusText = String(req.body.status_text).trim().slice(0, 80);
  }
  await CompanyMember.updateOne({ _id: req.membership._id }, { $set: updates });
  emitToOrganization(req.organization._id, 'presence_changed', { user_id: req.user._id });
  sendData(req, res, updates);
};

// Delivers "remind me later" once, then clears it.
const deliverDueReminders = async () => {
  const due = await CompanySavedMessage.find({ remindAt: { $ne: null, $lte: new Date() } }).limit(200);
  await Promise.all(
    due.map(async (row) => {
      const claimed = await CompanySavedMessage.findOneAndUpdate(
        { _id: row._id, remindAt: row.remindAt },
        { $set: { remindAt: null } }
      );
      if (!claimed) return;
      await notify(row.organizationId, row.userId, {
        type: 'reminder',
        title: 'תזכורת להודעה ששמרת',
        resourceType: 'conversation',
        resourceId: String(row.conversationId),
      });
    })
  );
};

export const startReminderWorker = () =>
  setInterval(() => deliverDueReminders().catch((error) => console.error('[companyos] reminders', error)), REMINDER_INTERVAL_MS);

export { deliverDueReminders, markRead };
