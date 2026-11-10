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
const load = (value) => import(pathToFileURL(path.join(serverDir, value)).href);
const dep = createRequire(path.join(serverDir, 'app.js'));
const binary = path.join(os.homedir(), '.cache/mongodb-binaries/mongod-x64-win32-7.0.24.exe');
const dbPath = fs.mkdtempSync(path.join(os.tmpdir(), 'companyos-knowledge-crm-'));
const port = 28000 + Math.floor(Math.random() * 500);
const mongod = process.env.MONGO_URL ? null : spawn(binary, ['--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1'], { stdio: 'ignore' });

let failures = 0;
let passes = 0;
const check = (label, actual, expected) => {
  if (actual === expected) passes += 1;
  else {
    failures += 1;
    console.log('FAIL ' + label + ': expected ' + expected + ', got ' + actual);
  }
};

async function main() {
  if (!process.env.MONGO_URL) await new Promise((resolve) => setTimeout(resolve, 2500));
  const mongoose = dep('mongoose');
  const express = dep('express');
  const cookieParser = dep('cookie-parser');
  const jwt = dep('jsonwebtoken');
  await mongoose.connect((process.env.MONGO_URL || 'mongodb://127.0.0.1:' + port) + '/companyos_knowledge_crm');
  await mongoose.connection.dropDatabase();
  const User = (await load('models/userModel.js')).default;
  const routes = (await load('companyos/routes.js')).default;
  const { CompanyMember, CompanyOrganization, CompanyProject } = await load('companyos/models.js');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1', routes);
  const server = app.listen(0);
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  const hash = '$2b$12$' + 'a'.repeat(53);
  const org = await CompanyOrganization.create({ name: 'Acme', slug: 'acme-knowledge' });
  const otherOrg = await CompanyOrganization.create({ name: 'Other', slug: 'other-knowledge' });
  const mk = async (name, role, organization = org) => {
    const user = await User.create({ name, email: name + '@test.co', passwordHash: hash });
    await CompanyMember.create({ organizationId: organization._id, userId: user._id, role });
    return user;
  };
  const owner = await mk('owner', 'owner');
  const admin = await mk('admin', 'admin');
  const seller = await mk('seller', 'member');
  const outsider = await mk('outsider', 'owner', otherOrg);
  const session = (user) => 'jwt=' + jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_ACCESS_SECRET);
  const call = async (method, url, as, body, headers = {}) => {
    const response = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: session(as), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json().catch(() => null) };
  };
  const root = '/orgs/' + org._id;

  const document = await call('POST', root + '/documents', seller, {
    title: 'תכנית עבודה', content: 'גרסה ראשונה',
  });
  check('member creates document', document.status, 201);
  const documentId = document.json.data.id;
  check('cross tenant document hidden', (await call('GET', '/orgs/' + otherOrg._id + '/documents/' + documentId, outsider)).status, 404);
  check('document is searchable', (await call('GET', root + '/search?q=תכנית&type=document', seller)).json.data.length, 1);

  check('submit document', (await call('POST', root + '/documents/' + documentId + '/submit-for-approval', seller, {})).status, 201);
  const beforeRevision = await call('GET', root + '/documents/' + documentId, seller);
  const oldApprovalId = beforeRevision.json.data.approvals[0].id;
  check('new revision invalidates approval', (await call('POST', root + '/documents/' + documentId + '/revisions', seller, {
    title: 'תכנית עבודה', content: 'גרסה שנייה',
  })).status, 201);
  const afterRevision = await call('GET', root + '/documents/' + documentId, seller);
  check('old approval superseded', afterRevision.json.data.approvals.find((item) => item.id === oldApprovalId).status, 'superseded');
  await call('POST', root + '/documents/' + documentId + '/submit-for-approval', seller, {});
  const review = await call('GET', root + '/documents/' + documentId, admin);
  const approval = review.json.data.approvals.find((item) => item.status === 'pending');
  check('assigned approver can decide', approval.can_decide, true);
  check('approve current revision', (await call('POST', root + '/approvals/' + approval.id + '/decide', admin, {
    decision: 'approved', reason: '',
  })).status, 200);
  check('non-owner cannot publish', (await call('POST', root + '/documents/' + documentId + '/publish', seller, {})).status, 403);
  check('owner publishes', (await call('POST', root + '/documents/' + documentId + '/publish', owner, {})).status, 200);

  const lead = await call('POST', root + '/leads', seller, {
    title: 'אתר חדש', person_name: 'נועה', company_name: 'חברה', email: 'noa@example.com',
  });
  check('create lead', lead.status, 201);
  const leadId = lead.json.data.id;
  check('assign creates pending request', (await call('POST', root + '/leads/' + leadId + '/assign', admin, {
    user_id: String(seller._id),
  })).json.data.assignment_state, 'pending');
  check('different user cannot accept', (await call('POST', root + '/leads/' + leadId + '/assignment-decision', owner, {
    decision: 'accepted',
  })).status, 403);
  check('assignee accepts', (await call('POST', root + '/leads/' + leadId + '/assignment-decision', seller, {
    decision: 'accepted',
  })).json.data.status, 'accepted');
  check('qualify lead', (await call('POST', root + '/leads/' + leadId + '/transition', seller, {
    status: 'qualified',
  })).status, 200);
  const idempotency = { 'Idempotency-Key': 'lead-conversion-1' };
  const converted = await call('POST', root + '/leads/' + leadId + '/convert', seller, {}, idempotency);
  check('convert lead', converted.status, 201);
  const dealId = converted.json.data.id;
  const repeated = await call('POST', root + '/leads/' + leadId + '/convert', seller, {}, idempotency);
  check('conversion retry succeeds', repeated.status, 200);
  check('conversion retry same deal', repeated.json.data.id, dealId);

  const quote = await call('POST', root + '/deals/' + dealId + '/quotes', seller, {
    currency: 'ILS', lines: [{ description: 'פיתוח', quantity: 1, unit_price: 10000 }],
  });
  check('create quote', quote.status, 201);
  const quoteId = quote.json.data.id;
  check('submit quote', (await call('POST', root + '/quotes/' + quoteId + '/submit-for-approval', seller, {})).status, 200);
  const revised = await call('POST', root + '/deals/' + dealId + '/quotes', seller, {
    currency: 'ILS', lines: [{ description: 'פיתוח מתוקן', quantity: 1, unit_price: 9000 }],
  });
  const afterRevisionQuotes = await call('GET', root + '/deals/' + dealId + '/quotes', admin);
  const oldQuote = afterRevisionQuotes.json.data.find((item) => item.id === quoteId);
  check('new quote revision supersedes old quote', oldQuote.status, 'superseded');
  check('new quote revision supersedes old approval', oldQuote.approvals[0].status, 'superseded');
  check('submit revised quote', (await call('POST', root + '/quotes/' + revised.json.data.id + '/submit-for-approval', seller, {})).status, 200);
  const revisedList = await call('GET', root + '/deals/' + dealId + '/quotes', admin);
  const rejectedApproval = revisedList.json.data[0].approvals.find((item) => item.status === 'pending');
  check('quote rejection requires reason', (await call('POST', root + '/approvals/' + rejectedApproval.id + '/decide', admin, {
    decision: 'rejected',
  })).status, 400);
  check('reject revised quote with reason', (await call('POST', root + '/approvals/' + rejectedApproval.id + '/decide', admin, {
    decision: 'rejected', reason: 'נדרש תיקון',
  })).status, 200);
  const finalQuote = await call('POST', root + '/deals/' + dealId + '/quotes', seller, {
    currency: 'ILS', lines: [{ description: 'פיתוח מאושר', quantity: 1, unit_price: 8500 }],
  });
  await call('POST', root + '/quotes/' + finalQuote.json.data.id + '/submit-for-approval', seller, {});
  const finalList = await call('GET', root + '/deals/' + dealId + '/quotes', admin);
  const quoteApproval = finalList.json.data[0].approvals.find((item) => item.status === 'pending');
  check('approve final quote revision', (await call('POST', root + '/approvals/' + quoteApproval.id + '/decide', admin, {
    decision: 'approved',
  })).status, 200);
  const won = await call('POST', root + '/deals/' + dealId + '/close-won', seller, {}, { 'Idempotency-Key': 'won-1' });
  check('deal won', won.json.data.status, 'won');
  check('project waits for approval', won.json.data.project_id, null);
  const projectApproval = won.json.data.project_approval;
  check('reject project request', (await call('POST', root + '/approvals/' + projectApproval.id + '/decide', admin, {
    decision: 'rejected', reason: 'אין קיבולת',
  })).status, 200);
  check('rejected request creates no project', await CompanyProject.countDocuments({ originDealId: dealId }), 0);

  const secret = await call('POST', root + '/leads', admin, {
    title: 'ליד חסוי', company_name: 'סודי', is_confidential: true,
  });
  check('confidential lead hidden from seller list',
    (await call('GET', root + '/leads', seller)).json.data.some((item) => item.id === secret.json.data.id), false);
  check('confidential lead hidden from search',
    (await call('GET', root + '/search?q=סודי&type=lead', seller)).json.data.length, 0);

  server.close();
  await mongoose.disconnect();
}

main()
  .catch((error) => {
    failures += 1;
    console.log('CRASH', error);
  })
  .finally(() => {
    console.log('passed=' + passes + ' failed=' + failures);
    mongod?.kill();
    setTimeout(() => {
      try { fs.rmSync(dbPath, { recursive: true, force: true }); } catch {}
      process.exit(failures ? 1 : 0);
    }, 1500);
  });
