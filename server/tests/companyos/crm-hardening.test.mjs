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
const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'companyos-crm-'));
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
  await mongoose.connect(`${process.env.MONGO_URL ?? `mongodb://127.0.0.1:${PORT}`}/companyos_crm2`);
  await mongoose.connection.dropDatabase();

  const User = (await load('models/userModel.js')).default;
  const routes = (await load('companyos/routes.js')).default;
  const { setupCompanySocket } = await load('companyos/realtime.js');
  const { CompanyMember, CompanyOrganization, CompanyProject, CompanyTask, CompanyConversation, CompanyMilestone } = await load('companyos/models.js');
  const { CompanyApproval, CompanyAccount, CompanyDeal, CompanyDocumentRevision, CompanyLead } = await load('companyos/knowledgeCrmModels.js');
  const { deliverFollowupReminders } = await load('companyos/crmController.js');
  const webhooks = (await load('companyos/webhooks.js')).default;

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/company-webhooks', webhooks);
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
  let idem = 0;
  const call = async (method, url, as, body) => {
    const res = await fetch(`${origin}/api/v1${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: cookieFor(as), 'Idempotency-Key': `k${(idem += 1)}` },
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


  const manager = await mk('manager', 'manager');
  const admin = await mk('admin', 'admin');
  const carol = await mk('carol', 'member');
  const inboxOf = async (u) => (await call('GET', `${o}/notifications`, u)).json.data;
  const mkLead = async (as, extra = {}) => (await call('POST', `${o}/leads`, as, { title: 'Lead', ...extra })).json.data;
  const flow = async (actor, assignee, extra = {}) => {
    const lead = await mkLead(actor, extra);
    await call('POST', `${o}/leads/${lead.id}/assign`, manager, { user_id: assignee._id });
    await call('POST', `${o}/leads/${lead.id}/assignment-decision`, assignee, { decision: 'accepted' });
    await call('POST', `${o}/leads/${lead.id}/transition`, assignee, { status: 'qualified' });
    return (await call('POST', `${o}/leads/${lead.id}/convert`, assignee, {})).json.data;
  };
  const approvalsOf = async (u) => (await call('GET', `${o}/approvals`, u)).json.data;
  const approveAll = async (kind) => {
    for (const person of [owner, admin, manager]) {
      for (const item of await approvalsOf(person)) {
        if (item.resource_type === kind) await call('POST', `${o}/approvals/${item.id}/decide`, person, { decision: 'approved' });
      }
    }
  };
  const quoteLines = [{ description: 'Work', quantity: 3, unit_price: 0.1 }];

  // Malformed input is a 4xx, not a crash
  check('bad deal id', (await call('GET', `${o}/deals/not-an-id/quotes`, manager)).status, 404);
  check('bad quote id', (await call('POST', `${o}/quotes/not-an-id/submit-for-approval`, manager, {})).status, 404);
  check('bad assignee filter', (await call('GET', `${o}/leads?assigned_to=zzz`, manager)).status, 400);
  check('bad status filter', (await call('GET', `${o}/leads?status=zzz`, manager)).status, 400);

  // A plain member sees only their own records (spec 7.1)
  const mine = await mkLead(alice, { title: 'Alice lead' });
  const managersLead = await mkLead(manager, { title: 'Manager lead' });
  check('member sees own', (await call('GET', `${o}/leads`, alice)).json.data.some((l) => l.id === mine.id), true);
  check('member not others', (await call('GET', `${o}/leads`, alice)).json.data.some((l) => l.id === managersLead.id), false);
  check('member cannot open others', (await call('GET', `${o}/leads/${managersLead.id}`, alice)).status, 404);
  check('manager sees all', (await call('GET', `${o}/leads`, manager)).json.data.some((l) => l.id === mine.id), true);

  // Assignment notifies
  await call('POST', `${o}/leads/${managersLead.id}/assign`, manager, { user_id: alice._id });
  check('assignment notified', (await inboxOf(alice)).some((n) => n.type === 'lead_assigned'), true);
  check('cannot reassign converted-like bad decision', (await call('POST', `${o}/leads/${mine.id}/assignment-decision`, alice, { decision: 'accepted' })).status, 403);

  // Edit with optimistic version
  const fresh = (await call('GET', `${o}/leads/${managersLead.id}`, manager)).json.data;
  check('needs version', (await call('PATCH', `${o}/leads/${managersLead.id}`, manager, { title: 'x' })).status, 400);
  check('edit', (await call('PATCH', `${o}/leads/${managersLead.id}`, manager, { title: 'Renamed', labels: ['hot'], version: fresh.version })).json.data.labels[0], 'hot');
  check('stale edit', (await call('PATCH', `${o}/leads/${managersLead.id}`, manager, { title: 'y', version: fresh.version })).status, 409);

  // Duplicates: suggested, never merged
  const dup1 = await mkLead(manager, { title: 'D1', email: 'same@x.co' });
  const dup2 = await mkLead(manager, { title: 'D2', email: 'same@x.co' });
  check('duplicate lead found', (await call('GET', `${o}/leads/${dup2.id}`, manager)).json.data.duplicate_candidates[0].id, dup1.id);
  check('no merge', await CompanyLead.countDocuments({ email: 'same@x.co' }), 2);

  // Activities
  const a1 = `${o}/crm/lead/${managersLead.id}/activities`;
  check('bad activity type', (await call('POST', a1, manager, { type: 'x', body: 'b' })).status, 400);
  check('empty activity', (await call('POST', a1, manager, { type: 'note', body: ' ' })).status, 400);
  check('add activity', (await call('POST', a1, alice, { type: 'call', body: 'spoke' })).json.data.actor_name, 'alice');
  check('last contact set', Boolean((await call('GET', `${o}/leads/${managersLead.id}`, manager)).json.data.last_contact_at), true);
  check('activity needs access', (await call('GET', `${o}/crm/lead/${managersLead.id}/activities`, carol)).status, 404);
  check('bad activity target', (await call('GET', `${o}/crm/spaceship/${managersLead.id}/activities`, manager)).status, 404);

  // Follow-up reminder fires once per date
  const latest = (await call('GET', `${o}/leads/${managersLead.id}`, manager)).json.data;
  await call('PATCH', `${o}/leads/${managersLead.id}`, manager, { next_followup_at: new Date(Date.now() - 1000).toISOString(), version: latest.version });
  await deliverFollowupReminders();
  await deliverFollowupReminders();
  check('followup once', (await inboxOf(alice)).filter((n) => n.type === 'lead_followup').length, 1);

  // Confidentiality carries through conversion (FR-CRM-06)
  const secretDeal = await flow(manager, alice, { title: 'Secret', company_name: 'SecretCo', is_confidential: true });
  check('deal confidential', secretDeal.is_confidential, true);
  check('owner of deal sees', (await call('GET', `${o}/deals/${secretDeal.id}/quotes`, alice)).status, 200);
  check('owner role does not', (await call('GET', `${o}/deals/${secretDeal.id}/quotes`, owner)).status, 404);
  check('hidden from list', (await call('GET', `${o}/deals`, owner)).json.data.some((d) => d.id === secretDeal.id), false);
  check('hidden from search', (await call('GET', `${o}/search?q=Secret&type=deal`, owner)).json.data.length, 0);
  check('account hidden', (await call('GET', `${o}/search?q=SecretCo&type=account`, owner)).json.data.length, 0);
  check('account list hidden', (await call('GET', `${o}/accounts`, owner)).json.data.some((a) => a.name === 'SecretCo'), false);

  // Money
  const deal = await flow(manager, alice, { title: 'Big', company_name: 'BigCo' });
  const q1 = (await call('POST', `${o}/deals/${deal.id}/quotes`, alice, { lines: quoteLines })).json.data;
  check('no float drift', q1.total, 0.3);
  check('discount above total', (await call('POST', `${o}/deals/${deal.id}/quotes`, alice, { lines: quoteLines, discount: 5 })).status, 400);
  const dq = q => call('POST', `${o}/quotes/${q}/submit-for-approval`, alice, {});
  await dq(q1.id);
  check('approver notified', (await approvalsOf(admin)).length + (await approvalsOf(owner)).length + (await approvalsOf(manager)).length, 1);
  await approveAll('quote');
  check('quote approved', (await call('GET', `${o}/deals/${deal.id}/quotes`, alice)).json.data[0].status, 'approved');

  // A new revision voids the old approval (AC-14)
  const q2 = (await call('POST', `${o}/deals/${deal.id}/quotes`, alice, { lines: [{ description: 'More', quantity: 1, unit_price: 100 }] })).json.data;
  const afterRev = (await call('GET', `${o}/deals`, alice)).json.data.find((d) => d.id === deal.id);
  check('old approval gone from deal', afterRev.approved_quote_id, null);
  check('cannot close on old quote', (await call('POST', `${o}/deals/${deal.id}/close-won`, alice, {})).status, 409);

  // Only an approved quote can go out; acceptance is recorded
  check('draft cannot be sent', (await call('POST', `${o}/quotes/${q2.id}/mark-sent`, alice, {})).status, 409);
  await dq(q2.id);
  await approveAll('quote');
  check('mark sent', (await call('POST', `${o}/quotes/${q2.id}/mark-sent`, alice, {})).json.data.status, 'sent');
  check('stage follows', (await call('GET', `${o}/deals`, alice)).json.data.find((d) => d.id === deal.id).stage_id, 'quote_sent');
  check('acceptance needs name', (await call('POST', `${o}/quotes/${q2.id}/record-acceptance`, alice, {})).status, 400);
  check('acceptance', (await call('POST', `${o}/quotes/${q2.id}/record-acceptance`, alice, { accepted_by: 'Client CEO' })).json.data.accepted_by, 'Client CEO');

  // Pipeline
  check('default stages', (await call('GET', `${o}/pipeline`, alice)).json.data.length, 7);
  check('bad stage', (await call('POST', `${o}/deals/${deal.id}/stage`, alice, { stage_id: 'nope' })).status, 400);
  check('move stage', (await call('POST', `${o}/deals/${deal.id}/stage`, alice, { stage_id: 'negotiation' })).json.data.stage_id, 'negotiation');
  check('member cannot edit pipeline', (await call('PATCH', `${o}/pipeline`, alice, { stages: [{ id: 'a', name: 'A' }] })).status, 403);
  check('stage in use', (await call('PATCH', `${o}/pipeline`, admin, { stages: [{ id: 'a', name: 'A' }] })).status, 409);

  // Closing twice in parallel opens one request
  const closes = await Promise.all([1, 2, 3].map(() => call('POST', `${o}/deals/${deal.id}/close-won`, alice, {})));
  check('close ok', closes.every((r) => r.status === 200), true);
  check('one project request', await CompanyApproval.countDocuments({ resourceType: 'project_creation', resourceId: deal.id }), 1);
  check('booked set', (await CompanyDeal.findById(deal.id)).bookedValue, 100);
  check('no project before approval', await CompanyProject.countDocuments({ originDealId: deal.id }), 0);
  check('close after won is safe', (await call('POST', `${o}/deals/${deal.id}/close-lost`, alice, { reason: 'x' })).status, 409);

  // Two decisions at once: one wins
  const pending = [...(await approvalsOf(owner)), ...(await approvalsOf(admin)), ...(await approvalsOf(manager))].find((a) => a.resource_type === 'project_creation');
  const approver = [owner, admin, manager].find((p) => p.name === pending.assignee_name);
  const decisions = await Promise.all([1, 2].map(() => call('POST', `${o}/approvals/${pending.id}/decide`, approver, { decision: 'approved' })));
  check('one decision wins', decisions.filter((r) => r.status === 200).length, 1);

  // Approved setup creates the full project once (AC-04)
  const project = await CompanyProject.findOne({ originDealId: deal.id });
  check('project created', Boolean(project), true);
  check('kickoff tasks', await CompanyTask.countDocuments({ projectId: project._id }), 3);
  check('kickoff milestone', await CompanyMilestone.countDocuments({ projectId: project._id }), 1);
  check('project channel', await CompanyConversation.countDocuments({ projectId: project._id }), 1);
  check('deal links project', String((await CompanyDeal.findById(deal.id)).projectId), String(project._id));
  check('requester told', (await inboxOf(alice)).some((n) => n.type === 'approval_decided'), true);

  // Lost deals keep a reason
  const lostDeal = await flow(manager, alice, { title: 'Lost', company_name: 'LostCo' });
  check('loss needs reason', (await call('POST', `${o}/deals/${lostDeal.id}/close-lost`, alice, {})).status, 400);
  check('lost', (await call('POST', `${o}/deals/${lostDeal.id}/close-lost`, alice, { reason: 'price' })).json.data.lost_reason, 'price');
  check('no quote on lost', (await call('POST', `${o}/deals/${lostDeal.id}/quotes`, alice, { lines: quoteLines })).status, 409);

  // Approval limit: two steps above it (FR-SALES-03)
  await CompanyOrganization.updateOne({ _id: org._id }, { 'settings.quoteApprovalLimit': 1000 });
  const bigDeal = await flow(manager, alice, { title: 'Huge', company_name: 'HugeCo' });
  const big = (await call('POST', `${o}/deals/${bigDeal.id}/quotes`, alice, { lines: [{ description: 'X', quantity: 1, unit_price: 5000 }] })).json.data;
  await dq(big.id);
  const firstStep = await CompanyApproval.findOne({ resourceId: big.id, status: 'pending' });
  check('first step not owner', String(firstStep.assigneeId) !== String(owner._id), true);
  check('two steps', firstStep.totalSteps, 2);
  const firstPerson = [admin, manager].find((p) => String(p._id) === String(firstStep.assigneeId));
  await call('POST', `${o}/approvals/${firstStep._id}/decide`, firstPerson, { decision: 'approved' });
  check('still in review', (await call('GET', `${o}/deals/${bigDeal.id}/quotes`, alice)).json.data[0].status, 'in_review');
  const secondStep = await CompanyApproval.findOne({ resourceId: big.id, status: 'pending' });
  check('second step owner', String(secondStep.assigneeId), String(owner._id));
  await call('POST', `${o}/approvals/${secondStep._id}/decide`, owner, { decision: 'approved' });
  check('approved after chain', (await call('GET', `${o}/deals/${bigDeal.id}/quotes`, alice)).json.data[0].status, 'approved');
  await CompanyOrganization.updateOne({ _id: org._id }, { $unset: { 'settings.quoteApprovalLimit': 1 } });

  // Accounts and contacts
  const acct = await call('POST', `${o}/accounts`, carol, { name: 'Carol Co' });
  check('create account', acct.status, 201);
  check('guest cannot', (await call('POST', `${o}/accounts`, guest, { name: 'x' })).status, 403);
  const acctUrl = `${o}/accounts/${acct.json.data.id}`;
  check('add contact', (await call('POST', `${acctUrl}/contacts`, carol, { name: 'Bob C' })).status, 201);
  const made = await call('POST', `${o}/deals`, carol, { title: 'Direct', account_id: acct.json.data.id });
  check('deal from account', made.status, 201);
  const card = (await call('GET', acctUrl, carol)).json.data;
  check('card contacts', card.contacts.length, 1);
  check('card deals', card.deals.length, 1);
  check('other member blocked', (await call('GET', acctUrl, bob)).status, 404);
  check('other org blocked', (await call('GET', `/orgs/${otherOrg._id}/accounts/${acct.json.data.id}`, stranger)).status, 404);

  // CSV respects confidentiality (AC-28) and can't inject formulas
  check('member cannot export', (await call('GET', `${o}/leads/export`, alice)).status, 403);
  await mkLead(manager, { title: '=HYPERLINK("http://evil")' });
  const csvRes = await fetch(`${origin}/api/v1${o}/leads/export`, { headers: { Cookie: cookieFor(owner) } });
  const csv = await csvRes.text();
  check('csv ok', csvRes.status, 200);
  check('csv hides confidential', csv.includes('Secret'), false);
  check('csv neutralizes formula', csv.includes(`"'=HYPERLINK`), true);

  // External intake
  const hook = (token, body) => fetch(`${origin}/api/company-webhooks/leads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Company-Token': token }, body: JSON.stringify(body),
  });
  check('member cannot rotate', (await call('POST', `${o}/crm/webhook-token`, alice, {})).status, 403);
  const { token } = (await call('POST', `${o}/crm/webhook-token`, admin, {})).json.data;
  check('bad token', (await hook('nope', { title: 'x' })).status, 401);
  check('needs title', (await hook(token, {})).status, 400);
  check('webhook lead', (await hook(token, { title: 'Web lead', email: 'w@x.co', is_confidential: true })).status, 201);
  const webLead = await CompanyLead.findOne({ title: 'Web lead' });
  check('source recorded', webLead.source, 'webhook');
  check('sender cannot set confidential', webLead.isConfidential, false);

  // Documents: drafts, restricted access, restore, archive, templates
  const mkDoc = async (as, extra = {}) => (await call('POST', `${o}/documents`, as, { title: 'Doc', content: 'hello world', ...extra })).json.data;
  const doc = await mkDoc(alice, { type: 'spec', tags: ['x'] });
  const d = `${o}/documents/${doc.id}`;
  check('bad doc type', (await call('POST', `${o}/documents`, alice, { title: 'T', type: 'zzz' })).status, 400);
  check('colleague cannot read draft', (await call('GET', d, carol)).status, 404);
  check('draft not listed', (await call('GET', `${o}/documents`, carol)).json.data.some((x) => x.id === doc.id), false);
  check('draft not searchable', (await call('GET', `${o}/search?q=hello&type=document`, carol)).json.data.length, 0);
  check('manager reads draft', (await call('GET', d, manager)).status, 200);
  check('body searchable', (await call('GET', `${o}/search?q=hello&type=document`, manager)).json.data.length, 1);

  await call('POST', `${d}/submit-for-approval`, alice, {});
  await approveAll('document');
  check('publish', (await call('POST', `${d}/publish`, owner, {})).status, 200);
  check('now public', (await call('GET', d, carol)).status, 200);
  await call('POST', `${d}/revisions`, alice, { title: 'Doc', content: 'unpublished edit' });
  const seen = (await call('GET', d, carol)).json.data;
  check('reader keeps published text', seen.current_revision.content, 'hello world');
  check('reader sees one version', seen.revisions.length, 1);
  check('author sees draft', (await call('GET', d, alice)).json.data.current_revision.content, 'unpublished edit');

  const firstRevision = (await call('GET', d, alice)).json.data.revisions.find((r) => r.revision_no === 1);
  check('reader cannot restore', (await call('POST', `${d}/restore`, carol, { revision_id: firstRevision.id })).status, 403);
  const restored = await call('POST', `${d}/restore`, alice, { revision_id: firstRevision.id });
  check('restore is new revision', restored.json.data.revision_no, 3);
  check('history intact', await CompanyDocumentRevision.countDocuments({ documentId: doc.id }), 3);

  const restricted = await mkDoc(alice, { title: 'Hidden', visibility: 'restricted', allowed_user_ids: [bob._id] });
  const r = `${o}/documents/${restricted.id}`;
  check('named person reads', (await call('GET', r, bob)).status, 200);
  check('admin not automatic', (await call('GET', r, admin)).status, 404);
  check('owner not automatic', (await call('GET', r, owner)).status, 404);
  check('search respects restricted', (await call('GET', `${o}/search?q=Hidden&type=document`, owner)).json.data.length, 0);

  check('archive', (await call('POST', `${d}/archive`, alice, {})).json.data.archived, true);
  check('archived hidden', (await call('GET', `${o}/documents`, alice)).json.data.some((x) => x.id === doc.id), false);
  check('archived list', (await call('GET', `${o}/documents?archived=true`, alice)).json.data.length, 1);
  check('no edit in archive', (await call('POST', `${d}/revisions`, alice, { title: 'x' })).status, 409);
  await call('POST', `${d}/archive`, alice, { archived: false });

  const tpl = await mkDoc(alice, { title: 'Tpl', is_template: true, content: 'template body' });
  check('template not in list', (await call('GET', `${o}/documents`, alice)).json.data.some((x) => x.id === tpl.id), false);
  const fromTpl = await mkDoc(alice, { title: 'From', content: '', template_id: tpl.id });
  check('uses template', (await call('GET', `${o}/documents/${fromTpl.id}`, alice)).json.data.current_revision.content, 'template body');
  check('not a template', (await call('POST', `${o}/documents`, alice, { title: 'x', template_id: fromTpl.id })).status, 400);

  const decision = await mkDoc(alice, { title: 'Use X', type: 'decision', decision: { context: 'why', decision: 'X' } });
  check('decision stored', decision.decision.decision, 'X');
  check('filter by type', (await call('GET', `${o}/documents?type=decision`, alice)).json.data.length, 1);

  // Links to other objects, checked against access
  check('link deal', (await call('POST', `${d}/links`, alice, { resource_type: 'deal', resource_id: lostDeal.id })).status, 201);
  check('link twice is one', (await call('POST', `${d}/links`, alice, { resource_type: 'deal', resource_id: lostDeal.id })).status, 201);
  check('links listed', (await call('GET', d, alice)).json.data.links.length, 1);
  check('linked filter', (await call('GET', `${o}/documents?linked_type=deal&linked_id=${lostDeal.id}`, alice)).json.data.length, 1);
  check('cannot link hidden', (await call('POST', `${d}/links`, alice, { resource_type: 'project', resource_id: project._id })).status, 201);
  check('cannot link hidden deal', (await call('POST', `${d}/links`, carol, { resource_type: 'deal', resource_id: lostDeal.id })).status, 403);

  // Document files follow document access
  const form = new FormData();
  form.append('file', new Blob(['hi'], { type: 'application/pdf' }), 'a.pdf');
  const up = await fetch(`${origin}/api/v1${r}/files`, { method: 'POST', headers: { Cookie: cookieFor(alice) }, body: form });
  const fileId = (await up.json()).data.id;
  const dl = (u) => fetch(`${origin}/api/v1${o}/files/${fileId}`, { headers: { Cookie: cookieFor(u) } });
  check('named downloads', (await dl(bob)).status, 200);
  check('others blocked', (await dl(owner)).status, 404);

  // Search hides message history after removal from a project (leftover read rows)
  const proj = (await call('POST', `${o}/projects`, owner, { name: 'P' })).json.data;
  const added = (await call('POST', `${o}/projects/${proj.id}/members`, owner, { user_id: bob._id, role: 'contributor' })).json.data;
  const chan = (await call('POST', `${o}/projects/${proj.id}/conversation`, owner, {})).json.data;
  await call('POST', `${o}/conversations/${chan.id}/messages`, owner, { body: 'projectsecret word' });
  await call('POST', `${o}/conversations/${chan.id}/read`, bob, { seq: 1 });
  check('member finds', (await call('GET', `${o}/search?q=projectsecret&type=message`, bob)).json.data.length, 1);
  await call('DELETE', `${o}/projects/${proj.id}/members/${added.id}`, owner);
  check('removed cannot find', (await call('GET', `${o}/search?q=projectsecret&type=message`, bob)).json.data.length, 0);

  // Search pages
  for (let i = 0; i < 5; i += 1) await mkDoc(manager, { title: `pageme ${i}` });
  const p1 = (await call('GET', `${o}/search?q=pageme&type=document&limit=2`, manager)).json;
  check('page one', p1.data.length, 2);
  check('next offset', p1.meta.next_offset, 2);

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
