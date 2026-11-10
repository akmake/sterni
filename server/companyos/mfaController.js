import crypto from 'crypto';
import QRCode from 'qrcode';
import User from '../models/userModel.js';
import { ApiError, sendData } from './access.js';
import {
  clearMfaCookie,
  encryptSecret,
  hashRecoveryCode,
  isMfaVerified,
  issueMfaCookie,
  matchTotp,
  newSecret,
} from './mfaCore.js';
import { CompanyMember, CompanyMfa } from './models.js';

const RECOVERY_CODES = 8;
const ISSUER = 'Company OS';

const badCode = () => new ApiError(400, 'INVALID_CODE', 'הקוד שגוי');
const cleanCode = (value) => (typeof value === 'string' ? value.replace(/\s/g, '') : '');
const loadUser = (req) => User.findById(req.user._id).select('email tokenVersion');

export const getMfaStatus = async (req, res) => {
  const record = await CompanyMfa.findOne({ userId: req.user._id }).select('enabled');
  sendData(req, res, { enabled: Boolean(record?.enabled), verified: await isMfaVerified(req) });
};

export const startSetup = async (req, res) => {
  const existing = await CompanyMfa.findOne({ userId: req.user._id });
  if (existing?.enabled) throw new ApiError(409, 'MFA_ALREADY_ENABLED', 'אימות דו-שלבי כבר פעיל');

  const { secret, base32 } = newSecret();
  await CompanyMfa.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { secretEnc: encryptSecret(secret), enabled: false, recoveryHashes: [], lastStep: -1 } },
    { upsert: true }
  );

  const user = await loadUser(req);
  const label = encodeURIComponent(`${ISSUER}:${user.email}`);
  const uri = `otpauth://totp/${label}?secret=${base32}&issuer=${encodeURIComponent(ISSUER)}`;
  sendData(req, res, { secret: base32, uri, qr: await QRCode.toDataURL(uri) });
};

export const enable = async (req, res) => {
  const record = await CompanyMfa.findOne({ userId: req.user._id });
  if (!record?.secretEnc || record.enabled) throw new ApiError(409, 'MFA_NOT_PENDING', 'יש להתחיל הגדרה מחדש');
  const step = matchTotp(record.secretEnc, cleanCode(req.body.code));
  if (step === null) throw badCode();

  // Shown once; only hashes are kept.
  const codes = Array.from({ length: RECOVERY_CODES }, () => crypto.randomBytes(5).toString('hex'));
  record.enabled = true;
  record.lastStep = step;
  record.recoveryHashes = codes.map(hashRecoveryCode);
  await record.save();

  issueMfaCookie(res, await loadUser(req));
  sendData(req, res, { enabled: true, recovery_codes: codes });
};

const consumeCode = async (record, code) => {
  const step = matchTotp(record.secretEnc, code, record.lastStep);
  if (step !== null) {
    // Conditional on lastStep so the same code can't be spent twice in parallel.
    const claimed = await CompanyMfa.findOneAndUpdate(
      { _id: record._id, lastStep: record.lastStep },
      { $set: { lastStep: step } }
    );
    return Boolean(claimed);
  }
  const claimed = await CompanyMfa.findOneAndUpdate(
    { _id: record._id, recoveryHashes: hashRecoveryCode(code) },
    { $pull: { recoveryHashes: hashRecoveryCode(code) } }
  );
  return Boolean(claimed);
};

export const verify = async (req, res) => {
  const record = await CompanyMfa.findOne({ userId: req.user._id });
  if (!record?.enabled) throw new ApiError(409, 'MFA_NOT_ENABLED', 'אימות דו-שלבי לא פעיל');
  if (!(await consumeCode(record, cleanCode(req.body.code)))) throw badCode();
  issueMfaCookie(res, await loadUser(req));
  sendData(req, res, { verified: true });
};

export const disable = async (req, res) => {
  const record = await CompanyMfa.findOne({ userId: req.user._id });
  if (!record?.enabled) throw new ApiError(409, 'MFA_NOT_ENABLED', 'אימות דו-שלבי לא פעיל');
  if (!(await consumeCode(record, cleanCode(req.body.code)))) throw badCode();

  const memberships = await CompanyMember.find({ userId: req.user._id, status: 'active', role: { $in: ['owner', 'admin'] } })
    .populate('organizationId', 'settings');
  if (memberships.some((m) => m.organizationId?.settings?.requireMfa)) {
    throw new ApiError(409, 'MFA_REQUIRED_BY_ORG', 'הארגון מחייב אימות דו-שלבי למנהלים');
  }
  await record.deleteOne();
  clearMfaCookie(res);
  sendData(req, res, { enabled: false });
};
