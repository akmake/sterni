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
const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'companyos-extras-'));
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
  await mongoose.connect(`${process.env.MONGO_URL ?? `mongodb://127.0.0.1:${PORT}`}/companyos_extras`);
  await mongoose.connection.dropDatabase();

  const User = (await load('models/userModel.js')).default;
  const routes = (await load('companyos/routes.js')).default;
  const { setupCompanySocket } = await load('companyos/realtime.js');
  const { CompanyMember, CompanyOrganization, CompanyMessage, CompanySavedMessage } = await load('companyos/models.js');
  const { deliverDueReminders } = await load('companyos/chatExtrasController.js');

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


  const aliceLive = await listen(alice);
  const bobLive = await listen(bob);
  const got = (live, event) => live.received.filter((r) => r.event === event);
  const carol = await mk('carol', 'member');

  const general = (await call('POST', `${o}/conversations`, alice, { name: 'general' })).json.data;
  const g = `${o}/conversations/${general.id}`;
  const send = async (url, as, body) => (await call('POST', `${url}/messages`, as, body)).json.data;

  // Threads
  const root = await send(g, alice, { body: 'root' });
  const reply = await call('POST', `${g}/messages`, bob, { body: 'reply one', parent_id: root.id });
  check('reply sent', reply.status, 201);
  check('reply has parent', reply.json.data.parent_id, root.id);
  const nested = await send(g, alice, { body: 'reply two', parent_id: reply.json.data.id });
  check('thread stays flat', nested.parent_id, root.id);
  const main = (await call('GET', `${g}/messages`, bob)).json.data;
  check('replies not in main list', main.length, 1);
  check('reply count', main[0].reply_count, 2);
  const thread = (await call('GET', `${g}/messages/${root.id}/replies`, bob)).json.data;
  check('thread replies', thread.replies.length, 2);
  check('bad parent', (await call('POST', `${g}/messages`, bob, { body: 'x', parent_id: new mongoose.Types.ObjectId() })).status, 400);

  // Mentions and inbox
  const secret = (await call('POST', `${o}/conversations`, alice, { name: 'secret', visibility: 'private' })).json.data;
  const s = `${o}/conversations/${secret.id}`;
  const mention = await send(g, alice, { body: 'hi @bob', mention_user_ids: [bob._id, alice._id] });
  check('self dropped from mentions', mention.mentions.length, 1);
  await wait(150);
  check('mention live', got(bobLive, 'notification_new').length, 1);
  const inbox = (await call('GET', `${o}/notifications`, bob)).json;
  check('inbox item', inbox.data[0].type, 'mention');
  check('inbox unread', inbox.meta.unread, 1);
  const hidden = await send(s, alice, { body: 'psst', mention_user_ids: [bob._id] });
  check('no mention without access', hidden.mentions.length, 0);
  check('no inbox leak', (await call('GET', `${o}/notifications`, bob)).json.data.length, 1);
  await call('POST', `${o}/notifications/read`, bob, {});
  check('inbox cleared', (await call('GET', `${o}/notifications`, bob)).json.meta.unread, 0);

  // Reactions
  const react = (as, id = root.id, url = g) => call('POST', `${url}/messages/${id}/reactions`, as, { emoji: '👍' });
  check('react', (await react(bob)).json.data.reactions[0].count, 1);
  check('second user', (await react(alice)).json.data.reactions[0].count, 2);
  check('toggle off', (await react(bob)).json.data.reactions[0].count, 1);
  check('no react without access', (await react(bob, hidden.id, s)).status, 404);

  // Pins
  check('pin', (await call('POST', `${g}/messages/${root.id}/pin`, bob, {})).json.data.pinned, true);
  check('pins list', (await call('GET', `${g}/pins`, alice)).json.data.length, 1);
  check('unpin', (await call('POST', `${g}/messages/${root.id}/pin`, bob, {})).json.data.pinned, false);

  // Save for later
  check('past reminder', (await call('POST', `${g}/messages/${root.id}/save`, bob, { remind_at: '2020-01-01' })).status, 400);
  const soon = new Date(Date.now() + 60000).toISOString();
  check('save', (await call('POST', `${g}/messages/${root.id}/save`, bob, { remind_at: soon })).status, 201);
  check('saved list', (await call('GET', `${o}/saved-messages`, bob)).json.data.length, 1);
  await CompanySavedMessage.updateOne({ messageId: root.id }, { remindAt: new Date(Date.now() - 1000) });
  await deliverDueReminders();
  await deliverDueReminders();
  const reminders = (await call('GET', `${o}/notifications`, bob)).json.data.filter((n) => n.type === 'reminder');
  check('reminder once', reminders.length, 1);
  check('unsave', (await call('DELETE', `${g}/messages/${root.id}/save`, bob)).status, 200);
  check('saved empty', (await call('GET', `${o}/saved-messages`, bob)).json.data.length, 0);

  // Mute and mark unread
  const unreadOf = async (u) => (await call('GET', `${o}/conversations`, u)).json.data.find((c) => c.id === general.id);
  const homeUnread = async (u) => (await call('GET', `${o}/home`, u)).json.data.unread_messages;
  await call('POST', `${g}/read`, bob, { seq: 100000 });
  check('read all', (await unreadOf(bob)).unread_count, 0);
  check('mark unread', (await call('POST', `${g}/unread`, bob, { seq: 2 })).json.data.seq, 1);
  check('unread back', (await unreadOf(bob)).unread_count > 0, true);
  check('counts in home', (await homeUnread(bob)) > 0, true);
  check('mute', (await call('PATCH', `${g}/settings`, bob, { muted: true })).status, 200);
  check('muted flag', (await unreadOf(bob)).muted, true);
  check('muted not in total', await homeUnread(bob), 0);
  check('bad mute', (await call('PATCH', `${g}/settings`, bob, { muted: 'x' })).status, 400);

  // Search is pre-filtered by access
  check('short search', (await call('GET', `${o}/messages/search?q=a`, bob)).status, 400);
  check('search finds', (await call('GET', `${o}/messages/search?q=reply`, bob)).json.data.length, 2);
  check('search hides private', (await call('GET', `${o}/messages/search?q=psst`, bob)).json.data.length, 0);
  check('search owner hides private', (await call('GET', `${o}/messages/search?q=psst`, owner)).json.data.length, 0);
  check('member finds private', (await call('GET', `${o}/messages/search?q=psst`, alice)).json.data.length, 1);
  check('regex is literal', (await call('GET', `${o}/messages/search?q=${encodeURIComponent('.*')}`, alice)).json.data.length, 0);

  // Group conversations
  check('group too small', (await call('POST', `${o}/conversations/group`, alice, { user_ids: [bob._id] })).status, 400);
  check('group outsider', (await call('POST', `${o}/conversations/group`, alice, { user_ids: [bob._id, stranger._id] })).status, 400);
  check('guest cannot group', (await call('POST', `${o}/conversations/group`, guest, { user_ids: [bob._id, alice._id] })).status, 403);
  const group = (await call('POST', `${o}/conversations/group`, alice, { user_ids: [bob._id, carol._id] })).json.data;
  const listed = (await call('GET', `${o}/conversations`, bob)).json.data.find((c) => c.id === group.id);
  check('group named by people', listed.name.includes('alice') && listed.name.includes('carol'), true);
  check('owner not in group', (await call('GET', `${o}/conversations/${group.id}/messages`, owner)).status, 404);

  // Project channel follows project membership
  const project = (await call('POST', `${o}/projects`, owner, { name: 'Apollo' })).json.data;
  const pc = (await call('POST', `${o}/projects/${project.id}/conversation`, owner, {})).json.data;
  const again = (await call('POST', `${o}/projects/${project.id}/conversation`, owner, {})).json.data;
  check('one channel per project', again.id, pc.id);
  check('non-member no channel', (await call('POST', `${o}/projects/${project.id}/conversation`, bob, {})).status, 404);
  const pcUrl = `${o}/conversations/${pc.id}`;
  check('non-member cannot read', (await call('GET', `${pcUrl}/messages`, bob)).status, 404);
  const added = (await call('POST', `${o}/projects/${project.id}/members`, owner, { user_id: bob._id, role: 'contributor' })).json.data;
  check('member reads channel', (await call('GET', `${pcUrl}/messages`, bob)).status, 200);
  check('channel listed', (await call('GET', `${o}/conversations`, bob)).json.data.some((c) => c.id === pc.id), true);
  const before = got(bobLive, 'message_new').length;
  await send(pcUrl, owner, { body: 'project hello' });
  await wait(150);
  check('project member live', got(bobLive, 'message_new').length, before + 1);
  await call('DELETE', `${o}/projects/${project.id}/members/${added.id}`, owner);
  check('removed loses channel', (await call('GET', `${pcUrl}/messages`, bob)).status, 404);
  await send(pcUrl, owner, { body: 'after removal' });
  await wait(150);
  check('removed not live', got(bobLive, 'message_new').length, before + 1);

  // Task from a message keeps a link to its source (AC-03)
  await call('POST', `${o}/projects/${project.id}/members`, owner, { user_id: alice._id, role: 'contributor' });
  const fromMessage = await call('POST', `${g}/messages/${root.id}/task`, alice, { project_id: project.id });
  check('task from message', fromMessage.status, 201);
  check('source link', fromMessage.json.data.source_message_id, root.id);
  const stored = (await call('GET', `${o}/tasks/${fromMessage.json.data.id}`, alice)).json.data;
  check('task keeps source', stored.source_message_id, root.id);
  check('title from body', stored.title, 'root');
  check('no task without project', (await call('POST', `${g}/messages/${root.id}/task`, bob, { project_id: project.id })).status, 404);

  // Files are private to the conversation
  const upload = async (url, as, type, name = 'a.png') => {
    const form = new FormData();
    form.append('file', new Blob(['hello'], { type }), name);
    const res = await fetch(`${origin}/api/v1${url}/files`, { method: 'POST', headers: { Cookie: cookieFor(as) }, body: form });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  check('bad type', (await upload(s, alice, 'text/html', 'x.html')).status, 415);
  check('no upload without access', (await upload(s, bob, 'image/png')).status, 404);
  const file = (await upload(s, alice, 'image/png')).json.data;
  check('foreign file refused', (await call('POST', `${g}/messages`, alice, { body: 'x', attachment_ids: [file.id] })).status, 400);
  const withFile = await call('POST', `${s}/messages`, alice, { attachment_ids: [file.id] });
  check('file-only message', withFile.status, 201);
  check('attachment listed', withFile.json.data.attachments[0].id, file.id);
  check('file reused refused', (await call('POST', `${s}/messages`, alice, { body: 'y', attachment_ids: [file.id] })).status, 400);
  const get = async (as) => fetch(`${origin}/api/v1${o}/files/${file.id}`, { headers: { Cookie: cookieFor(as) } });
  const ok = await get(alice);
  check('download', ok.status, 200);
  check('nosniff', ok.headers.get('x-content-type-options'), 'nosniff');
  check('no download without access', (await get(bob)).status, 404);
  check('no download for owner', (await get(owner)).status, 404);
  check('no public path', (await fetch(`${origin}/uploads/${file.id}`)).status, 404);

  // Presence
  check('bad availability', (await call('PATCH', `${o}/presence`, alice, { availability: 'x' })).status, 400);
  check('set dnd', (await call('PATCH', `${o}/presence`, alice, { availability: 'dnd', status_text: 'in a meeting' })).status, 200);
  const people = (await call('GET', `${o}/members`, bob)).json.data;
  const a = people.find((m) => m.name === 'alice');
  check('availability shown', a.availability, 'dnd');
  check('status text', a.status_text, 'in a meeting');
  check('online', a.online, true);
  check('offline', people.find((m) => m.name === 'carol').online, false);

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
