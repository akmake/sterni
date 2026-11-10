import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { CompanyMfa } from './models.js';

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;
const COOKIE = 'company_mfa';
const SESSION_MS = 12 * 60 * 60 * 1000;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (buffer) => {
  let bits = '';
  buffer.forEach((byte) => {
    bits += byte.toString(2).padStart(8, '0');
  });
  return (bits.match(/.{1,5}/g) || []).map((chunk) => BASE32[Number.parseInt(chunk.padEnd(5, '0'), 2)]).join('');
};

const encryptionKey = () => crypto.createHash('sha256').update(`company-mfa:${process.env.JWT_ACCESS_SECRET}`).digest();

export const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
};

const decryptSecret = (stored) => {
  const [iv, tag, data] = stored.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
};

export const newSecret = () => {
  const secret = crypto.randomBytes(20);
  return { secret, base32: base32Encode(secret) };
};

const codeAt = (secret, step) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 10 ** DIGITS).padStart(DIGITS, '0');
};

export const currentStep = () => Math.floor(Date.now() / 1000 / STEP_SECONDS);
export const codeForStep = codeAt;

const safeEqual = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Returns the matching time step, or null. Callers store it to refuse a replayed code.
export const matchTotp = (storedSecret, code, afterStep = -1) => {
  const secret = decryptSecret(storedSecret);
  const now = currentStep();
  for (let step = now - WINDOW; step <= now + WINDOW; step += 1) {
    if (step > afterStep && safeEqual(codeAt(secret, step), code)) return step;
  }
  return null;
};

export const hashRecoveryCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

export const issueMfaCookie = (res, user) => {
  const token = jwt.sign({ id: user._id, v: user.tokenVersion, mfa: true }, process.env.JWT_ACCESS_SECRET, { expiresIn: '12h' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MS,
  });
};

export const clearMfaCookie = (res) => res.clearCookie(COOKIE);

// Bound to the user and to their token version, so a password change ends it too.
export const isMfaVerified = async (req) => {
  try {
    const decoded = jwt.verify(req.cookies[COOKIE], process.env.JWT_ACCESS_SECRET);
    if (!decoded.mfa || String(decoded.id) !== String(req.user._id)) return false;
    const user = await User.findById(req.user._id).select('tokenVersion');
    return Boolean(user) && user.tokenVersion === decoded.v;
  } catch {
    return false;
  }
};

const SENSITIVE_ROLES = ['owner', 'admin'];

export const mfaBlock = async (req, membership, organization) => {
  const record = await CompanyMfa.findOne({ userId: req.user._id }).select('enabled');
  if (record?.enabled) return (await isMfaVerified(req)) ? null : 'MFA_REQUIRED';
  if (SENSITIVE_ROLES.includes(membership.role) && organization.settings?.requireMfa) return 'MFA_SETUP_REQUIRED';
  return null;
};
