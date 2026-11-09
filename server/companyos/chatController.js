import User from '../models/userModel.js';
import { ApiError, isObjectId, recordAudit, sendData } from './access.js';
import { CompanyConversation, CompanyConversationMember, CompanyMember, CompanyMessage } from './models.js';
import { emitToTeam, emitToUsers } from './realtime.js';

const MAX_BODY = 10000;
const DEFAULT_PAGE = 50;
const MAX_PAGE = 100;
const PREVIEW_LENGTH = 120;
const DUPLICATE_KEY = 11000;

const invalid = (message) => new ApiError(400, 'VALIDATION_ERROR', message);
const orgScope = (req) => ({ organizationId: req.organization._id });
const isGuest = (req) => req.membership.role === 'guest';
const isPublic = (conversation) => conversation.type === 'channel' && conversation.visibility === 'public';

const memberRow = (conversationId, userId) => CompanyConversationMember.findOne({ conversationId, userId });

// A private channel or DM opens only through membership: no organization role,
// the owner's included, grants access to someone else's conversation (spec 27.2).
const loadConversation = async (req, id) => {
  const missing = new ApiError(404, 'NOT_FOUND', 'השיחה לא נמצאה');
  if (!isObjectId(id)) throw missing;

  const conversation = await CompanyConversation.findOne({ _id: id, ...orgScope(req) });
  if (!conversation) throw missing;

  const membership = await memberRow(conversation._id, req.user._id);
  if (!membership && (!isPublic(conversation) || isGuest(req))) throw missing;
  return { conversation, membership };
};

const requireOrgColleague = async (req, userId) => {
  if (!isObjectId(userId)) throw invalid('משתמש לא תקין');
  const member = await CompanyMember.findOne({ ...orgScope(req), userId, status: 'active' });
  if (!member) throw invalid('המשתמש אינו חבר פעיל בארגון');
};

// ── Delivery ──

const deliver = async (conversation, event, payload) => {
  if (isPublic(conversation)) {
    emitToTeam(conversation.organizationId, event, payload);
    return;
  }
  // Recipients come from the database per message, so someone removed stops receiving at once.
  const members = await CompanyConversationMember.find({ conversationId: conversation._id }).distinct('userId');
  emitToUsers(members.map(String), event, payload);
};

const serializeMessage = (message, authorName) => ({
  id: message._id,
  conversation_id: message.conversationId,
  seq: message.seq,
  body: message.deletedAt ? '' : message.body,
  deleted: Boolean(message.deletedAt),
  author_id: message.authorId?._id ?? message.authorId,
  author_name: authorName ?? message.authorId?.name ?? null,
  created_at: message.createdAt,
  edited_at: message.editedAt,
});

// ── Conversations ──

const accessibleFilter = async (req) => {
  const joined = await CompanyConversationMember.find({ ...orgScope(req), userId: req.user._id }).distinct('conversationId');
  const clauses = [{ _id: { $in: joined } }];
  if (!isGuest(req)) clauses.push({ type: 'channel', visibility: 'public' });
  return { ...orgScope(req), $or: clauses };
};

const dmPartnerNames = async (req, conversations) => {
  const dmIds = conversations.filter((c) => c.type === 'dm').map((c) => c._id);
  if (dmIds.length === 0) return new Map();
  const others = await CompanyConversationMember.find({
    conversationId: { $in: dmIds },
    userId: { $ne: req.user._id },
  }).populate('userId', 'name');
  return new Map(others.map((row) => [String(row.conversationId), row.userId?.name ?? null]));
};

const serializeConversation = (conversation, lastReadSeq, partnerName) => ({
  id: conversation._id,
  type: conversation.type,
  visibility: conversation.visibility,
  name: conversation.type === 'dm' ? partnerName : conversation.name,
  unread_count: Math.max(conversation.lastSeq - lastReadSeq, 0),
  last_seq: conversation.lastSeq,
  last_message: conversation.lastMessage?.at
    ? {
        body: conversation.lastMessage.body,
        author_name: conversation.lastMessage.authorName,
        created_at: conversation.lastMessage.at,
      }
    : null,
  updated_at: conversation.updatedAt,
});

const readPositions = async (req, conversationIds) => {
  const rows = await CompanyConversationMember.find({
    conversationId: { $in: conversationIds },
    userId: req.user._id,
  });
  return new Map(rows.map((row) => [String(row.conversationId), row.lastReadSeq]));
};

export const listConversations = async (req, res) => {
  const conversations = await CompanyConversation.find(await accessibleFilter(req)).sort({ updatedAt: -1 }).limit(200);
  const positions = await readPositions(req, conversations.map((c) => c._id));
  const partners = await dmPartnerNames(req, conversations);

  sendData(
    req,
    res,
    conversations.map((c) => serializeConversation(c, positions.get(String(c._id)) ?? 0, partners.get(String(c._id))))
  );
};

export const unreadTotal = async (req) => {
  const conversations = await CompanyConversation.find(await accessibleFilter(req)).select('lastSeq');
  const positions = await readPositions(req, conversations.map((c) => c._id));
  return conversations.reduce((sum, c) => sum + Math.max(c.lastSeq - (positions.get(String(c._id)) ?? 0), 0), 0);
};

export const createChannel = async (req, res) => {
  if (isGuest(req)) throw new ApiError(403, 'ACCESS_DENIED', 'אין לך הרשאה ליצור ערוץ');
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) throw invalid('שם הערוץ הוא שדה חובה');
  const visibility = req.body.visibility === 'private' ? 'private' : 'public';

  const conversation = await CompanyConversation.create({
    ...orgScope(req),
    type: 'channel',
    visibility,
    name,
    createdBy: req.user._id,
  });
  await CompanyConversationMember.create({ ...orgScope(req), conversationId: conversation._id, userId: req.user._id });
  await recordAudit(req, {
    organizationId: req.organization._id,
    action: 'conversation.created',
    resourceType: 'conversation',
    resourceId: conversation._id,
    metadata: { name, visibility },
  });

  if (visibility === 'public') emitToTeam(req.organization._id, 'conversations_changed');
  sendData(req, res, serializeConversation(conversation, 0), 201);
};

export const openDirectMessage = async (req, res) => {
  if (isGuest(req)) throw new ApiError(403, 'ACCESS_DENIED', 'אין לך הרשאה לפעולה זו');
  const { user_id: userId } = req.body;
  await requireOrgColleague(req, userId);
  if (String(userId) === String(req.user._id)) throw invalid('אי אפשר לפתוח שיחה עם עצמך');

  const dmKey = [String(req.user._id), String(userId)].sort().join(':');
  let conversation = await CompanyConversation.findOne({ ...orgScope(req), dmKey });
  let created = false;

  if (!conversation) {
    try {
      conversation = await CompanyConversation.create({ ...orgScope(req), type: 'dm', dmKey, createdBy: req.user._id });
      created = true;
    } catch (error) {
      if (error.code !== DUPLICATE_KEY) throw error;
      conversation = await CompanyConversation.findOne({ ...orgScope(req), dmKey });
    }
  }
  if (created) {
    await CompanyConversationMember.insertMany(
      [req.user._id, userId].map((id) => ({ ...orgScope(req), conversationId: conversation._id, userId: id }))
    );
  }

  const partner = await User.findById(userId).select('name');
  const membership = await memberRow(conversation._id, req.user._id);
  sendData(req, res, serializeConversation(conversation, membership?.lastReadSeq ?? 0, partner?.name), created ? 201 : 200);
};

export const addConversationMember = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  if (conversation.type === 'dm' || isPublic(conversation)) throw invalid('אפשר להוסיף חברים רק לערוץ פרטי');
  const { user_id: userId } = req.body;
  await requireOrgColleague(req, userId);

  if (await memberRow(conversation._id, userId)) {
    throw new ApiError(409, 'ALREADY_MEMBER', 'המשתמש כבר חבר בערוץ');
  }
  // New members start at the current position: older messages don't count as unread.
  await CompanyConversationMember.create({
    ...orgScope(req),
    conversationId: conversation._id,
    userId,
    lastReadSeq: conversation.lastSeq,
  });
  await recordAudit(req, {
    organizationId: req.organization._id,
    action: 'conversation.member_added',
    resourceType: 'conversation',
    resourceId: conversation._id,
    metadata: { name: conversation.name, user_id: String(userId) },
  });

  emitToUsers([String(userId)], 'conversations_changed');
  sendData(req, res, { user_id: userId }, 201);
};

export const listConversationMembers = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const members = await CompanyConversationMember.find({ conversationId: conversation._id }).populate('userId', 'name');
  sendData(req, res, members.filter((m) => m.userId).map((m) => ({ user_id: m.userId._id, name: m.userId.name })));
};

// ── Messages ──

const parseSeq = (value) => {
  const seq = Number.parseInt(value, 10);
  if (!Number.isInteger(seq) || seq < 0) throw invalid('מיקום לא תקין');
  return seq;
};

export const listMessages = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || DEFAULT_PAGE, MAX_PAGE);

  const filter = { conversationId: conversation._id };
  const seqRange = {};
  if (req.query.before_seq !== undefined) seqRange.$lt = parseSeq(req.query.before_seq);
  if (req.query.after_seq !== undefined) seqRange.$gt = parseSeq(req.query.after_seq);
  if (Object.keys(seqRange).length > 0) filter.seq = seqRange;

  // after_seq is reconnect recovery: oldest first, from that point forward.
  const direction = req.query.after_seq !== undefined ? 1 : -1;
  const rows = await CompanyMessage.find(filter).sort({ seq: direction }).limit(limit + 1).populate('authorId', 'name');
  const page = rows.slice(0, limit).sort((a, b) => a.seq - b.seq);

  sendData(req, res, page.map((m) => serializeMessage(m)), 200, {
    next_cursor: rows.length > limit ? String(direction === 1 ? page[page.length - 1].seq : page[0].seq) : null,
  });
};

const cleanBody = (value) => {
  const body = typeof value === 'string' ? value.trim() : '';
  if (!body) throw invalid('אי אפשר לשלוח הודעה ריקה');
  if (body.length > MAX_BODY) throw invalid('ההודעה ארוכה מדי');
  return body;
};

const markRead = (req, conversationId, seq) =>
  CompanyConversationMember.findOneAndUpdate(
    { conversationId, userId: req.user._id },
    { $max: { lastReadSeq: seq }, $setOnInsert: { organizationId: req.organization._id } },
    { upsert: true }
  );

export const sendMessage = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const body = cleanBody(req.body.body);
  const clientId = typeof req.body.client_id === 'string' && req.body.client_id ? req.body.client_id.slice(0, 64) : undefined;

  const findRetry = () =>
    CompanyMessage.findOne({ conversationId: conversation._id, authorId: req.user._id, clientId }).populate('authorId', 'name');

  if (clientId) {
    const existing = await findRetry();
    if (existing) return sendData(req, res, serializeMessage(existing));
  }

  const author = await User.findById(req.user._id).select('name');
  const { lastSeq: seq } = await CompanyConversation.findByIdAndUpdate(
    conversation._id,
    { $inc: { lastSeq: 1 } },
    { new: true, timestamps: false }
  );

  let message;
  try {
    message = await CompanyMessage.create({
      ...orgScope(req),
      conversationId: conversation._id,
      authorId: req.user._id,
      seq,
      body,
      clientId,
    });
  } catch (error) {
    if (error.code !== DUPLICATE_KEY || !clientId) throw error;
    return sendData(req, res, serializeMessage(await findRetry()));
  }

  await CompanyConversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessage: { body: body.slice(0, PREVIEW_LENGTH), authorName: author.name, at: message.createdAt } } }
  );
  await markRead(req, conversation._id, seq);

  const payload = serializeMessage(message, author.name);
  await deliver(conversation, 'message_new', payload);
  sendData(req, res, payload, 201);
};

const loadOwnMessage = async (req, conversation, messageId) => {
  const missing = new ApiError(404, 'NOT_FOUND', 'ההודעה לא נמצאה');
  if (!isObjectId(messageId)) throw missing;
  const message = await CompanyMessage.findOne({ _id: messageId, conversationId: conversation._id, deletedAt: null });
  if (!message) throw missing;
  if (!message.authorId.equals(req.user._id)) throw new ApiError(403, 'ACCESS_DENIED', 'אפשר לערוך רק הודעות שלך');
  return message;
};

export const editMessage = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const message = await loadOwnMessage(req, conversation, req.params.messageId);
  message.body = cleanBody(req.body.body);
  message.editedAt = new Date();
  await message.save();

  await message.populate('authorId', 'name');
  const payload = serializeMessage(message);
  await deliver(conversation, 'message_updated', payload);
  sendData(req, res, payload);
};

export const deleteMessage = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const message = await loadOwnMessage(req, conversation, req.params.messageId);
  message.deletedAt = new Date();
  message.body = '';
  await message.save();

  await message.populate('authorId', 'name');
  const payload = serializeMessage(message);
  await deliver(conversation, 'message_updated', payload);
  sendData(req, res, payload);
};

export const markConversationRead = async (req, res) => {
  const { conversation } = await loadConversation(req, req.params.conversationId);
  const seq = Math.min(parseSeq(req.body.seq), conversation.lastSeq);
  await markRead(req, conversation._id, seq);
  emitToUsers([String(req.user._id)], 'conversations_changed');
  sendData(req, res, { seq });
};
