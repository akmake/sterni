// Runs the real Company OS router against a throwaway local mongod. Never touches production.
import { spawn } from 'child_process';
import fs from 'fs';
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
const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'companyos-work-'));
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
  const mongoose = dep('mongoose');
  const express = dep('express');
  const cookieParser = dep('cookie-parser');
  const jwt = dep('jsonwebtoken');
  await mongoose.connect(`${process.env.MONGO_URL ?? `mongodb://127.0.0.1:${PORT}`}/companyos_work`);
  await mongoose.connection.dropDatabase();

  const User = (await load('models/userModel.js')).default;
  const routes = (await load('companyos/routes.js')).default;
  const { CompanyMember, CompanyOrganization, CompanyAuditLog } = await load('companyos/models.js');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1', routes);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  const hash = '$2b$12$' + 'a'.repeat(53);
  const org = await CompanyOrganization.create({ name: 'Acme', slug: 'acme' });
  const otherOrg = await CompanyOrganization.create({ name: 'Other', slug: 'other' });
  const orgId = org._id;
  const mk = async (name, role, organization = org) => {
    const user = await User.create({ name, email: `${name}@t.co`, passwordHash: hash });
    await CompanyMember.create({ organizationId: organization._id, userId: user._id, role });
    return user;
  };
  const owner = await mk('owner', 'owner');
  const admin = await mk('admin', 'admin');
  const manager = await mk('manager', 'manager');
  const dev = await mk('dev', 'member');
  const dev2 = await mk('dev2', 'member');
  const guest = await mk('guest', 'guest');
  const stranger = await mk('stranger', 'owner', otherOrg);

  const call = async (method, url, as, body) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Cookie: `jwt=${jwt.sign({ id: as._id, role: 'user' }, process.env.JWT_ACCESS_SECRET)}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  const o = `/orgs/${orgId}`;

  // Projects
  check('member cannot create project', (await call('POST', `${o}/projects`, dev, { name: 'X' })).status, 403);
  check('guest cannot create project', (await call('POST', `${o}/projects`, guest, { name: 'X' })).status, 403);
  check('project needs name', (await call('POST', `${o}/projects`, manager, { name: ' ' })).status, 400);
  const created = await call('POST', `${o}/projects`, manager, { name: 'Apollo' });
  check('manager creates project', created.status, 201);
  check('creator is manager', created.json.data.my_role, 'manager');
  const p = created.json.data.id;
  const proj = `${o}/projects/${p}`;

  // Isolation
  check('non-member project 404', (await call('GET', proj, dev)).status, 404);
  check('admin without membership 404', (await call('GET', proj, admin)).status, 404);
  check('owner reaches all', (await call('GET', proj, owner)).status, 200);
  check('other org 404', (await call('GET', `/orgs/${otherOrg._id}/projects/${p}`, stranger)).status, 404);
  check('hidden from list', (await call('GET', `${o}/projects`, dev)).json.data.length, 0);
  check('manager lists it', (await call('GET', `${o}/projects`, manager)).json.data.length, 1);

  // Project members
  check('stranger not addable', (await call('POST', `${proj}/members`, manager, { user_id: stranger._id, role: 'viewer' })).status, 400);
  check('guest as contributor', (await call('POST', `${proj}/members`, manager, { user_id: guest._id, role: 'contributor' })).status, 403);
  const addedGuest = await call('POST', `${proj}/members`, manager, { user_id: guest._id, role: 'viewer' });
  check('guest as viewer', addedGuest.status, 201);
  const addedDev = await call('POST', `${proj}/members`, manager, { user_id: dev._id, role: 'contributor' });
  check('add dev', addedDev.status, 201);
  check('duplicate member', (await call('POST', `${proj}/members`, manager, { user_id: dev._id, role: 'viewer' })).status, 409);
  check('contributor cannot add', (await call('POST', `${proj}/members`, dev, { user_id: dev2._id, role: 'viewer' })).status, 403);
  const managerMember = (await call('GET', `${proj}/members`, manager)).json.data.find((m) => m.name === 'manager');
  check('last manager demote', (await call('PATCH', `${proj}/members/${managerMember.id}`, manager, { role: 'viewer' })).status, 409);
  check('last manager remove', (await call('DELETE', `${proj}/members/${managerMember.id}`, manager)).status, 409);

  // Tasks
  check('viewer cannot create task', (await call('POST', `${o}/tasks`, guest, { project_id: p, title: 'T' })).status, 403);
  check('outsider cannot create task', (await call('POST', `${o}/tasks`, dev2, { project_id: p, title: 'T' })).status, 404);
  check('task needs title', (await call('POST', `${o}/tasks`, dev, { project_id: p, title: '' })).status, 400);
  check('task needs project', (await call('POST', `${o}/tasks`, dev, { title: 'T' })).status, 404);
  check('assignee must be in project', (await call('POST', `${o}/tasks`, dev, { project_id: p, title: 'T', assignee_id: dev2._id })).status, 400);
  const mkTask = async (title, extra = {}) => (await call('POST', `${o}/tasks`, dev, { project_id: p, title, ...extra })).json.data;
  const a = await mkTask('A', { assignee_id: dev._id });
  const b = await mkTask('B');
  const c = await mkTask('C');
  check('task defaults', a.status, 'todo');
  check('task version', a.version, 1);
  check('task project name', a.project_name, 'Apollo');
  check('assignee name', a.assignee_name, 'dev');

  const patch = (as, t, body) => call('PATCH', `${o}/tasks/${t.id}`, as, body);
  check('version required', (await patch(dev, a, { title: 'A2' })).status, 400);
  const first = await patch(dev, a, { title: 'A2', version: 1 });
  check('update', first.status, 200);
  check('version bumped', first.json.data.version, 2);
  const stale = await patch(dev, a, { title: 'A3', version: 1 });
  check('stale edit (AC-23)', stale.status, 409);
  check('conflict code', stale.json.error.code, 'VERSION_CONFLICT');
  check('conflict keeps data', stale.json.error.details.title, 'A2');
  check('viewer cannot edit', (await patch(guest, a, { title: 'Z', version: 2 })).status, 403);
  check('outsider edit 404', (await patch(dev2, a, { title: 'Z', version: 2 })).status, 404);

  // Dependencies
  check('self block', (await patch(dev, b, { blocked_by: [b.id], version: 1 })).status, 400);
  const dep1 = await patch(dev, b, { blocked_by: [a.id], version: 1 });
  check('add dependency', dep1.status, 200);
  check('is_blocked', dep1.json.data.is_blocked, true);
  check('direct cycle', (await patch(dev, a, { blocked_by: [b.id], version: 2 })).status, 400);
  check('c blocked by b', (await patch(dev, c, { blocked_by: [b.id], version: 1 })).status, 200);
  check('transitive cycle', (await patch(dev, a, { blocked_by: [c.id], version: 2 })).status, 400);
  const blockedDone = await patch(dev, b, { status: 'done', version: 2 });
  check('blocked cannot finish', blockedDone.status, 409);
  check('blocked code', blockedDone.json.error.code, 'BLOCKED_BY_OPEN_TASKS');
  const aDone = await patch(dev, a, { status: 'done', version: 2 });
  check('finish blocker', aDone.status, 200);
  const unblocked = await patch(dev, b, { status: 'done', version: 2 });
  check('finish after blocker', unblocked.status, 200);
  check('unblocked', unblocked.json.data.is_blocked, false);

  // Severe bug
  const bug = await mkTask('Bug', { type: 'bug', severity: 'critical' });
  check('severe bug needs resolution', (await patch(dev, bug, { status: 'done', version: 1 })).json.error.code, 'RESOLUTION_REQUIRED');
  check('severe bug with resolution', (await patch(dev, bug, { status: 'done', resolution: 'fixed', version: 1 })).status, 200);

  // My Work and filters
  const mine = await call('GET', `${o}/tasks?assignee=me`, dev);
  check('my tasks', mine.json.data.length, 1);
  check('open only', (await call('GET', `${o}/tasks?assignee=me&open=true`, dev)).json.data.length, 0);
  check('outsider sees none', (await call('GET', `${o}/tasks`, dev2)).json.data.length, 0);
  check('outsider project filter 404', (await call('GET', `${o}/tasks?project_id=${p}`, dev2)).status, 404);
  check('project filter', (await call('GET', `${o}/tasks?project_id=${p}`, dev)).json.data.length, 4);
  const paged = await call('GET', `${o}/tasks?project_id=${p}&limit=3`, dev);
  check('page size', paged.json.data.length, 3);
  const rest = await call('GET', `${o}/tasks?project_id=${p}&limit=3&cursor=${paged.json.meta.next_cursor}`, dev);
  check('next page', rest.json.data.length, 1);
  check('viewer flagged', (await call('GET', `${o}/tasks?project_id=${p}`, guest)).json.data[0].can_edit, false);

  // Project completion gate
  const urgent = await mkTask('U', { priority: 'urgent' });
  const blockedComplete = await call('PATCH', proj, manager, { status: 'completed' });
  check('open urgent blocks completion', blockedComplete.json.error.code, 'OPEN_CRITICAL_TASKS');
  check('contributor cannot edit project', (await call('PATCH', proj, dev, { name: 'H' })).status, 403);
  await patch(dev, urgent, { status: 'cancelled', version: 1 });
  check('completion allowed', (await call('PATCH', proj, manager, { status: 'completed' })).status, 200);

  // Requirements and tests (E03 outcome)
  const req1 = await call('POST', `${proj}/requirements`, dev, { title: 'Login', task_ids: [a.id] });
  check('create requirement', req1.status, 201);
  check('no tests yet (AC-21)', req1.json.data.has_tests, false);
  const r = req1.json.data.id;
  check('viewer cannot write requirement', (await call('POST', `${proj}/requirements`, guest, { title: 'R' })).status, 403);
  check('revision bump', (await call('PATCH', `${proj}/requirements/${r}`, dev, { title: 'Login v2' })).json.data.revision, 2);
  check('status does not bump', (await call('PATCH', `${proj}/requirements/${r}`, dev, { status: 'approved' })).json.data.revision, 2);
  check('bad task link', (await call('PATCH', `${proj}/requirements/${r}`, dev, { task_ids: [new mongoose.Types.ObjectId()] })).status, 400);
  const t1 = await call('POST', `${proj}/tests`, dev, { title: 'Login test', requirement_id: r, task_id: a.id });
  check('create test', t1.status, 201);
  check('requirement has tests', (await call('GET', `${proj}/requirements`, dev)).json.data[0].has_tests, true);
  const fail = await call('PATCH', `${proj}/tests/${t1.json.data.id}`, dev, { result: 'fail', actual: 'crash' });
  check('fail recorded', fail.json.data.result, 'fail');
  check('fail reopens done task', fail.json.data.reopened_task_id, a.id);
  check('task back in review', (await call('GET', `${o}/tasks/${a.id}`, dev)).json.data.status, 'in_review');
  check('bad result', (await call('PATCH', `${proj}/tests/${t1.json.data.id}`, dev, { result: 'x' })).status, 400);

  // Removing someone releases their work and their access
  await patch(dev, c, { assignee_id: dev._id, version: 2 });
  const closed = await mkTask('Closed', { assignee_id: dev._id });
  await patch(dev, closed, { status: 'done', version: 1 });
  const devMember = addedDev.json.data.id;
  check('remove member', (await call('DELETE', `${proj}/members/${devMember}`, manager)).status, 200);
  check('access gone', (await call('GET', proj, dev)).status, 404);
  check('work released', (await call('GET', `${o}/tasks/${c.id}`, manager)).json.data.assignee_id, null);

  check('edit keeps departed assignee', (await patch(manager, closed, { title: 'Closed2', assignee_id: dev._id, version: 2 })).status, 200);
  check('new assignee still validated', (await patch(manager, closed, { assignee_id: dev2._id, version: 3 })).status, 400);

  // Audit
  check('assignee change audited', await CompanyAuditLog.countDocuments({ action: 'task.updated', 'metadata.changes.assignee': { $exists: true } }), 1);
  check('project status audited', await CompanyAuditLog.countDocuments({ action: 'project.status_changed' }), 1);
  check('test result audited', await CompanyAuditLog.countDocuments({ action: 'test.result_recorded' }), 1);

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
