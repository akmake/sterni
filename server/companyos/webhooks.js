import crypto from 'crypto';
import express from 'express';
import { publicLimiter } from '../middlewares/rateLimiter.js';
import { createLeadRecord } from './crmController.js';
import { CompanyAuditLog, CompanyMember, CompanyOrganization } from './models.js';

// Mounted before the CSRF middleware: callers are external systems holding a token, not browsers.
const router = express.Router();

router.post('/leads', publicLimiter, async (req, res) => {
  try {
    const token = req.get('X-Company-Token');
    if (typeof token !== 'string' || !token) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'חסר טוקן' } });

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const organization = await CompanyOrganization.findOne({ 'settings.leadWebhookHash': hash });
    if (!organization) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'טוקן לא תקף' } });

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'כותרת היא שדה חובה' } });

    const owner = await CompanyMember.findOne({ organizationId: organization._id, role: 'owner', status: 'active' });
    if (!owner) return res.status(409).json({ error: { code: 'NO_OWNER', message: 'לארגון אין בעלים פעיל' } });

    // Confidentiality is decided inside the organization, never by the sender.
    const lead = await createLeadRecord({
      organizationId: organization._id,
      createdBy: owner.userId,
      body: { ...req.body, is_confidential: false },
      source: 'webhook',
    });
    await CompanyAuditLog.create({
      organizationId: organization._id,
      actorId: null,
      action: 'lead.created',
      resourceType: 'lead',
      resourceId: String(lead._id),
      metadata: { source: 'webhook' },
      ip: req.ip,
    });
    return res.status(201).json({ data: { id: lead._id } });
  } catch (error) {
    console.error('[companyos] lead webhook', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'שגיאת שרת' } });
  }
});

export default router;
