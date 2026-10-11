import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const source = fs.readFileSync(new URL('../routes/tetherRoutes.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?$/gm, '')
  .replace('const __dirname = path.dirname(fileURLToPath(import.meta.url));', 'const __dirname = ".";')
  .replace(/^export const /gm, 'const ')
  .replace('export default router;', 'globalThis.testRouter = router;');

function fixture() {
  const admins = [
    { _id: 'super', name: 'Owner', email: 'owner@example.test', role: 'superadmin', active: true, tokenVersion: 0 },
    { _id: 'manager-a', name: 'A', email: 'a@example.test', role: 'admin', active: true, tokenVersion: 0 },
    { _id: 'manager-b', name: 'B', email: 'b@example.test', role: 'admin', active: true, tokenVersion: 0 },
  ];
  const communities = [
    { _id: 'community-a', name: 'A', code: 'AAAA', adminId: 'super', active: true, policy: {} },
    { _id: 'community-b', name: 'B', code: 'BBBB', adminId: 'manager-b', active: true, policy: {} },
  ];
  const devices = [
    { _id: 'record-a', deviceId: 'device-a', communityId: 'community-a', active: true, deviceModel: 'Phone A' },
    { _id: 'record-b', deviceId: 'device-b', communityId: 'community-b', active: true, deviceModel: 'Phone B' },
  ];
  devices.forEach(device => { device.save = async () => device; });
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) =>
    value && typeof value === 'object' && '$in' in value ? value.$in.includes(row[key]) : row[key] === value);
  const query = (value) => ({
    select() { return this; }, sort() { return this; }, limit() { return this; }, lean() { return this; },
    populate(field) {
      if (value && field === 'communityId') value = { ...value, communityId: communities.find(c => c._id === value.communityId) };
      return this;
    },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  });
  const model = (rows) => ({
    find(filter = {}) { return query(rows.filter(row => matches(row, filter))); },
    findOne(filter) { return query(rows.find(row => matches(row, filter)) || null); },
    findById(id) { return query(rows.find(row => row._id === id) || null); },
    exists(filter) { return Promise.resolve(rows.some(row => matches(row, filter))); },
    aggregate() { return Promise.resolve([]); },
    countDocuments(filter = {}) { return Promise.resolve(rows.filter(row => matches(row, filter)).length); },
    async create(data) { const row = { _id: `created-${rows.length}`, active: true, tokenVersion: 0, ...data }; rows.push(row); return row; },
    async updateOne(filter, update) {
      const row = rows.find(row => matches(row, filter));
      if (row) Object.assign(row, update.$set || update);
      return { matchedCount: row ? 1 : 0 };
    },
    async findOneAndUpdate(filter, update) {
      const row = rows.find(row => matches(row, filter));
      if (row) Object.assign(row, update.$set || update);
      return row || null;
    },
    async findByIdAndUpdate(id, update) {
      const row = rows.find(row => row._id === id);
      if (row) {
        Object.assign(row, update.$set || update);
        for (const [key, count] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + count;
      }
      return row || null;
    },
    async deleteOne(filter) { const index = rows.findIndex(row => matches(row, filter)); if (index >= 0) rows.splice(index, 1); },
  });
  const routes = new Map();
  const router = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method,
    (url, ...handlers) => routes.set(`${method} ${url}`, handlers)]));
  const context = vm.createContext({
    express: { Router: () => router }, Community: model(communities), TetherDevice: model(devices),
    TetherAdmin: model(admins), ApprovalRequest: model([]), TetherApprovedApp: model([]), TetherUsage: model([]),
    bcrypt: { hash: async () => 'fixture-hash', compare: async () => true },
    jwt: { verify: token => ({ id: token, tv: 0 }), sign: data => data.id }, crypto, fs, path, process,
  });
  vm.runInContext(source, context);
  async function request(method, url, account, body = {}, params = {}) {
    const req = { headers: { authorization: `Bearer ${account}` }, body, params, query: {} };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
    const handlers = routes.get(`${method} ${url}`);
    assert.ok(handlers, `Missing route ${url}`);
    for (const handler of handlers) {
      let next = false;
      await handler(req, res, () => { next = true; });
      if (!next) break;
    }
    return res;
  }
  return { request, admins, communities, devices };
}

test('superadmin creates a personal account and assigns existing devices through their community', async () => {
  const f = fixture();
  const result = await f.request('post', '/admin/members/invite', 'super',
    { name: 'New manager', email: ' New@Example.test ', password: 'fixture-password', communityId: 'community-a' });
  assert.equal(result.statusCode, 201);
  assert.equal(result.data.email, 'new@example.test');
  assert.equal(result.data.role, 'admin');
  assert.equal(f.communities[0].adminId, result.data.id);
  assert.equal(f.communities[0].code, 'AAAA');
  assert.equal(f.devices[0].communityId, 'community-a');
  const list = await f.request('get', '/admin/communities', result.data.id);
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].id, 'community-a');
});

test('community manager cannot create accounts or transfer ownership', async () => {
  const f = fixture();
  assert.equal((await f.request('post', '/admin/members/invite', 'manager-b')).statusCode, 403);
  assert.equal((await f.request('put', '/admin/communities/:id/manager', 'manager-b',
    { adminId: 'manager-a' }, { id: 'community-b' })).statusCode, 403);
  assert.equal(f.communities[1].adminId, 'manager-b');
});

test('transfer grants device control to the new manager and removes it from the old manager', async () => {
  const f = fixture();
  await f.request('put', '/admin/communities/:id/manager', 'super', { adminId: 'manager-a' }, { id: 'community-b' });
  assert.equal((await f.request('put', '/admin/devices/:deviceId/nickname', 'manager-b',
    { nickname: 'Forbidden' }, { deviceId: 'device-b' })).statusCode, 404);
  assert.equal((await f.request('put', '/admin/devices/:deviceId/nickname', 'manager-a',
    { nickname: 'Allowed' }, { deviceId: 'device-b' })).statusCode, 200);
  assert.equal(f.devices[1].deviceNickname, 'Allowed');
});

test('superadmin retains community access after assignment', async () => {
  const f = fixture();
  const result = await f.request('get', '/admin/communities/:id', 'super', {}, { id: 'community-b' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.data.devices.length, 1);
});

test('manager cannot read another community or device', async () => {
  const f = fixture();
  assert.equal((await f.request('get', '/admin/communities/:id', 'manager-a', {}, { id: 'community-b' })).statusCode, 404);
  assert.equal((await f.request('get', '/admin/devices/:deviceId', 'manager-a', {}, { deviceId: 'device-b' })).statusCode, 404);
});

test('invalid invitation leaves both accounts and ownership unchanged', async () => {
  const f = fixture();
  const result = await f.request('post', '/admin/members/invite', 'super',
    { name: 'Test', email: 'test@example.test', password: 'fixture-password', communityId: 'missing' });
  assert.equal(result.statusCode, 404);
  assert.equal(f.admins.length, 3);
  assert.equal(f.communities[0].adminId, 'super');
});

test('revoked manager tokens cannot access the API', async () => {
  const f = fixture();
  await f.request('delete', '/admin/members/:id', 'super', {}, { id: 'manager-b' });
  assert.equal((await f.request('get', '/admin/communities', 'manager-b')).statusCode, 401);
});

test('superadmin access cannot be revoked through manager administration', async () => {
  const f = fixture();
  assert.equal((await f.request('delete', '/admin/members/:id', 'super', {}, { id: 'super' })).statusCode, 403);
  assert.equal(f.admins[0].active, true);
});

test('community managers cannot change the shared app catalogue or publish app versions', async () => {
  const f = fixture();
  for (const [method, url] of [
    ['post', '/admin/apps/approved'], ['put', '/admin/apps/approved/:id'],
    ['delete', '/admin/apps/approved/:id'], ['post', '/admin/app/version'],
  ]) {
    assert.equal((await f.request(method, url, 'manager-b', {}, { id: 'app' })).statusCode, 403);
  }
});
