import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { createAndSendTokens } from '../utils/tokenHandler.js';
import { dropUser, isOnline } from './realtime.js';
import {
  ApiError,
  canManageMember,
  invitableRoles,
  isObjectId,
  managedRoles,
  permissionsFor,
  recordAudit,
  sendData,
} from './access.js';
import {
  CompanyAuditLog,
  CompanyConversation,
  CompanyConversationMember,
  CompanyInvite,
  CompanyMember,
  CompanyOrganization,
  MEMBER_STATUSES,
} from './models.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const serializeOrganization = (org) => ({ id: org._id, name: org.name, slug: org.slug });

const serializeInvite = (invite) => ({
  id: invite._id,
  email: invite.email,
  role: invite.role,
  status: invite.status,
  expires_at: invite.expiresAt,
  created_at: invite.createdAt,
});

const cleanName = (value) => (typeof value === 'string' ? value.trim() : '');

// ── Current user ──

export const getMe = async (req, res) => {
  const user = await User.findById(req.user._id).select('name email role');
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'המשתמש לא נמצא');

  const memberships = await CompanyMember.find({ userId: user._id, status: 'active' })
    .populate('organizationId');

  sendData(req, res, {
    user: { id: user._id, name: user.name, email: user.email },
    can_create_organization: user.role === 'admin' && (await CompanyOrganization.countDocuments()) === 0,
    memberships: memberships
      .filter((m) => m.organizationId)
      .map((m) => ({
        organization: serializeOrganization(m.organizationId),
        role: m.role,
        permissions: permissionsFor(m.role),
      })),
  });
};

// ── Organization ──

export const createOrganization = async (req, res) => {
  const name = cleanName(req.body.name);
  if (!name) throw new ApiError(400, 'VALIDATION_ERROR', 'שם הארגון הוא שדה חובה');
  if (await CompanyOrganization.exists({})) {
    throw new ApiError(409, 'ORGANIZATION_EXISTS', 'כבר קיים ארגון במערכת');
  }

  const organization = await CompanyOrganization.create({
    name,
    slug: `org-${crypto.randomBytes(4).toString('hex')}`,
  });
  await CompanyMember.create({
    organizationId: organization._id,
    userId: req.user._id,
    role: 'owner',
  });
  const general = await CompanyConversation.create({
    organizationId: organization._id,
    type: 'channel',
    visibility: 'public',
    name: 'כללי',
    createdBy: req.user._id,
  });
  await CompanyConversationMember.create({
    organizationId: organization._id,
    conversationId: general._id,
    userId: req.user._id,
  });
  await recordAudit(req, {
    organizationId: organization._id,
    action: 'organization.created',
    resourceType: 'organization',
    resourceId: organization._id,
    metadata: { name },
  });

  sendData(req, res, serializeOrganization(organization), 201);
};

export const updateOrganization = async (req, res) => {
  const name = cleanName(req.body.name);
  if (!name) throw new ApiError(400, 'VALIDATION_ERROR', 'שם הארגון הוא שדה חובה');

  const previousName = req.organization.name;
  req.organization.name = name;
  await req.organization.save();
  await recordAudit(req, {
    organizationId: req.organization._id,
    action: 'organization.updated',
    resourceType: 'organization',
    resourceId: req.organization._id,
    metadata: { before: previousName, after: name },
  });

  sendData(req, res, serializeOrganization(req.organization));
};

// ── Members ──

export const listMembers = async (req, res) => {
  const filter = { organizationId: req.organization._id };
  // Only managers see people who were suspended or left.
  if (!req.permissions.manage_members) filter.status = 'active';

  const members = await CompanyMember.find(filter)
    .populate('userId', 'name email')
    .sort({ createdAt: 1 });

  const actorIsSelf = (member) => member.userId?._id.equals(req.user._id);

  sendData(
    req,
    res,
    members
      .filter((m) => m.userId)
      .map((m) => ({
        id: m._id,
        user_id: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        role: m.role,
        status: m.status,
        availability: m.availability,
        status_text: m.statusText,
        online: isOnline(m.userId._id),
        is_self: actorIsSelf(m),
        can_manage:
          req.permissions.manage_members && !actorIsSelf(m) && canManageMember(req.membership.role, m.role),
      })),
    200,
    { assignable_roles: req.permissions.manage_members ? managedRoles(req.membership.role) : [] }
  );
};

const activeOwnerCount = (organizationId) =>
  CompanyMember.countDocuments({ organizationId, role: 'owner', status: 'active' });

export const updateMember = async (req, res) => {
  const { memberId } = req.params;
  const { role, status } = req.body;
  const notFound = new ApiError(404, 'NOT_FOUND', 'החבר לא נמצא');
  if (!isObjectId(memberId)) throw notFound;
  if (role === undefined && status === undefined) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'לא נשלח שינוי');
  }
  if (status !== undefined && !MEMBER_STATUSES.includes(status)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'סטטוס לא תקין');
  }

  const member = await CompanyMember.findOne({ _id: memberId, organizationId: req.organization._id });
  if (!member) throw notFound;
  if (member.userId.equals(req.user._id)) {
    throw new ApiError(403, 'SELF_CHANGE_FORBIDDEN', 'אי אפשר לשנות את התפקיד או הסטטוס של עצמך');
  }

  const actorRole = req.membership.role;
  if (!canManageMember(actorRole, member.role)) {
    throw new ApiError(403, 'ACCESS_DENIED', 'אין לך הרשאה לנהל חבר זה');
  }
  if (role !== undefined && !managedRoles(actorRole).includes(role)) {
    throw new ApiError(403, 'ACCESS_DENIED', 'אין לך הרשאה להעניק תפקיד זה');
  }

  const before = { role: member.role, status: member.status };
  if (role !== undefined) member.role = role;
  if (status !== undefined) member.status = status;
  await member.save();

  // Checked after the write so two owners demoting each other at once cannot
  // both pass and leave the organization with nobody in charge.
  if ((await activeOwnerCount(req.organization._id)) === 0) {
    member.role = before.role;
    member.status = before.status;
    await member.save();
    throw new ApiError(409, 'LAST_OWNER', 'חייב להישאר לפחות בעלים פעיל אחד בארגון');
  }

  await recordAudit(req, {
    organizationId: req.organization._id,
    action: 'member.updated',
    resourceType: 'member',
    resourceId: member._id,
    metadata: { user_id: String(member.userId), before, after: { role: member.role, status: member.status } },
  });

  // Open connections must lose what this change took away right now, not at next login.
  dropUser(member.userId);

  sendData(req, res, { id: member._id, role: member.role, status: member.status });
};

// ── Invites ──

export const listInvites = async (req, res) => {
  const invites = await CompanyInvite.find({
    organizationId: req.organization._id,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  sendData(req, res, invites.map(serializeInvite), 200, {
    invitable_roles: invitableRoles(req.membership.role),
  });
};

export const createInvite = async (req, res) => {
  const email = cleanName(req.body.email).toLowerCase();
  const { role } = req.body;
  if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, 'VALIDATION_ERROR', 'כתובת אימייל לא תקינה');
  if (!invitableRoles(req.membership.role).includes(role)) {
    throw new ApiError(403, 'ACCESS_DENIED', 'אין לך הרשאה להזמין בתפקיד זה');
  }

  const existingUser = await User.findOne({ email }).select('_id');
  if (existingUser) {
    const existingMember = await CompanyMember.findOne({
      organizationId: req.organization._id,
      userId: existingUser._id,
    });
    if (existingMember?.status === 'active') {
      throw new ApiError(409, 'ALREADY_MEMBER', 'המשתמש כבר חבר בארגון');
    }
    // An invite must not quietly undo a decision to suspend someone.
    if (existingMember?.status === 'suspended') {
      throw new ApiError(409, 'MEMBER_SUSPENDED', 'המשתמש מושעה. יש להחזיר אותו לפעילות ברשימת הצוות');
    }
  }

  // A new invite replaces any earlier link for the same address.
  await CompanyInvite.updateMany(
    { organizationId: req.organization._id, email, status: 'pending' },
    { status: 'revoked' }
  );

  const token = crypto.randomBytes(32).toString('base64url');
  const invite = await CompanyInvite.create({
    organizationId: req.organization._id,
    email,
    role,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    invitedBy: req.user._id,
  });
  await recordAudit(req, {
    organizationId: req.organization._id,
    action: 'invite.created',
    resourceType: 'invite',
    resourceId: invite._id,
    metadata: { email, role },
  });

  // The only moment the token exists in the clear.
  sendData(req, res, { ...serializeInvite(invite), token }, 201);
};

export const revokeInvite = async (req, res) => {
  const { inviteId } = req.params;
  const notFound = new ApiError(404, 'NOT_FOUND', 'ההזמנה לא נמצאה');
  if (!isObjectId(inviteId)) throw notFound;

  const invite = await CompanyInvite.findOneAndUpdate(
    { _id: inviteId, organizationId: req.organization._id, status: 'pending' },
    { status: 'revoked' },
    { new: true }
  );
  if (!invite) throw notFound;

  await recordAudit(req, {
    organizationId: req.organization._id,
    action: 'invite.revoked',
    resourceType: 'invite',
    resourceId: invite._id,
    metadata: { email: invite.email, role: invite.role },
  });

  sendData(req, res, serializeInvite(invite));
};

const findValidInvite = async (token) => {
  const invite = await CompanyInvite.findOne({
    tokenHash: hashToken(String(token)),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
  if (!invite) throw new ApiError(404, 'INVITE_INVALID', 'הקישור לא תקף, פג תוקפו או שכבר נעשה בו שימוש');
  return invite;
};

export const getInvite = async (req, res) => {
  const invite = await findValidInvite(req.params.token);
  const organization = await CompanyOrganization.findById(invite.organizationId);
  if (!organization) throw new ApiError(404, 'INVITE_INVALID', 'הקישור לא תקף');

  sendData(req, res, {
    organization_name: organization.name,
    email: invite.email,
    role: invite.role,
    account_exists: Boolean(await User.exists({ email: invite.email })),
  });
};

const sessionUserId = (req) => {
  try {
    return jwt.verify(req.cookies.jwt, process.env.JWT_ACCESS_SECRET).id;
  } catch {
    return null;
  }
};

export const acceptInvite = async (req, res) => {
  const invite = await findValidInvite(req.params.token);
  let user = await User.findOne({ email: invite.email });
  const isNewAccount = !user;
  let passwordHash;
  let name;

  if (user) {
    // Holding the link is not enough to attach somebody else's existing account.
    if (sessionUserId(req) !== String(user._id)) {
      throw new ApiError(403, 'LOGIN_REQUIRED', `יש להתחבר עם ${invite.email} כדי לקבל את ההזמנה`);
    }
  } else {
    name = cleanName(req.body.name);
    const { password } = req.body;
    if (!name) throw new ApiError(400, 'VALIDATION_ERROR', 'שם הוא שדה חובה');
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(400, 'VALIDATION_ERROR', `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
    }
    passwordHash = await bcrypt.hash(password, 12);
  }

  // Atomic claim: of two simultaneous requests, only one can use the link.
  const claimed = await CompanyInvite.findOneAndUpdate(
    { _id: invite._id, status: 'pending', expiresAt: { $gt: new Date() } },
    { status: 'accepted', acceptedAt: new Date() },
    { new: true }
  );
  if (!claimed) throw new ApiError(404, 'INVITE_INVALID', 'הקישור כבר נוצל');

  if (isNewAccount) {
    user = await User.create({ name, email: invite.email, passwordHash, role: 'user' });
  }

  await CompanyMember.findOneAndUpdate(
    { organizationId: invite.organizationId, userId: user._id },
    { role: invite.role, status: 'active' },
    { upsert: true, setDefaultsOnInsert: true }
  );
  await recordAudit(req, {
    organizationId: invite.organizationId,
    actorId: user._id,
    action: 'invite.accepted',
    resourceType: 'invite',
    resourceId: invite._id,
    metadata: { email: invite.email, role: invite.role, new_account: isNewAccount },
  });

  if (isNewAccount) createAndSendTokens(user, res);

  sendData(req, res, {
    organization_id: invite.organizationId,
    user: { _id: user._id, name: user.name, email: user.email, role: user.role },
  });
};

// ── Audit ──

export const listAudit = async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 100);
  const filter = { organizationId: req.organization._id };
  if (req.query.cursor) {
    if (!isObjectId(req.query.cursor)) throw new ApiError(400, 'VALIDATION_ERROR', 'cursor לא תקין');
    filter._id = { $lt: req.query.cursor };
  }

  const entries = await CompanyAuditLog.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('actorId', 'name');

  const page = entries.slice(0, limit);
  sendData(
    req,
    res,
    page.map((entry) => ({
      id: entry._id,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      actor_name: entry.actorId?.name || null,
      metadata: entry.metadata,
      created_at: entry.createdAt,
    })),
    200,
    { next_cursor: entries.length > limit ? page[page.length - 1]._id : null }
  );
};
