import crypto from 'crypto';
import mongoose from 'mongoose';
import { CompanyAuditLog, CompanyMember, CompanyOrganization } from './models.js';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export const attachRequestId = (req, res, next) => {
  req.requestId = crypto.randomUUID();
  next();
};

export const sendData = (req, res, data, status = 200, meta = {}) =>
  res.status(status).json({ data, meta: { request_id: req.requestId, ...meta } });

export const isObjectId = (value) => mongoose.isValidObjectId(value);

// ── Policy (spec 7.1): one place, consumed by the API and reported to the clients ──

const MANAGED_BY = {
  owner: ['owner', 'admin', 'manager', 'member', 'guest'],
  admin: ['manager', 'member', 'guest'],
};

export const managedRoles = (role) => MANAGED_BY[role] || [];

export const canManageMember = (actorRole, targetRole) =>
  managedRoles(actorRole).includes(targetRole);

// Ownership is passed on by an existing owner, never granted through a link.
export const invitableRoles = (role) => managedRoles(role).filter((r) => r !== 'owner');

export const permissionsFor = (role) => ({
  manage_organization: role === 'owner' || role === 'admin',
  manage_members: role === 'owner' || role === 'admin',
  view_members: role !== 'guest',
  view_audit: role === 'owner' || role === 'admin',
  create_projects: ['owner', 'admin', 'manager'].includes(role),
});

// Membership is read from the database on every request, so a suspension or a
// role change applies immediately, even to a session that is already open.
export const requireOrgMember = wrap(async (req, res, next) => {
  const { orgId } = req.params;
  // Same answer for "does not exist" and "not yours": no organization IDs leak.
  const notFound = new ApiError(404, 'NOT_FOUND', 'הארגון לא נמצא');
  if (!isObjectId(orgId)) throw notFound;

  const membership = await CompanyMember.findOne({
    organizationId: orgId,
    userId: req.user._id,
    status: 'active',
  });
  if (!membership) throw notFound;

  const organization = await CompanyOrganization.findById(orgId);
  if (!organization) throw notFound;

  req.membership = membership;
  req.organization = organization;
  req.permissions = permissionsFor(membership.role);
  next();
});

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.permissions?.[permission]) {
    return next(new ApiError(403, 'ACCESS_DENIED', 'אין לך הרשאה לפעולה זו'));
  }
  next();
};

export const recordAudit = (req, { organizationId, actorId, action, resourceType, resourceId, metadata }) =>
  CompanyAuditLog.create({
    organizationId,
    actorId: actorId === undefined ? req.user?._id : actorId,
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : null,
    metadata: metadata || {},
    requestId: req.requestId,
    ip: req.ip,
  });

export const errorResponder = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
      request_id: req.requestId,
    });
  }
  if (err.name === 'MulterError') {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: { code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR', message: tooLarge ? 'הקובץ גדול מדי (עד 25MB)' : 'העלאת הקובץ נכשלה' },
      request_id: req.requestId,
    });
  }
  // CSRF rejections keep their existing handling in the global error handler.
  if (err.code === 'EBADCSRFTOKEN') return next(err);

  console.error('[companyos]', req.requestId, err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'שגיאת שרת' },
    request_id: req.requestId,
  });
};
