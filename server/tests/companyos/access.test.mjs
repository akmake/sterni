// Runs the real Company OS router against a throwaway local mongod. Never touches production.
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

process.env.NODE_ENV = 'development';
process.env.JWT_ACCESS_SECRET = 'test-access';
process.env.JWT_REFRESH_SECRET = 'test-refresh';

const serverDir = fileURLToPath(new URL('../..', import.meta.url));
const load = (p) => import(pathToFileURL(path.join(serverDir, p)).href);
const requireFromServer = createRequire(path.join(serverDir, 'app.js'));
const dep = async (name) => requireFromServer(name);

const binary = path.join(os.homedir(), '.cache/mongodb-binaries/mongod-x64-win32-7.0.24.exe');
const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'companyos-db-'));
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

async function main() {
  if (!process.env.MONGO_URL) await new Promise((r) => setTimeout(r, 2500));
  const mongoose = await dep('mongoose', 'index.js');
  const express = await dep('express', 'index.js');
  const cookieParser = await dep('cookie-parser', 'index.js');
  const csurf = await dep('csurf', 'index.js');
  const jwt = await dep('jsonwebtoken', 'index.js');
  await mongoose.connect(`${process.env.MONGO_URL ?? `mongodb://127.0.0.1:${PORT}`}/companyos_test`);
  await mongoose.connection.dropDatabase();

  const User = (await load('models/userModel.js')).default;
  const routes = (await load('companyos/routes.js')).default;
  const { CompanyInvite, CompanyAuditLog } = await load('companyos/models.js');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const csrfProtection = csurf({ cookie: { httpOnly: true, sameSite: 'strict' } });
  app.get('/api/csrf-token', csrfProtection, (req, res) => res.json({ csrfToken: req.csrfToken() }));
  app.use(csrfProtection);
  app.use('/api/v1', routes);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.code || err.message }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  const hash = '$2b$12$' + 'a'.repeat(53);
  const mk = (name, role = 'user') => User.create({ name, email: `${name}@t.co`, passwordHash: hash, role });
  const session = (u) => `jwt=${jwt.sign({ id: u._id, role: u.role }, process.env.JWT_ACCESS_SECRET)}`;

  const csrfRes = await fetch(`${base}/api/csrf-token`);
  const csrfCookie = csrfRes.headers.getSetCookie()[0].split(';')[0];
  const { csrfToken } = await csrfRes.json();

  const call = async (method, url, { as, body, csrf = true } = {}) => {
    const cookies = [csrfCookie];
    if (as) cookies.push(session(as));
    const res = await fetch(`${base}/api/v1${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies.join('; '),
        ...(csrf && method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json, cookies: res.headers.getSetCookie() };
  };

  const root = await mk('root', 'admin');
  const plain = await mk('plain');
  const existing = await mk('existing');
  const linkExisting = await mk('linkexisting');
  const outsider = await mk('outsider');

  // Bootstrap
  check('no session', (await call('GET', '/me')).status, 401);
  check('write without CSRF', (await call('POST', '/orgs', { as: root, body: { name: 'X' }, csrf: false })).status, 403);
  check('non-admin create org', (await call('POST', '/orgs', { as: plain, body: { name: 'X' } })).status, 403);
  check('can_create before', (await call('GET', '/me', { as: root })).json.data.can_create_organization, true);
  const created = await call('POST', '/orgs', { as: root, body: { name: 'Acme' } });
  check('create org', created.status, 201);
  const orgId = created.json.data.id;
  check('second org', (await call('POST', '/orgs', { as: root, body: { name: 'Y' } })).status, 409);
  const me = (await call('GET', '/me', { as: root })).json.data;
  check('owner role', me.memberships[0].role, 'owner');
  check('can_create after', me.can_create_organization, false);

  // Invites: new account
  check('invite as owner role', (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'a@t.co', role: 'owner' } })).status, 403);
  check('invite bad email', (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'nope', role: 'member' } })).status, 400);
  const adminInvite = await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'newadmin@t.co', role: 'admin' } });
  check('create invite', adminInvite.status, 201);
  const token = adminInvite.json.data.token;
  check('token not stored raw', await CompanyInvite.countDocuments({ tokenHash: token }), 0);
  check('preview invite', (await call('GET', `/invites/${token}`)).json.data.account_exists, false);
  check('short password', (await call('POST', `/invites/${token}/accept`, { body: { name: 'N', password: 'short' } })).status, 400);
  const accepted = await call('POST', `/invites/${token}/accept`, { body: { name: 'NewAdmin', password: 'longenough1' } });
  check('accept', accepted.status, 200);
  check('session issued', accepted.cookies.some((c) => c.startsWith('jwt=')), true);
  check('single use', (await call('POST', `/invites/${token}/accept`, { body: { name: 'Z', password: 'longenough1' } })).status, 404);
  const newAdmin = await User.findOne({ email: 'newadmin@t.co' });
  check('new user is not a site admin', newAdmin.role, 'user');

  // Link invite: the manager chooses only a role; the recipient supplies identity.
  const openInvite = await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { role: 'member' } });
  check('create open invite', openInvite.status, 201);
  check('open invite has no email', openInvite.json.data.email, null);
  const openToken = openInvite.json.data.token;
  check('open preview asks email', (await call('GET', `/invites/${openToken}`)).json.data.requires_email, true);
  const openAccepted = await call('POST', `/invites/${openToken}/accept`, {
    body: { name: 'Link User', email: 'link@t.co', password: 'longenough1' },
  });
  check('accept open invite', openAccepted.status, 200);
  check('open invite stores claimant', (await CompanyInvite.findById(openInvite.json.data.id)).email, 'link@t.co');
  check('open invite creates member', await User.countDocuments({ email: 'link@t.co' }), 1);

  const existingOpen = (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { role: 'guest' } })).json.data;
  check('open existing needs login', (await call('POST', `/invites/${existingOpen.token}/accept`, { body: { email: 'linkexisting@t.co' } })).status, 403);
  check('open existing accepts session', (await call('POST', `/invites/${existingOpen.token}/accept`, { as: linkExisting, body: {} })).status, 200);
  const memberOpen = (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { role: 'member' } })).json.data;
  check('open link cannot change current member role', (await call('POST', `/invites/${memberOpen.token}/accept`, { as: root, body: {} })).status, 409);

  // Invites: existing account must prove identity
  const memberToken = (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'existing@t.co', role: 'member' } })).json.data.token;
  check('existing, no session', (await call('POST', `/invites/${memberToken}/accept`, { body: {} })).status, 403);
  check('existing, wrong session', (await call('POST', `/invites/${memberToken}/accept`, { as: outsider, body: {} })).status, 403);
  check('existing, right session', (await call('POST', `/invites/${memberToken}/accept`, { as: existing, body: {} })).status, 200);
  check('reinvite active member', (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'existing@t.co', role: 'member' } })).status, 409);

  // Expired and revoked links
  const expiring = (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'late@t.co', role: 'member' } })).json.data;
  await CompanyInvite.updateOne({ _id: expiring.id }, { expiresAt: new Date(Date.now() - 1000) });
  check('expired', (await call('GET', `/invites/${expiring.token}`)).status, 404);
  const revoking = (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'rev@t.co', role: 'member' } })).json.data;
  check('revoke', (await call('DELETE', `/orgs/${orgId}/invites/${revoking.id}`, { as: root })).status, 200);
  check('revoked link', (await call('GET', `/invites/${revoking.token}`)).status, 404);
  const replaced = (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'dup@t.co', role: 'member' } })).json.data;
  await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'dup@t.co', role: 'member' } });
  check('newer invite replaces', (await call('GET', `/invites/${replaced.token}`)).status, 404);

  // Guest
  const guestToken = (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'plain@t.co', role: 'guest' } })).json.data.token;
  await call('POST', `/invites/${guestToken}/accept`, { as: plain, body: {} });

  // Isolation (AC-17)
  check('outsider org', (await call('GET', `/orgs/${orgId}/members`, { as: outsider })).status, 404);
  check('bad org id', (await call('GET', '/orgs/not-an-id/members', { as: root })).status, 404);
  check('unknown org', (await call('GET', `/orgs/${new mongoose.Types.ObjectId()}/members`, { as: root })).status, 404);

  // Role limits
  check('guest members', (await call('GET', `/orgs/${orgId}/members`, { as: plain })).status, 403);
  const asMember = await call('GET', `/orgs/${orgId}/members`, { as: existing });
  check('member reads team', asMember.status, 200);
  check('member cannot manage', asMember.json.data.some((m) => m.can_manage), false);
  check('member audit', (await call('GET', `/orgs/${orgId}/audit`, { as: existing })).status, 403);
  check('member invites', (await call('GET', `/orgs/${orgId}/invites`, { as: existing })).status, 403);
  check('member rename org', (await call('PATCH', `/orgs/${orgId}`, { as: existing, body: { name: 'H' } })).status, 403);

  const list = (await call('GET', `/orgs/${orgId}/members`, { as: root })).json;
  const idOf = (name) => list.data.find((m) => m.name === name).id;
  check('owner assignable', list.meta.assignable_roles.length, 5);
  const patch = (as, name, body) => call('PATCH', `/orgs/${orgId}/members/${idOf(name)}`, { as, body });

  check('member patches', (await patch(existing, 'plain', { role: 'member' })).status, 403);
  check('admin vs owner', (await patch(newAdmin, 'root', { role: 'member' })).status, 403);
  check('admin grants admin', (await patch(newAdmin, 'existing', { role: 'admin' })).status, 403);
  check('admin grants owner', (await patch(newAdmin, 'existing', { role: 'owner' })).status, 403);
  check('admin grants manager', (await patch(newAdmin, 'existing', { role: 'manager' })).status, 200);
  check('self change', (await patch(root, 'root', { role: 'member' })).status, 403);
  check('bad status', (await patch(root, 'existing', { status: 'x' })).status, 400);
  check('bad role', (await patch(root, 'existing', { role: 'x' })).status, 403);
  check('empty patch', (await patch(root, 'existing', {})).status, 400);

  // Revocation applies immediately (E02 acceptance)
  check('before suspend', (await call('GET', `/orgs/${orgId}/members`, { as: existing })).status, 200);
  check('suspend', (await patch(newAdmin, 'existing', { status: 'suspended' })).status, 200);
  check('suspended blocked', (await call('GET', `/orgs/${orgId}/members`, { as: existing })).status, 404);
  check('suspended /me', (await call('GET', '/me', { as: existing })).json.data.memberships.length, 0);
  check('invite cannot unsuspend', (await call('POST', `/orgs/${orgId}/invites`, { as: root, body: { email: 'existing@t.co', role: 'member' } })).status, 409);
  check('reinstate', (await patch(root, 'existing', { status: 'active' })).status, 200);
  check('reinstated', (await call('GET', `/orgs/${orgId}/members`, { as: existing })).status, 200);

  // Audit
  const page = (await call('GET', `/orgs/${orgId}/audit?limit=3`, { as: root })).json;
  check('audit page', page.data.length, 3);
  check('audit newest first', page.data[0].action, 'member.updated');
  check('audit actor', page.data[0].actor_name, 'root');
  const next = (await call('GET', `/orgs/${orgId}/audit?limit=3&cursor=${page.meta.next_cursor}`, { as: root })).json;
  check('audit no overlap', next.data.some((e) => page.data.some((p) => p.id === e.id)), false);
  check('audit metadata', (await CompanyAuditLog.findOne({ action: 'invite.accepted' })).metadata.role, 'admin');
  check('unknown route', (await call('GET', '/nope', { as: root })).status, 404);

  server.close();
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
