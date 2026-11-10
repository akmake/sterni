// Runs the real Company OS router and socket layer against a throwaway local mongod.
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

process.env.NODE_ENV = 'development';
process.env.JWT_ACCESS_SECRET = 'test-access';
process.env.JWT_REFRESH_SECRET = 'test-refresh';

const serverDir = fileURLToPath(new URL('../..', import.meta.url));
const load = (p) => import(pathToFileURL(path.join(serverDir, p)).href);
const dep = createRequire(path.join(serverDir, 'app.js'));

const binary = path.join(os.homedir(), '.cache/mongodb-binaries/mongod-x64-win32-7.0.24.exe');
const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'companyos-id-'));
const PORT = 27000 + Math.floor(Math.random() * 900);
const mongod = process.env.MONGO_URL ? null : spawn(binary, ['--dbpath', dbPath, '--port', String(PORT), '--bind_ip', '127.0.0.1'], { stdio: 'ignore' });

let failures = 0;
let passes = 0;
const check = (label, actual, expected) => {
  if (actual === expected) passes += 1;
  else {
    failures += 1;
    console.log(`FAIL ${label}: expected ${expected}, got ${actual}`);
  }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.MONGO_URL) await wait(2500);
  const mongoose = dep('mongoose');
  const express = dep('express');
  const cookieParser = dep('cookie-parser');
  const jwt = dep('jsonwebtoken');
  const { Server } = dep('socket.io');
  const { io: connect } = createRequire(path.join(serverDir, '../client/src/x.js'))('socket.io-client');
  await mongoose.connect(`${process.env.MONGO_URL ?? `mongodb://127.0.0.1:${PORT}`}/companyos_id`);
  await mongoose.connection.dropDatabase();

  const User = (await load('models/userModel.js')).default;
  const routes = (await load('companyos/routes.js')).default;
  const { setupCompanySocket } = await load('companyos/realtime.js');
  const { CompanyMember, CompanyOrganization, CompanyMfa, CompanyAuditLog, CompanyProjectMember } = await load('companyos/models.js');
  const { codeForStep, currentStep } = await load('companyos/mfaCore.js');
  const { recordLogin } = await load('companyos/loginAudit.js');
  const totp = (base32, offset = 0) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const ch of base32) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
    const bytes = bits.match(/.{8}/g).map((b) => Number.parseInt(b, 2));
    return codeForStep(Buffer.from(bytes), currentStep() + offset);
  };

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1', routes);
  const httpServer = http.createServer(app);
  setupCompanySocket(new Server(httpServer));
  await new Promise((r) => httpServer.listen(0, r));
  const origin = `http://127.0.0.1:${httpServer.address().port}`;

  const hash = '$2b$12$' + 'a'.repeat(53);
  const org = await CompanyOrganization.create({ name: 'Acme', slug: 'acme' });
  const otherOrg = await CompanyOrganization.create({ name: 'Other', slug: 'other' });
  const mk = async (name, role, organization = org) => {
    const user = await User.create({ name, email: `${name}@t.co`, passwordHash: hash });
    await CompanyMember.create({ organizationId: organization._id, userId: user._id, role });
    return user;
  };
  const owner = await mk('owner', 'owner');
  const alice = await mk('alice', 'member');
  const bob = await mk('bob', 'member');
  const guest = await mk('guest', 'guest');
  const stranger = await mk('stranger', 'owner', otherOrg);

  const cookieFor = (u) => `jwt=${jwt.sign({ id: u._id, role: 'user' }, process.env.JWT_ACCESS_SECRET)}`;
  const extraCookies = new Map();
  const call = async (method, url, as, body) => {
    const res = await fetch(`${origin}/api/v1${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: [cookieFor(as), extraCookies.get(String(as._id))].filter(Boolean).join('; ') },
      body: body ? JSON.stringify(body) : undefined,
    });
    const issued = res.headers.getSetCookie().find((c) => c.startsWith('company_mfa='));
    if (issued) extraCookies.set(String(as._id), issued.split(';')[0]);
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  const o = `/orgs/${org._id}`;

  const sockets = [];
  const listen = (user) =>
    new Promise((resolve, reject) => {
      const socket = connect(`${origin}/company`, {
        extraHeaders: { Cookie: cookieFor(user) },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      const received = [];
      socket.onAny((event, payload) => received.push({ event, payload }));
      socket.on('ready', () => resolve({ socket, received }));
      socket.on('connect_error', reject);
    });


  const carol = await mk('carol', 'member');
  const admin = await mk('admin', 'admin');
  const members = async () => (await call('GET', `${o}/members`, owner)).json.data;
  const idOf = async (name) => (await members()).find((m) => m.name === name).id;

  // Teams
  check('member cannot create team', (await call('POST', `${o}/teams`, alice, { name: 'x' })).status, 403);
  check('team needs name', (await call('POST', `${o}/teams`, owner, { name: ' ' })).status, 400);
  const team = (await call('POST', `${o}/teams`, owner, { name: 'Dev' })).json.data;
  const t = `${o}/teams/${team.id}`;
  check('stranger not addable', (await call('POST', `${t}/members`, owner, { user_id: stranger._id })).status, 400);
  check('add to team', (await call('POST', `${t}/members`, owner, { user_id: alice._id, is_lead: true })).status, 201);
  check('duplicate', (await call('POST', `${t}/members`, owner, { user_id: alice._id })).status, 409);
  await call('POST', `${t}/members`, owner, { user_id: bob._id });
  const listed = (await call('GET', `${o}/teams`, owner)).json.data[0];
  check('team members', listed.members.length, 2);
  check('lead flag', listed.members.find((m) => m.name === 'alice').is_lead, true);
  check('guest cannot list teams', (await call('GET', `${o}/teams`, guest)).status, 403);

  // A plain member reads their own team (spec 7.1); managers keep the full list
  const aliceSees = (await call('GET', `${o}/members`, alice)).json.data.map((m) => m.name);
  check('sees teammate', aliceSees.includes('bob'), true);
  check('sees management', aliceSees.includes('owner'), true);
  check('hides other people', aliceSees.includes('carol'), false);
  const carolSees = (await call('GET', `${o}/members`, carol)).json.data.map((m) => m.name);
  check('no team, no narrowing', carolSees.includes('alice'), true);
  check('admin sees all', (await call('GET', `${o}/members`, admin)).json.data.some((m) => m.name === 'carol'), true);
  check('remove from team', (await call('DELETE', `${t}/members/${bob._id}`, owner)).status, 200);
  check('rename', (await call('PATCH', t, owner, { name: 'Core' })).json.data.name, 'Core');
  check('delete team', (await call('DELETE', t, owner)).status, 200);
  check('deleted', (await call('GET', `${o}/teams`, owner)).json.data.length, 0);

  // Time-limited organization role
  const carolMember = await idOf('carol');
  const past = '2020-01-01T00:00:00.000Z';
  const future = new Date(Date.now() + 3600000).toISOString();
  check('past expiry', (await call('PATCH', `${o}/members/${carolMember}`, owner, { role: 'manager', expires_at: past })).status, 400);
  check('expiry needs role', (await call('PATCH', `${o}/members/${carolMember}`, owner, { status: 'active', expires_at: future })).status, 400);
  check('owner not temporary', (await call('PATCH', `${o}/members/${carolMember}`, owner, { role: 'owner', expires_at: future })).status, 400);
  check('temporary grant', (await call('PATCH', `${o}/members/${carolMember}`, owner, { role: 'manager', expires_at: future })).status, 200);
  check('has manager powers', (await call('POST', `${o}/projects`, carol, { name: 'Temp' })).status, 201);
  await CompanyMember.updateOne({ _id: carolMember }, { roleExpiresAt: new Date(Date.now() - 1000) });
  check('expired blocks', (await call('POST', `${o}/projects`, carol, { name: 'Late' })).status, 403);
  check('role restored', (await CompanyMember.findById(carolMember)).role, 'member');
  check('expiry cleared', (await CompanyMember.findById(carolMember)).roleExpiresAt, null);
  check('expiry audited', await CompanyAuditLog.countDocuments({ action: 'member.role_expired' }), 1);

  // Time-limited project access
  const project = (await call('POST', `${o}/projects`, owner, { name: 'Apollo' })).json.data;
  const proj = `${o}/projects/${project.id}`;
  check('past project expiry', (await call('POST', `${proj}/members`, owner, { user_id: bob._id, role: 'viewer', expires_at: past })).status, 400);
  check('temporary project access', (await call('POST', `${proj}/members`, owner, { user_id: bob._id, role: 'viewer', expires_at: future })).status, 201);
  check('can read', (await call('GET', proj, bob)).status, 200);
  await CompanyProjectMember.updateOne({ projectId: project.id, userId: bob._id }, { expiresAt: new Date(Date.now() - 1000) });
  check('expired project', (await call('GET', proj, bob)).status, 404);
  check('expired not listed', (await call('GET', `${o}/projects`, bob)).json.data.length, 0);

  // Login audit
  recordLogin(alice, { ip: '1.2.3.4' }, true);
  recordLogin(alice, { ip: '1.2.3.4' }, false);
  recordLogin(stranger, { ip: '1.2.3.4' }, true);
  await wait(200);
  check('login audited', await CompanyAuditLog.countDocuments({ action: 'auth.login', organizationId: org._id }), 1);
  check('failure audited', await CompanyAuditLog.countDocuments({ action: 'auth.login_failed', organizationId: org._id }), 1);
  check('other org separate', await CompanyAuditLog.countDocuments({ action: 'auth.login', organizationId: otherOrg._id }), 1);

  // MFA policy cannot lock the owner out
  check('policy needs own mfa', (await call('PATCH', o, owner, { require_mfa: true })).json.error.code, 'MFA_SETUP_REQUIRED');

  // MFA setup
  check('status off', (await call('GET', '/mfa', admin)).json.data.enabled, false);
  const setup = (await call('POST', '/mfa/setup', admin, {})).json.data;
  check('qr returned', setup.qr.startsWith('data:image/png'), true);
  check('secret not stored raw', await CompanyMfa.countDocuments({ secretEnc: setup.secret }), 0);
  check('wrong code', (await call('POST', '/mfa/enable', admin, { code: '000000' })).status, 400);
  check('not active yet', (await call('GET', `${o}/members`, admin)).status, 200);
  const enabled = await call('POST', '/mfa/enable', admin, { code: totp(setup.secret) });
  check('enable', enabled.status, 200);
  check('recovery codes', enabled.json.data.recovery_codes.length, 8);
  check('recovery hashed', await CompanyMfa.countDocuments({ recoveryHashes: enabled.json.data.recovery_codes[0] }), 0);
  check('verified after enable', (await call('GET', `${o}/members`, admin)).status, 200);
  check('second setup refused', (await call('POST', '/mfa/setup', admin, {})).status, 409);

  // Step-up enforcement
  extraCookies.delete(String(admin._id));
  const blocked = await call('GET', `${o}/members`, admin);
  check('blocked without step-up', blocked.json.error.code, 'MFA_REQUIRED');
  check('me still reachable', (await call('GET', '/me', admin)).json.data.mfa.verified, false);
  check('bad verify', (await call('POST', '/mfa/verify', admin, { code: '123456' })).status, 400);
  // Moving one step ahead: the enable code from the current step can't be reused.
  check('replay refused', (await call('POST', '/mfa/verify', admin, { code: totp(setup.secret) })).status, 400);
  check('verify', (await call('POST', '/mfa/verify', admin, { code: totp(setup.secret, 1) })).status, 200);
  check('unblocked', (await call('GET', `${o}/members`, admin)).status, 200);

  // Recovery code is single use
  extraCookies.delete(String(admin._id));
  const recovery = enabled.json.data.recovery_codes[0];
  check('recovery works', (await call('POST', '/mfa/verify', admin, { code: recovery })).status, 200);
  extraCookies.delete(String(admin._id));
  check('recovery single use', (await call('POST', '/mfa/verify', admin, { code: recovery })).status, 400);
  check('other recovery', (await call('POST', '/mfa/verify', admin, { code: enabled.json.data.recovery_codes[1] })).status, 200);

  // A session bound to another user or an older password does not count
  const adminCookie = extraCookies.get(String(admin._id));
  extraCookies.set(String(alice._id), adminCookie);
  check('cookie bound to user', (await call('GET', '/me', alice)).json.data.mfa.verified, false);
  extraCookies.delete(String(alice._id));
  await User.updateOne({ _id: admin._id }, { $inc: { tokenVersion: 1 } });
  check('password change ends it', (await call('GET', `${o}/members`, admin)).json.error.code, 'MFA_REQUIRED');
  await User.updateOne({ _id: admin._id }, { $inc: { tokenVersion: -1 } });

  // Organization policy
  const ownerSetup = (await call('POST', '/mfa/setup', owner, {})).json.data;
  await call('POST', '/mfa/enable', owner, { code: totp(ownerSetup.secret) });
  check('admin cannot set policy', (await call('PATCH', o, admin, { require_mfa: true })).status, 403);
  check('owner sets policy', (await call('PATCH', o, owner, { require_mfa: true })).status, 200);
  check('policy audited', await CompanyAuditLog.countDocuments({ action: 'organization.mfa_policy_changed' }), 1);
  const admin2 = await mk('admin2', 'admin');
  check('admin must set up', (await call('GET', `${o}/members`, admin2)).json.error.code, 'MFA_SETUP_REQUIRED');
  check('member unaffected', (await call('GET', `${o}/projects`, carol)).status, 200);
  check('disable refused by policy', (await call('POST', '/mfa/disable', owner, { code: totp(ownerSetup.secret, 1) })).json.error.code, 'MFA_REQUIRED_BY_ORG');

  sockets.forEach((s) => s.close());
  await new Promise((r) => httpServer.close(r));
  await mongoose.disconnect();
}

main()
  .catch((e) => {
    failures += 1;
    console.log('CRASH', e);
  })
  .finally(() => {
    console.log(`passed=${passes} failed=${failures}`);
    mongod?.kill();
    setTimeout(() => {
      try {
        fs.rmSync(dbPath, { recursive: true, force: true });
      } catch {
        // Temp dir; Windows may hold the lock briefly.
      }
      process.exit(failures ? 1 : 0);
    }, 1500);
  });
