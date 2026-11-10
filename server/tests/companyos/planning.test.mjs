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
const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'companyos-plan-'));
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
  await mongoose.connect(`${process.env.MONGO_URL ?? `mongodb://127.0.0.1:${PORT}`}/companyos_plan`);
  await mongoose.connection.dropDatabase();

  const User = (await load('models/userModel.js')).default;
  const routes = (await load('companyos/routes.js')).default;
  const { setupCompanySocket } = await load('companyos/realtime.js');
  const { CompanyMember, CompanyOrganization, CompanyTask, CompanyAuditLog } = await load('companyos/models.js');
  const { deliverDueSoonReminders } = await load('companyos/workExtrasController.js');

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
  const call = async (method, url, as, body) => {
    const res = await fetch(`${origin}/api/v1${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: cookieFor(as) },
      body: body ? JSON.stringify(body) : undefined,
    });
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
  const p = (await call('POST', `${o}/projects`, owner, { name: 'Apollo' })).json.data;
  const proj = `${o}/projects/${p.id}`;
  await call('POST', `${proj}/members`, owner, { user_id: alice._id, role: 'contributor' });
  await call('POST', `${proj}/members`, owner, { user_id: guest._id, role: 'viewer' });
  const mkTask = async (title, extra = {}, as = alice) => (await call('POST', `${o}/tasks`, as, { project_id: p.id, title, ...extra })).json.data;
  const patch = (as, t, body) => call('PATCH', `${o}/tasks/${t.id}`, as, body);
  const fresh = async (t) => (await call('GET', `${o}/tasks/${t.id}`, owner)).json.data;
  const inboxOf = async (u) => (await call('GET', `${o}/notifications`, u)).json.data;

  // Comments
  const t1 = await mkTask('T1', { assignee_id: owner._id });
  const c = `${o}/tasks/${t1.id}/comments`;
  check('assignment notified', (await inboxOf(owner)).some((n) => n.type === 'task_assigned'), true);
  check('viewer cannot comment', (await call('POST', c, guest, { body: 'x' })).status, 403);
  check('outsider cannot read', (await call('GET', c, bob)).status, 404);
  check('empty comment', (await call('POST', c, alice, { body: ' ' })).status, 400);
  const comment = await call('POST', c, alice, { body: 'looks good' });
  check('comment', comment.status, 201);
  check('assignee notified', (await inboxOf(owner)).some((n) => n.type === 'task_comment'), true);
  check('viewer reads', (await call('GET', c, guest)).json.data.length, 1);
  check('other cannot delete', (await call('DELETE', `${c}/${comment.json.data.id}`, owner)).status, 403);
  check('delete own', (await call('DELETE', `${c}/${comment.json.data.id}`, alice)).status, 200);

  // Time tracking
  const tt = `${o}/tasks/${t1.id}/time`;
  check('bad minutes', (await call('POST', tt, alice, { minutes: 0 })).status, 400);
  check('too many minutes', (await call('POST', tt, alice, { minutes: 5000 })).status, 400);
  check('viewer cannot log', (await call('POST', tt, guest, { minutes: 5 })).status, 403);
  const entry = await call('POST', tt, alice, { minutes: 90, note: 'work' });
  check('log time', entry.status, 201);
  await call('POST', tt, owner, { minutes: 30 });
  check('task total', (await call('GET', tt, alice)).json.meta.total_minutes, 120);
  const summary = (await call('GET', `${proj}/time-summary`, alice)).json.data;
  check('project total', summary.total_minutes, 120);
  check('per person', summary.people.length, 2);
  check('other cannot delete entry', (await call('DELETE', `${tt}/${entry.json.data.id}`, owner)).status, 403);
  check('delete own entry', (await call('DELETE', `${tt}/${entry.json.data.id}`, alice)).status, 200);

  // Milestones and cycles
  check('contributor cannot plan', (await call('POST', `${proj}/milestones`, alice, { name: 'M' })).status, 403);
  const m = (await call('POST', `${proj}/milestones`, owner, { name: 'Beta', due_at: '2030-01-01' })).json.data;
  const cy = (await call('POST', `${proj}/cycles`, owner, { name: 'S1', start_at: '2030-01-01', end_at: '2030-01-14' })).json.data;
  check('bad cycle dates', (await call('POST', `${proj}/cycles`, owner, { name: 'S2', start_at: '2030-02-01', end_at: '2030-01-14' })).status, 400);
  const planned = await patch(alice, t1, { milestone_id: m.id, cycle_id: cy.id, version: 1 });
  check('link plan', planned.json.data.milestone_id, m.id);
  check('milestone counts', (await call('GET', `${proj}/milestones`, alice)).json.data[0].task_count, 1);
  const other = (await call('POST', `${o}/projects`, owner, { name: 'Other' })).json.data;
  const foreign = (await call('POST', `${o}/projects/${other.id}/milestones`, owner, { name: 'X' })).json.data;
  check('foreign milestone', (await patch(alice, t1, { milestone_id: foreign.id, version: 2 })).status, 400);
  check('close milestone', (await call('PATCH', `${proj}/milestones/${m.id}`, owner, { status: 'done' })).json.data.status, 'done');
  check('bad status', (await call('PATCH', `${proj}/cycles/${cy.id}`, owner, { status: 'x' })).status, 400);
  check('delete milestone', (await call('DELETE', `${proj}/milestones/${m.id}`, owner)).status, 200);
  check('task survives', (await fresh(t1)).milestone_id, null);

  // Subtasks and checklist gate completion
  const parent = await mkTask('Parent');
  const child = await mkTask('Child', { parent_id: parent.id });
  check('subtask', child.parent_id, parent.id);
  check('two levels refused', (await call('POST', `${o}/tasks`, alice, { project_id: p.id, title: 'x', parent_id: child.id })).status, 400);
  check('self parent', (await patch(alice, parent, { parent_id: parent.id, version: 1 })).status, 400);
  check('open subtask blocks', (await patch(alice, parent, { status: 'done', version: 1 })).json.error.code, 'OPEN_SUBTASKS');
  await patch(alice, child, { status: 'done', version: 1 });
  check('after subtask', (await patch(alice, parent, { status: 'in_review', version: 1 })).status, 200);
  const list = await mkTask('List', { checklist: [{ text: 'a' }, { text: 'b', done: true }], acceptance_criteria: 'works' });
  check('checklist stored', list.checklist.length, 2);
  check('criteria stored', list.acceptance_criteria, 'works');
  check('open checklist blocks', (await patch(alice, list, { status: 'done', version: 1 })).json.error.code, 'CHECKLIST_INCOMPLETE');
  check('complete checklist', (await patch(alice, list, { checklist: [{ text: 'a', done: true }, { text: 'b', done: true }], status: 'done', version: 1 })).status, 200);

  // Recurring work
  const rec = await mkTask('Weekly', { recurrence: 'weekly', due_at: '2030-03-01T00:00:00.000Z', assignee_id: alice._id, checklist: [{ text: 'x', done: true }] });
  const closed = await patch(alice, rec, { status: 'done', version: 1 });
  check('closed', closed.status, 200);
  const copies = await CompanyTask.find({ title: 'Weekly' }).sort({ _id: 1 });
  check('next occurrence', copies.length, 2);
  check('next due', copies[1].dueAt.toISOString(), '2030-03-08T00:00:00.000Z');
  check('next open', copies[1].status, 'todo');
  check('checklist reset', copies[1].checklist[0].done, false);
  check('schedule moved', copies[0].recurrence, null);
  await patch(alice, rec, { status: 'todo', version: 2 });
  await patch(alice, rec, { status: 'done', version: 3 });
  check('reclose no spawn', await CompanyTask.countDocuments({ title: 'Weekly' }), 2);
  check('bad recurrence', (await call('POST', `${o}/tasks`, alice, { project_id: p.id, title: 'x', recurrence: 'hourly' })).status, 400);

  // Templates
  await mkTask('Tpl', { due_at: new Date(Date.now() + 5 * 86400000).toISOString() });
  check('contributor cannot template', (await call('POST', `${proj}/save-as-template`, alice, { name: 'T' })).status, 403);
  const tpl = await call('POST', `${proj}/save-as-template`, owner, { name: 'Standard' });
  check('save template', tpl.status, 201);
  const fromTpl = await call('POST', `${o}/projects/from-template`, owner, { template_id: tpl.json.data.id, name: 'Clone' });
  check('create from template', fromTpl.status, 201);
  check('tasks copied', fromTpl.json.data.task_count, tpl.json.data.task_count);
  const cloned = (await call('GET', `${o}/tasks?project_id=${fromTpl.json.data.id}&limit=100`, owner)).json.data;
  check('clone tasks open', cloned.every((t) => t.status === 'todo'), true);
  check('clone no assignee', cloned.every((t) => t.assignee_id === null), true);
  check('member cannot clone', (await call('POST', `${o}/projects/from-template`, alice, { template_id: tpl.json.data.id, name: 'X' })).status, 403);
  check('bad template', (await call('POST', `${o}/projects/from-template`, owner, { template_id: new mongoose.Types.ObjectId(), name: 'X' })).status, 404);
  check('list templates', (await call('GET', `${o}/project-templates`, alice)).json.data.length, 1);

  // Bulk edit
  const b1 = await mkTask('B1');
  const b2 = await mkTask('B2');
  check('bulk needs ids', (await call('PATCH', `${o}/tasks/bulk`, alice, { status: 'todo' })).status, 400);
  check('bulk needs change', (await call('PATCH', `${o}/tasks/bulk`, alice, { ids: [b1.id] })).status, 400);
  check('bulk refuses done', (await call('PATCH', `${o}/tasks/bulk`, alice, { ids: [b1.id], status: 'done' })).status, 400);
  const bulk = await call('PATCH', `${o}/tasks/bulk`, alice, { ids: [b1.id, b2.id], priority: 'high' });
  check('bulk updated', bulk.json.data.updated, 2);
  check('bulk applied', (await fresh(b1)).priority, 'high');
  check('bulk bumps version', (await fresh(b1)).version, 2);
  check('viewer bulk skipped', (await call('PATCH', `${o}/tasks/bulk`, guest, { ids: [b1.id], priority: 'low' })).json.data.updated, 0);
  check('outsider bulk skipped', (await call('PATCH', `${o}/tasks/bulk`, carol, { ids: [b1.id], priority: 'low' })).json.data.updated, 0);
  check('still high', (await fresh(b1)).priority, 'high');
  check('bulk audited', await CompanyAuditLog.countDocuments({ action: 'task.bulk_updated' }) >= 1, true);

  // Workload follows access
  const workloadRows = (await call('GET', `${o}/workload`, owner)).json.data;
  check('workload has people', workloadRows.some((row) => row.name === 'alice'), true);
  check('outsider workload empty', (await call('GET', `${o}/workload`, carol)).json.data.length, 0);

  // Due-soon reminders
  const due = await mkTask('Due', { assignee_id: alice._id, due_at: new Date(Date.now() + 3600000).toISOString() }, owner);
  await deliverDueSoonReminders();
  await deliverDueSoonReminders();
  check('due reminder once', (await inboxOf(alice)).filter((n) => n.type === 'due_soon' && n.title.includes('Due')).length, 1);
  await patch(owner, due, { due_at: new Date(Date.now() + 7200000).toISOString(), version: 1 });
  await deliverDueSoonReminders();
  check('new date reminds again', (await inboxOf(alice)).filter((n) => n.type === 'due_soon' && n.title.includes('Due')).length, 2);

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
