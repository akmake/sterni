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
const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'companyos-chat-'));
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
  await mongoose.connect(`${process.env.MONGO_URL ?? `mongodb://127.0.0.1:${PORT}`}/companyos_chat`);
  await mongoose.connection.dropDatabase();

  const User = (await load('models/userModel.js')).default;
  const routes = (await load('companyos/routes.js')).default;
  const { setupCompanySocket } = await load('companyos/realtime.js');
  const { CompanyMember, CompanyOrganization, CompanyMessage } = await load('companyos/models.js');

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

  // Socket authentication
  const refused = await new Promise((resolve) => {
    const socket = connect(`${origin}/company`, { transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.on('connect', () => resolve(false));
    socket.on('connect_error', () => resolve(true));
  });
  check('socket needs session', refused, true);

  const aliceLive = await listen(alice);
  const bobLive = await listen(bob);
  const guestLive = await listen(guest);
  const ownerLive = await listen(owner);
  const strangerLive = await listen(stranger);
  const got = (live, event) => live.received.filter((r) => r.event === event);

  // Public channel
  check('guest cannot create channel', (await call('POST', `${o}/conversations`, guest, { name: 'x' })).status, 403);
  check('channel needs name', (await call('POST', `${o}/conversations`, alice, { name: ' ' })).status, 400);
  const general = (await call('POST', `${o}/conversations`, alice, { name: 'general' })).json.data;
  const g = `${o}/conversations/${general.id}`;
  check('bob sees public', (await call('GET', `${o}/conversations`, bob)).json.data.length, 1);
  check('guest does not see public', (await call('GET', `${o}/conversations`, guest)).json.data.length, 0);
  check('guest read public 404', (await call('GET', `${g}/messages`, guest)).status, 404);
  check('other org 404', (await call('GET', `/orgs/${otherOrg._id}/conversations/${general.id}/messages`, stranger)).status, 404);

  check('empty message', (await call('POST', `${g}/messages`, alice, { body: '  ' })).status, 400);
  const first = await call('POST', `${g}/messages`, alice, { body: 'hello', client_id: 'c1' });
  check('send', first.status, 201);
  check('seq starts at 1', first.json.data.seq, 1);
  await wait(200);
  check('bob live', got(bobLive, 'message_new').length, 1);
  check('live body', got(bobLive, 'message_new')[0]?.payload.body, 'hello');
  check('guest not live on public', got(guestLive, 'message_new').length, 0);
  check('stranger not live', got(strangerLive, 'message_new').length, 0);

  // Retry safety (AC-19)
  const retry = await call('POST', `${g}/messages`, alice, { body: 'hello', client_id: 'c1' });
  check('retry returns same', retry.json.data.id, first.json.data.id);
  check('no duplicate', await CompanyMessage.countDocuments({ conversationId: general.id }), 1);
  await Promise.all(['r1', 'r1', 'r1'].map((id) => call('POST', `${g}/messages`, bob, { body: 'race', client_id: id })));
  check('race no duplicate', await CompanyMessage.countDocuments({ conversationId: general.id, clientId: 'r1' }), 1);

  // Ordering and recovery
  for (let i = 0; i < 5; i += 1) await call('POST', `${g}/messages`, alice, { body: `m${i}` });
  const latest = (await call('GET', `${g}/messages?limit=3`, bob)).json;
  check('page size', latest.data.length, 3);
  check('oldest first in page', latest.data[0].seq < latest.data[2].seq, true);
  const older = (await call('GET', `${g}/messages?limit=3&before_seq=${latest.meta.next_cursor}`, bob)).json;
  check('older page before', older.data[older.data.length - 1].seq < latest.data[0].seq, true);
  const lastSeq = latest.data[2].seq;
  const recovery = (await call('GET', `${g}/messages?after_seq=${lastSeq - 2}`, bob)).json;
  check('recovery from cursor', recovery.data.length, 2);
  check('recovery ascending', recovery.data[0].seq, lastSeq - 1);

  // Unread
  const unreadOf = async (user) => (await call('GET', `${o}/conversations`, user)).json.data[0].unread_count;
  check('bob unread counts', (await unreadOf(bob)) > 0, true);
  check('author has no unread', await unreadOf(alice), 0);
  check('mark read', (await call('POST', `${g}/read`, bob, { seq: lastSeq })).status, 200);
  check('unread cleared', await unreadOf(bob), 0);
  await call('POST', `${g}/read`, bob, { seq: 1 });
  check('read position never moves back', await unreadOf(bob), 0);
  check('home unread', (await call('GET', `${o}/home`, bob)).json.data.unread_messages, 0);

  // Edit and delete
  const mine = first.json.data.id;
  check('other cannot edit', (await call('PATCH', `${g}/messages/${mine}`, bob, { body: 'x' })).status, 403);
  check('owner cannot edit others', (await call('PATCH', `${g}/messages/${mine}`, owner, { body: 'x' })).status, 403);
  const edited = await call('PATCH', `${g}/messages/${mine}`, alice, { body: 'edited' });
  check('edit', edited.json.data.body, 'edited');
  check('edit marked', Boolean(edited.json.data.edited_at), true);
  check('other cannot delete', (await call('DELETE', `${g}/messages/${mine}`, bob)).status, 403);
  check('delete', (await call('DELETE', `${g}/messages/${mine}`, alice)).json.data.deleted, true);
  const afterDelete = (await call('GET', `${g}/messages?limit=100`, bob)).json.data.find((m) => m.id === mine);
  check('deleted body gone', afterDelete.body, '');
  await wait(100);
  check('updates live', got(bobLive, 'message_updated').length >= 2, true);

  // Private channels: an organization role is not a key (spec 27.2)
  const priv = (await call('POST', `${o}/conversations`, alice, { name: 'secret', visibility: 'private' })).json.data;
  const p = `${o}/conversations/${priv.id}`;
  check('bob cannot read private', (await call('GET', `${p}/messages`, bob)).status, 404);
  check('owner cannot read private', (await call('GET', `${p}/messages`, owner)).status, 404);
  check('owner list excludes private', (await call('GET', `${o}/conversations`, owner)).json.data.some((c) => c.id === priv.id), false);
  check('stranger not addable', (await call('POST', `${p}/members`, alice, { user_id: stranger._id })).status, 400);
  check('nonmember cannot add', (await call('POST', `${p}/members`, bob, { user_id: bob._id })).status, 404);
  const ownerBefore = got(ownerLive, 'message_new').length;
  const bobBefore = got(bobLive, 'message_new').length;
  await call('POST', `${p}/messages`, alice, { body: 'hidden' });
  await wait(150);
  check('private not leaked to owner', got(ownerLive, 'message_new').length, ownerBefore);
  check('private not leaked to bob', got(bobLive, 'message_new').length, bobBefore);
  check('add member', (await call('POST', `${p}/members`, alice, { user_id: bob._id })).status, 201);
  check('duplicate member', (await call('POST', `${p}/members`, alice, { user_id: bob._id })).status, 409);
  check('old messages not unread', (await call('GET', `${o}/conversations`, bob)).json.data.find((c) => c.id === priv.id).unread_count, 0);
  await call('POST', `${p}/messages`, alice, { body: 'welcome' });
  await wait(150);
  check('member now live', got(bobLive, 'message_new').length, bobBefore + 1);

  // Direct messages
  const dm1 = await call('POST', `${o}/conversations/dm`, alice, { user_id: bob._id });
  check('dm created', dm1.status, 201);
  check('dm named after partner', dm1.json.data.name, 'bob');
  const dm2 = await call('POST', `${o}/conversations/dm`, bob, { user_id: alice._id });
  check('dm reused from other side', dm2.json.data.id, dm1.json.data.id);
  check('dm name other side', dm2.json.data.name, 'alice');
  check('no self dm', (await call('POST', `${o}/conversations/dm`, alice, { user_id: alice._id })).status, 400);
  check('no dm across orgs', (await call('POST', `${o}/conversations/dm`, alice, { user_id: stranger._id })).status, 400);
  check('guest cannot dm', (await call('POST', `${o}/conversations/dm`, guest, { user_id: alice._id })).status, 403);
  check('owner cannot read dm', (await call('GET', `${o}/conversations/${dm1.json.data.id}/messages`, owner)).status, 404);
  check('cannot add to dm', (await call('POST', `${o}/conversations/${dm1.json.data.id}/members`, alice, { user_id: owner._id })).status, 400);

  // Work nudge is content-free
  const before = got(guestLive, 'work_changed').length;
  const project = await call('POST', `${o}/projects`, owner, { name: 'P' });
  await wait(150);
  check('work nudge', got(guestLive, 'work_changed').length, before + 1);
  check('nudge has no content', got(guestLive, 'work_changed')[before].payload, undefined);
  await call('POST', `${o}/projects`, guest, { name: 'denied' });
  await wait(100);
  check('no nudge on failure', got(guestLive, 'work_changed').length, before + 1);
  check('project created', project.status, 201);

  // Home
  await call('POST', `${o}/projects/${project.json.data.id}/members`, owner, { user_id: alice._id, role: 'contributor' });
  await call('PATCH', `${o}/projects/${project.json.data.id}`, owner, { status: 'active' });
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  await call('POST', `${o}/tasks`, alice, { project_id: project.json.data.id, title: 'Late', assignee_id: alice._id, due_at: yesterday });
  await call('POST', `${o}/tasks`, alice, { project_id: project.json.data.id, title: 'NoDate', assignee_id: alice._id });
  const home = (await call('GET', `${o}/home`, alice)).json.data;
  check('home open', home.open_tasks, 2);
  check('home overdue', home.overdue_tasks, 1);
  check('home dated first', home.next_tasks[0].title, 'Late');
  check('home projects', home.active_projects.length, 1);
  check('home hides others projects', (await call('GET', `${o}/home`, bob)).json.data.active_projects.length, 0);

  // Revocation closes the open connection (AC-18)
  check('bob connected', bobLive.socket.connected, true);
  const bobMember = (await call('GET', `${o}/members`, owner)).json.data.find((m) => m.name === 'bob');
  await call('PATCH', `${o}/members/${bobMember.id}`, owner, { status: 'suspended' });
  await wait(200);
  check('suspension drops socket', bobLive.socket.connected, false);
  const bobCount = got(bobLive, 'message_new').length;
  await call('POST', `${g}/messages`, alice, { body: 'after suspend' });
  await wait(150);
  check('nothing after suspension', got(bobLive, 'message_new').length, bobCount);
  check('suspended API blocked', (await call('GET', `${g}/messages`, bob)).status, 404);

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
