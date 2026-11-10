import { CompanyAuditLog, CompanyMember } from './models.js';

// Called from the shared login route, so a failure here must never affect signing in.
export const recordLogin = (user, req, succeeded) => {
  CompanyMember.find({ userId: user._id, status: 'active' })
    .select('organizationId')
    .then((memberships) =>
      Promise.all(
        memberships.map(({ organizationId }) =>
          CompanyAuditLog.create({
            organizationId,
            actorId: user._id,
            action: succeeded ? 'auth.login' : 'auth.login_failed',
            resourceType: 'session',
            ip: req.ip,
          })
        )
      )
    )
    .catch((error) => console.error('[companyos] login audit', error));
};
