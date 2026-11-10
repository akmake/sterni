import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Download, Handshake, Lock, Plus, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { companyApi, errorMessage } from './companyApi';

const LEAD_STATUS = {
  new: 'חדש', assigned: 'משויך', accepted: 'באחריות', contacting: 'בטיפול', qualified: 'מוסמך',
  converted: 'הומר', nurturing: 'טיפוח', disqualified: 'נפסל', archived: 'בארכיון',
};
const LEAD_NEXT = {
  accepted: ['contacting', 'qualified', 'nurturing'],
  contacting: ['qualified', 'nurturing'],
  nurturing: ['contacting', 'qualified'],
  qualified: ['nurturing'],
};
const ASSIGNMENT = { unassigned: 'ללא אחראי', pending: 'ממתין לקבלת אחריות', accepted: 'האחריות התקבלה', rejected: 'השיוך נדחה' };
const QUOTE_STATUS = { draft: 'טיוטה', in_review: 'באישור', approved: 'מאושרת', rejected: 'נדחתה', sent: 'נשלחה ללקוח', superseded: 'גרסה קודמת', pending: 'ממתין' };
const ACTIVITY = { note: 'הערה', call: 'שיחה', meeting: 'פגישה', email: 'מייל' };
const DEAL_STATUS = { open: 'פתוחה', won: 'זכייה', lost: 'הפסד' };

const input = 'w-full border rounded-xl px-3 py-2';
const money = (value, currency) => `${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ${currency}`;

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-30 bg-black/40 p-4 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="סגירה"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Asks for a required reason in-page, instead of the browser's prompt().
function ReasonButton({ label, title, className, onConfirm }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>{label}</button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <form onSubmit={(e) => { e.preventDefault(); onConfirm(reason.trim()); setOpen(false); }} className="space-y-3">
            <textarea className={input} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סיבה" required />
            <button className="bg-blue-700 text-white rounded-xl px-4 py-2">אישור</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function Activities({ orgId, type, id }) {
  const client = useQueryClient();
  const key = ['company', orgId, 'crm-activities', type, id];
  const items = useQuery({ queryKey: key, queryFn: () => companyApi.crmActivities(orgId, type, id) });
  const [kind, setKind] = useState('note');
  const [body, setBody] = useState('');
  const add = useMutation({
    mutationFn: () => companyApi.addCrmActivity(orgId, type, id, { type: kind, body }),
    onSuccess: () => { setBody(''); client.invalidateQueries({ queryKey: key }); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <section className="bg-white border rounded-2xl p-4 space-y-2">
      <h3 className="font-bold">פעילות</h3>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <select className="border rounded-xl px-2" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="סוג פעילות">
          {Object.entries(ACTIVITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="flex-1 min-w-0 border rounded-xl px-3 py-2" value={body} onChange={(e) => setBody(e.target.value)} placeholder="מה קרה?" required />
        <button disabled={add.isPending} className="text-blue-700 font-semibold">הוספה</button>
      </form>
      {(items.data ?? []).map((item) => (
        <p key={item.id} className="text-sm border-t pt-2">
          <strong>{ACTIVITY[item.type]}</strong> · {item.body}
          <span className="block text-xs text-gray-400">{item.actor_name} · {new Date(item.occurred_at).toLocaleString('he-IL')}</span>
        </p>
      ))}
    </section>
  );
}

function LeadForm({ onClose, onSave, pending }) {
  const [form, setForm] = useState({ title: '', person_name: '', company_name: '', email: '', phone: '', source: 'manual', is_confidential: false });
  const field = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));
  return (
    <Modal title="ליד חדש" onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); onSave(form); }} className="space-y-3">
        <input value={form.title} onChange={field('title')} className={input} placeholder="כותרת" required />
        <input value={form.person_name} onChange={field('person_name')} className={input} placeholder="איש קשר" />
        <input value={form.company_name} onChange={field('company_name')} className={input} placeholder="חברה" />
        <input value={form.email} onChange={field('email')} className={input} placeholder="דוא״ל" type="email" dir="ltr" />
        <input value={form.phone} onChange={field('phone')} className={input} placeholder="טלפון" dir="ltr" />
        <input value={form.source} onChange={field('source')} className={input} placeholder="מקור הגעה" />
        <label className="flex gap-2"><input type="checkbox" checked={form.is_confidential} onChange={(e) => setForm((c) => ({ ...c, is_confidential: e.target.checked }))} />ליד חסוי</label>
        <button disabled={pending} className="bg-blue-700 text-white rounded-xl px-4 py-2">יצירה</button>
      </form>
    </Modal>
  );
}

function LeadDetail({ orgId, leadId, members, accounts, onBack, mutate }) {
  const lead = useQuery({ queryKey: ['company', orgId, 'lead', leadId], queryFn: () => companyApi.lead(orgId, leadId) });
  const [assignee, setAssignee] = useState('');
  const [accountId, setAccountId] = useState('');
  const [followup, setFollowup] = useState('');
  if (lead.isPending) return <p className="py-12 text-center">טוען…</p>;
  if (lead.isError) return <p className="text-red-700">{errorMessage(lead.error)}</p>;
  const item = lead.data;

  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-blue-700 font-semibold">חזרה</button>
      <div>
        <h1 className="text-2xl font-bold flex gap-2">{item.is_confidential && <Lock size={22} />}{item.title}</h1>
        <p className="text-blue-700">{LEAD_STATUS[item.status]} · {ASSIGNMENT[item.assignment_state]}</p>
      </div>
      <div className="bg-white border rounded-2xl p-4 grid sm:grid-cols-2 gap-2 text-sm">
        <p>איש קשר: {item.person_name || '—'}</p>
        <p>חברה: {item.company_name || '—'}</p>
        <p dir="ltr" className="text-right">{item.email || '—'}</p>
        <p dir="ltr" className="text-right">{item.phone || '—'}</p>
        <p>מקור: {item.source}</p>
        <p>אחראי: {item.assigned_name || 'טרם שויך'}</p>
        {item.next_followup_at && <p>מעקב הבא: {new Date(item.next_followup_at).toLocaleDateString('he-IL')}</p>}
        {item.lost_reason && <p>סיבת פסילה: {item.lost_reason}</p>}
      </div>
      {item.duplicate_candidates?.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 text-sm">
          התאמות אפשריות: {item.duplicate_candidates.map((d) => `${d.label} (${d.type === 'lead' ? 'ליד' : 'לקוח'})`).join(', ')}. לא בוצע מיזוג.
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        {item.can_assign && !['converted', 'disqualified', 'archived'].includes(item.status) && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); mutate(() => companyApi.assignLead(orgId, item.id, assignee)); }}>
            <select className="border rounded-xl px-2 py-2" value={assignee} onChange={(e) => setAssignee(e.target.value)} required aria-label="שיוך לעובד">
              <option value="">שיוך לעובד…</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
            </select>
            <button className="border border-blue-700 text-blue-700 rounded-xl px-3">שיוך</button>
          </form>
        )}
        {item.can_decide_assignment && (
          <>
            <button onClick={() => mutate(() => companyApi.decideLeadAssignment(orgId, item.id, 'accepted', ''))} className="bg-blue-700 text-white rounded-xl px-4 py-2">קבלת אחריות</button>
            <ReasonButton label="דחייה" title="סיבת דחיית השיוך" className="border rounded-xl px-4 py-2" onConfirm={(r) => mutate(() => companyApi.decideLeadAssignment(orgId, item.id, 'rejected', r))} />
          </>
        )}
        {item.can_edit && (LEAD_NEXT[item.status] ?? []).map((status) => (
          <button key={status} onClick={() => mutate(() => companyApi.transitionLead(orgId, item.id, status, ''))} className="border rounded-xl px-3 py-2">{LEAD_STATUS[status]}</button>
        ))}
        {item.can_edit && !['converted', 'disqualified', 'archived'].includes(item.status) && (
          <ReasonButton label="פסילה" title="סיבת פסילה" className="text-red-700 px-3 py-2" onConfirm={(r) => mutate(() => companyApi.transitionLead(orgId, item.id, 'disqualified', r))} />
        )}
      </div>
      {item.can_convert && (
        <form className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); mutate(() => companyApi.convertLead(orgId, item.id, accountId)); }}>
          <select className="border rounded-xl px-2 py-2 flex-1" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="לקוח קיים">
            <option value="">לקוח חדש מהליד</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button className="bg-emerald-700 text-white rounded-xl px-4 py-2">המרה לעסקה</button>
        </form>
      )}
      {item.can_edit && (
        <form className="flex gap-2 items-center" onSubmit={(e) => { e.preventDefault(); mutate(() => companyApi.updateLead(orgId, item.id, { next_followup_at: followup, version: item.version })); }}>
          <label className="text-sm" htmlFor="followup">תזכורת מעקב</label>
          <input id="followup" type="date" className="border rounded-xl px-2 py-1" value={followup} onChange={(e) => setFollowup(e.target.value)} required />
          <button className="text-blue-700 font-semibold">קביעה</button>
        </form>
      )}
      <Activities orgId={orgId} type="lead" id={item.id} />
    </section>
  );
}

function QuoteEditor({ currency, onSave, onClose }) {
  const [lines, setLines] = useState([{ description: '', quantity: 1, unit_price: '' }]);
  const [discount, setDiscount] = useState('');
  const [terms, setTerms] = useState('');
  const [cur, setCur] = useState(currency || 'ILS');
  const setLine = (index, key, value) => setLines((all) => all.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  const subtotal = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);
  return (
    <Modal title="הצעת מחיר חדשה" onClose={onClose}>
      <form className="space-y-2" onSubmit={(e) => {
        e.preventDefault();
        onSave({ currency: cur, discount: Number(discount || 0), terms, lines: lines.map((l) => ({ ...l, quantity: Number(l.quantity), unit_price: Number(l.unit_price) })) });
      }}>
        {lines.map((line, index) => (
          <div key={index} className="flex gap-1">
            <input className="flex-1 min-w-0 border rounded-lg px-2 py-1" placeholder="תיאור" value={line.description} onChange={(e) => setLine(index, 'description', e.target.value)} required />
            <input className="w-14 border rounded-lg px-1 py-1" type="number" min="0.001" step="any" aria-label="כמות" value={line.quantity} onChange={(e) => setLine(index, 'quantity', e.target.value)} required />
            <input className="w-24 border rounded-lg px-1 py-1" type="number" min="0" step="0.01" placeholder="מחיר" value={line.unit_price} onChange={(e) => setLine(index, 'unit_price', e.target.value)} required />
          </div>
        ))}
        <button type="button" onClick={() => setLines((all) => [...all, { description: '', quantity: 1, unit_price: '' }])} className="text-sm text-blue-700">+ שורה</button>
        <div className="flex gap-2">
          <select className="border rounded-lg px-2" value={cur} onChange={(e) => setCur(e.target.value)} aria-label="מטבע">
            {['ILS', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className="flex-1 border rounded-lg px-2 py-1" type="number" min="0" step="0.01" placeholder="הנחה" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <textarea className={input} rows={2} placeholder="תנאים" value={terms} onChange={(e) => setTerms(e.target.value)} />
        <p className="text-sm">סה״כ: {money(Math.max(subtotal - Number(discount || 0), 0), cur)}</p>
        <button className="bg-blue-700 text-white rounded-xl px-4 py-2">יצירה</button>
      </form>
    </Modal>
  );
}

function DealDetail({ orgId, deal, stages, templates, onBack, mutate }) {
  const quotes = useQuery({ queryKey: ['company', orgId, 'quotes', deal.id], queryFn: () => companyApi.quotes(orgId, deal.id) });
  const [editing, setEditing] = useState(false);
  const [acceptedBy, setAcceptedBy] = useState('');
  const [templateId, setTemplateId] = useState('');

  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-blue-700 font-semibold">חזרה</button>
      <div>
        <h1 className="text-2xl font-bold flex gap-2">{deal.is_confidential && <Lock size={22} />}{deal.title}</h1>
        <p className="text-blue-700">{deal.account_name} · {DEAL_STATUS[deal.status]} · {deal.owner_name}</p>
        <p className="text-sm text-gray-600">תחזית: {money(deal.forecast_value, deal.currency)}{deal.booked_value != null && ` · נסגר: ${money(deal.booked_value, deal.currency)}`}</p>
        {deal.lost_reason && <p className="text-sm text-red-700">סיבת הפסד: {deal.lost_reason}</p>}
      </div>
      {deal.can_edit && deal.status === 'open' && (
        <div className="flex flex-wrap gap-2 items-center">
          <select className="border rounded-xl px-2 py-2" value={deal.stage_id} aria-label="שלב" onChange={(e) => mutate(() => companyApi.moveDealStage(orgId, deal.id, e.target.value))}>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={() => setEditing(true)} className="border border-blue-700 text-blue-700 rounded-xl px-4 py-2">הצעת מחיר חדשה</button>
          {deal.can_close_won && <button onClick={() => mutate(() => companyApi.closeWon(orgId, deal.id))} className="bg-emerald-700 text-white rounded-xl px-4 py-2">זכייה ובקשת פרויקט</button>}
          <ReasonButton label="הפסד" title="סיבת ההפסד" className="text-red-700 px-3 py-2" onConfirm={(r) => mutate(() => companyApi.closeLost(orgId, deal.id, r))} />
        </div>
      )}
      {deal.project_id && <a href={`/company/projects/${deal.project_id}`} className="block text-blue-700 underline">מעבר לפרויקט</a>}
      {deal.project_approval && (
        <div className="bg-white border rounded-2xl p-4 flex flex-wrap items-center gap-2">
          <strong className="flex-1">בקשת הקמת פרויקט · {QUOTE_STATUS[deal.project_approval.status] || deal.project_approval.status}</strong>
          {deal.project_approval.can_decide && (
            <>
              {templates.length > 0 && (
                <select className="border rounded-lg px-2 py-1 text-sm" value={templateId} onChange={(e) => setTemplateId(e.target.value)} aria-label="תבנית">
                  <option value="">משימות פתיחה רגילות</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <button onClick={() => mutate(() => companyApi.decideApproval(orgId, deal.project_approval.id, 'approved', '', templateId))} className="text-emerald-700 font-semibold">אישור והקמה</button>
              <ReasonButton label="דחייה" title="סיבת הדחייה" className="text-red-700 font-semibold" onConfirm={(r) => mutate(() => companyApi.decideApproval(orgId, deal.project_approval.id, 'rejected', r))} />
            </>
          )}
        </div>
      )}
      <h2 className="text-lg font-bold">הצעות מחיר</h2>
      {(quotes.data ?? []).map((quote) => (
        <article key={quote.id} className="bg-white border rounded-2xl p-4 space-y-2">
          <div className="flex justify-between"><strong>גרסה {quote.revision_no}</strong><strong>{money(quote.total, quote.currency)}</strong></div>
          <p className="text-sm text-blue-700">{QUOTE_STATUS[quote.status]}{quote.accepted_by && ` · התקבלה ע״י ${quote.accepted_by}`}</p>
          {quote.lines.map((line, index) => <p key={index} className="text-sm">{line.description} · {line.quantity} × {money(line.unit_price, quote.currency)}</p>)}
          {quote.discount > 0 && <p className="text-sm">הנחה: {money(quote.discount, quote.currency)}</p>}
          {quote.can_submit && <button onClick={() => mutate(() => companyApi.submitQuote(orgId, quote.id))} className="bg-blue-700 text-white rounded-lg px-3 py-1.5">שליחה לאישור</button>}
          {quote.can_mark_sent && <button onClick={() => mutate(() => companyApi.markQuoteSent(orgId, quote.id))} className="border rounded-lg px-3 py-1.5">סימון כנשלחה ללקוח</button>}
          {quote.can_record_acceptance && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); mutate(() => companyApi.recordQuoteAcceptance(orgId, quote.id, acceptedBy)); }}>
              <input className="flex-1 border rounded-lg px-2 py-1" placeholder="מי אישר אצל הלקוח" value={acceptedBy} onChange={(e) => setAcceptedBy(e.target.value)} required />
              <button className="text-emerald-700 font-semibold">תיעוד קבלה</button>
            </form>
          )}
          {quote.approvals.map((approval) => (
            <div key={approval.id} className="border-t pt-2 flex gap-2 text-sm">
              <span className="flex-1">{approval.assignee_name || 'מאשר'} · {QUOTE_STATUS[approval.status] || approval.status}{approval.reason && ` · ${approval.reason}`}</span>
              {approval.can_decide && (
                <>
                  <button onClick={() => mutate(() => companyApi.decideApproval(orgId, approval.id, 'approved', ''))} className="text-emerald-700 font-semibold">אישור</button>
                  <ReasonButton label="דחייה" title="סיבת הדחייה" className="text-red-700 font-semibold" onConfirm={(r) => mutate(() => companyApi.decideApproval(orgId, approval.id, 'rejected', r))} />
                </>
              )}
            </div>
          ))}
        </article>
      ))}
      <Activities orgId={orgId} type="deal" id={deal.id} />
      {editing && <QuoteEditor currency={deal.currency} onClose={() => setEditing(false)} onSave={(body) => { setEditing(false); mutate(() => companyApi.createQuote(orgId, deal.id, body)); }} />}
    </section>
  );
}

function AccountDetail({ orgId, accountId, onBack, onOpenDeal, mutate }) {
  const card = useQuery({ queryKey: ['company', orgId, 'account', accountId], queryFn: () => companyApi.account(orgId, accountId) });
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [dealTitle, setDealTitle] = useState('');
  if (card.isPending) return <p className="py-12 text-center">טוען…</p>;
  if (card.isError) return <p className="text-red-700">{errorMessage(card.error)}</p>;
  const { account, contacts, deals, projects } = card.data;
  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-blue-700 font-semibold">חזרה</button>
      <h1 className="text-2xl font-bold flex gap-2">{account.is_confidential && <Lock size={22} />}{account.name}</h1>
      <section className="bg-white border rounded-2xl p-4 space-y-2">
        <h3 className="font-bold">אנשי קשר</h3>
        {contacts.map((c) => <p key={c.id} className="text-sm">{c.name} · <span dir="ltr">{c.email || c.phone}</span></p>)}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); mutate(() => companyApi.addContact(orgId, account.id, contact)); setContact({ name: '', email: '', phone: '' }); }}>
          <input className="flex-1 min-w-[8rem] border rounded-lg px-2 py-1" placeholder="שם" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} required />
          <input className="flex-1 min-w-[8rem] border rounded-lg px-2 py-1" placeholder="דוא״ל" dir="ltr" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
          <button className="text-blue-700 font-semibold">הוספה</button>
        </form>
      </section>
      <section className="bg-white border rounded-2xl p-4 space-y-2">
        <h3 className="font-bold">עסקאות</h3>
        {deals.map((d) => <button key={d.id} onClick={() => onOpenDeal(d)} className="block text-sm text-right underline">{d.title} · {DEAL_STATUS[d.status]}</button>)}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); mutate(() => companyApi.createDeal(orgId, { title: dealTitle, account_id: account.id })); setDealTitle(''); }}>
          <input className="flex-1 border rounded-lg px-2 py-1" placeholder="עסקה חדשה" value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} required />
          <button className="text-blue-700 font-semibold">יצירה</button>
        </form>
      </section>
      {projects.length > 0 && (
        <section className="bg-white border rounded-2xl p-4 space-y-1">
          <h3 className="font-bold">פרויקטים</h3>
          {projects.map((p) => <a key={p.id} href={`/company/projects/${p.id}`} className="block text-sm underline">{p.name}</a>)}
        </section>
      )}
      <Activities orgId={orgId} type="account" id={account.id} />
    </section>
  );
}

export default function CrmPage({ membership }) {
  const orgId = membership.organization.id;
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'leads';
  const leadId = params.get('lead');
  const dealId = params.get('deal');
  const accountId = params.get('account');
  const [newLead, setNewLead] = useState(false);
  const [newAccount, setNewAccount] = useState('');
  const [dragging, setDragging] = useState(null);
  const open = (next) => setParams(next);

  const leads = useQuery({ queryKey: ['company', orgId, 'leads'], queryFn: () => companyApi.leads(orgId) });
  const deals = useQuery({ queryKey: ['company', orgId, 'deals'], queryFn: () => companyApi.deals(orgId) });
  const accounts = useQuery({ queryKey: ['company', orgId, 'accounts'], queryFn: () => companyApi.accounts(orgId) });
  const pipeline = useQuery({ queryKey: ['company', orgId, 'pipeline'], queryFn: () => companyApi.pipeline(orgId) });
  const templates = useQuery({ queryKey: ['company', orgId, 'projects', 'templates'], queryFn: () => companyApi.templates(orgId) });
  const members = useQuery({
    queryKey: ['company', orgId, 'members'],
    queryFn: () => companyApi.members(orgId),
    enabled: membership.permissions.view_members,
  });
  const action = useMutation({
    mutationFn: (task) => task(),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['company', orgId] }); setNewLead(false); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const mutate = (task) => action.mutate(task);
  const activeMembers = (members.data?.data ?? []).filter((m) => m.status === 'active');
  const stages = pipeline.data ?? [];

  if (leadId) {
    return <LeadDetail orgId={orgId} leadId={leadId} members={activeMembers} accounts={accounts.data ?? []} onBack={() => open({ tab })} mutate={mutate} />;
  }
  if (dealId) {
    const deal = (deals.data ?? []).find((d) => String(d.id) === dealId);
    if (!deal) return deals.isPending ? <p className="py-12 text-center">טוען…</p> : <p>העסקה לא נמצאה, או שאין לך גישה אליה.</p>;
    return <DealDetail orgId={orgId} deal={deal} stages={stages} templates={templates.data ?? []} onBack={() => open({ tab: 'deals' })} mutate={mutate} />;
  }
  if (accountId) {
    return <AccountDetail orgId={orgId} accountId={accountId} onBack={() => open({ tab: 'accounts' })} onOpenDeal={(d) => open({ deal: d.id })} mutate={mutate} />;
  }

  const openDeals = (deals.data ?? []).filter((d) => d.status === 'open');
  const closedDeals = (deals.data ?? []).filter((d) => d.status !== 'open');

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">מכירות ולקוחות</h1>
          <p className="text-sm text-gray-500">מהליד הראשון ועד פרויקט מאושר.</p>
        </div>
        {tab === 'leads' && ['owner', 'admin', 'manager'].includes(membership.role) && (
          <a href={companyApi.leadsExportUrl(orgId)} className="border rounded-xl px-3 py-2 flex gap-1 items-center text-sm"><Download size={16} />CSV</a>
        )}
        {tab === 'leads' && membership.permissions.create_leads && (
          <button onClick={() => setNewLead(true)} className="bg-blue-700 text-white rounded-xl px-4 py-2 flex gap-2"><Plus size={18} />ליד חדש</button>
        )}
      </div>
      <div className="flex border-b">
        {[['leads', 'לידים'], ['deals', 'צינור עסקאות'], ['accounts', 'לקוחות']].map(([key, label]) => (
          <button key={key} onClick={() => open({ tab: key })} className={'px-5 py-2 border-b-2 font-semibold ' + (tab === key ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500')}>{label}</button>
        ))}
      </div>

      {tab === 'leads' && (
        <div className="grid sm:grid-cols-2 gap-3">
          {leads.data?.length === 0 && <p className="text-gray-500">אין לידים עדיין</p>}
          {(leads.data ?? []).map((lead) => (
            <button key={lead.id} onClick={() => open({ lead: lead.id })} className="text-right bg-white border rounded-2xl p-4 flex gap-3">
              {lead.is_confidential ? <Lock className="text-blue-700" /> : <UserPlus className="text-blue-700" />}
              <span><strong className="block">{lead.title}</strong><span className="text-sm text-gray-500">{lead.person_name} · {lead.company_name}</span><span className="block text-xs text-blue-700">{LEAD_STATUS[lead.status]} · {ASSIGNMENT[lead.assignment_state]}</span></span>
            </button>
          ))}
        </div>
      )}

      {tab === 'deals' && (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stages.map((stage) => {
              const column = openDeals.filter((d) => d.stage_id === stage.id);
              return (
                <div
                  key={stage.id}
                  className="w-56 shrink-0 bg-gray-100 rounded-xl p-2 space-y-2"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragging && dragging.stage_id !== stage.id) mutate(() => companyApi.moveDealStage(orgId, dragging.id, stage.id)); setDragging(null); }}
                >
                  <h3 className="text-xs font-bold text-gray-600">{stage.name} ({column.length})</h3>
                  {column.map((deal) => (
                    <button key={deal.id} draggable={deal.can_edit} onDragStart={() => setDragging(deal)} onClick={() => open({ deal: deal.id })} className="block w-full text-right bg-white rounded-lg shadow-sm p-2">
                      <p className="text-sm font-semibold flex gap-1">{deal.is_confidential && <Lock size={14} />}{deal.title}</p>
                      <p className="text-xs text-gray-500">{deal.account_name} · {money(deal.forecast_value, deal.currency)}</p>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          {closedDeals.length > 0 && (
            <div className="space-y-1">
              <h3 className="font-bold text-sm">סגורות</h3>
              {closedDeals.map((deal) => (
                <button key={deal.id} onClick={() => open({ deal: deal.id })} className="flex gap-2 text-sm"><Handshake size={14} />{deal.title} · {DEAL_STATUS[deal.status]}</button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'accounts' && (
        <div className="space-y-3">
          {membership.role !== 'guest' && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); mutate(() => companyApi.createAccount(orgId, { name: newAccount })); setNewAccount(''); }}>
              <input className="flex-1 border rounded-xl px-3 py-2" placeholder="לקוח חדש" value={newAccount} onChange={(e) => setNewAccount(e.target.value)} required />
              <button className="bg-blue-700 text-white rounded-xl px-4">יצירה</button>
            </form>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {(accounts.data ?? []).map((account) => (
              <button key={account.id} onClick={() => open({ account: account.id })} className="text-right bg-white border rounded-2xl p-4 flex gap-3">
                <Building2 className="text-blue-700" /><span><strong className="block">{account.name}</strong><span className="text-sm text-gray-500">{account.email || account.phone}</span><span className="block text-xs text-blue-700">{account.open_deals} עסקאות פתוחות</span></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {newLead && <LeadForm pending={action.isPending} onClose={() => setNewLead(false)} onSave={(body) => mutate(() => companyApi.createLead(orgId, body))} />}
    </section>
  );
}
