import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Handshake, Lock, Plus, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { companyApi, errorMessage } from './companyApi';

const LEAD_STATUS = {
  new: 'חדש', assigned: 'משויך', accepted: 'באחריות', contacting: 'בטיפול',
  qualified: 'מוסמך', converted: 'הומר', nurturing: 'טיפוח', disqualified: 'נפסל',
};
const ASSIGNMENT = {
  unassigned: 'ללא אחראי', pending: 'ממתין לקבלת אחריות',
  accepted: 'האחריות התקבלה', rejected: 'השיוך נדחה',
};
const QUOTE_STATUS = {
  draft: 'טיוטה', in_review: 'באישור', approved: 'מאושרת',
  rejected: 'נדחתה', superseded: 'גרסה קודמת',
};

function LeadForm({ onClose, onSave, pending }) {
  const [form, setForm] = useState({ title: '', person_name: '', company_name: '', email: '', phone: '', source: 'manual', is_confidential: false });
  const field = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));
  return (
    <div className="fixed inset-0 z-30 bg-black/40 p-4 flex items-center justify-center">
      <form onSubmit={(event) => { event.preventDefault(); onSave(form); }} className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3">
        <h2 className="text-xl font-bold">ליד חדש</h2>
        <input value={form.title} onChange={field('title')} className="w-full border rounded-xl px-3 py-2" placeholder="כותרת" required />
        <input value={form.person_name} onChange={field('person_name')} className="w-full border rounded-xl px-3 py-2" placeholder="איש קשר" />
        <input value={form.company_name} onChange={field('company_name')} className="w-full border rounded-xl px-3 py-2" placeholder="חברה" />
        <input value={form.email} onChange={field('email')} className="w-full border rounded-xl px-3 py-2" placeholder="דוא״ל" type="email" />
        <input value={form.phone} onChange={field('phone')} className="w-full border rounded-xl px-3 py-2" placeholder="טלפון" />
        <label className="flex gap-2"><input type="checkbox" checked={form.is_confidential} onChange={(event) => setForm((current) => ({ ...current, is_confidential: event.target.checked }))} />ליד חסוי</label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="border rounded-xl px-4 py-2">ביטול</button>
          <button disabled={pending} className="bg-blue-700 text-white rounded-xl px-4 py-2">יצירה</button>
        </div>
      </form>
    </div>
  );
}

function LeadDetail({ lead, members, onBack, mutate }) {
  const assign = () => {
    const choices = members.map((member, index) => String(index + 1) + '. ' + member.name).join('\n');
    const selected = Number(window.prompt('בחרו מספר עובד:\n' + choices)) - 1;
    if (members[selected]) mutate(() => companyApi.assignLead(lead.orgId, lead.id, members[selected].user_id));
  };
  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-blue-700 font-semibold">חזרה ללידים</button>
      <div>
        <h1 className="text-2xl font-bold flex gap-2">{lead.is_confidential && <Lock size={22} />}{lead.title}</h1>
        <p className="text-blue-700">{LEAD_STATUS[lead.status]} · {ASSIGNMENT[lead.assignment_state]}</p>
      </div>
      <div className="bg-white border rounded-2xl p-4 grid sm:grid-cols-2 gap-3">
        <p><span className="text-gray-500">איש קשר: </span>{lead.person_name || '—'}</p>
        <p><span className="text-gray-500">חברה: </span>{lead.company_name || '—'}</p>
        <p><span className="text-gray-500">דוא״ל: </span>{lead.email || '—'}</p>
        <p><span className="text-gray-500">אחראי: </span>{lead.assigned_name || 'טרם שויך'}</p>
      </div>
      {lead.score != null && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <strong>ציון עדיפות {lead.score}</strong>
          <p className="text-sm">{lead.score_explanation || 'הציון הוא המלצה בלבד ודורש שיקול דעת אנושי.'}</p>
        </div>
      )}
      {lead.duplicate_candidates?.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          נמצאו התאמות אפשריות: {lead.duplicate_candidates.map((item) => item.label).join(', ')}. לא בוצע מיזוג אוטומטי.
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {lead.can_assign && <button onClick={assign} className="border border-blue-700 text-blue-700 rounded-xl px-4 py-2">שיוך</button>}
        {lead.assignment_state === 'pending' && (
          <>
            <button onClick={() => mutate(() => companyApi.decideLeadAssignment(lead.orgId, lead.id, 'accepted', ''))} className="bg-blue-700 text-white rounded-xl px-4 py-2">קבלת אחריות</button>
            <button onClick={() => {
              const reason = window.prompt('סיבת דחיית השיוך');
              if (reason) mutate(() => companyApi.decideLeadAssignment(lead.orgId, lead.id, 'rejected', reason));
            }} className="border rounded-xl px-4 py-2">דחייה</button>
          </>
        )}
        {lead.can_edit && ['accepted', 'contacting'].includes(lead.status) && (
          <button onClick={() => mutate(() => companyApi.transitionLead(lead.orgId, lead.id, 'qualified', ''))} className="bg-violet-700 text-white rounded-xl px-4 py-2">סימון כמוסמך</button>
        )}
        {lead.can_convert && (
          <button onClick={() => mutate(() => companyApi.convertLead(lead.orgId, lead.id, ''))} className="bg-emerald-700 text-white rounded-xl px-4 py-2">המרה לעסקה</button>
        )}
        {lead.can_edit && !['converted', 'disqualified'].includes(lead.status) && (
          <button onClick={() => {
            const reason = window.prompt('סיבת פסילה');
            if (reason) mutate(() => companyApi.transitionLead(lead.orgId, lead.id, 'disqualified', reason));
          }} className="text-red-700 px-4 py-2">פסילה</button>
        )}
      </div>
    </section>
  );
}

function DealDetail({ deal, orgId, onBack, mutate }) {
  const quotes = useQuery({
    queryKey: ['company', orgId, 'quotes', deal.id],
    queryFn: () => companyApi.quotes(orgId, deal.id),
  });
  const newQuote = () => {
    const description = window.prompt('תיאור השירות או המוצר');
    if (!description) return;
    const amount = Number(window.prompt('סכום'));
    if (!Number.isFinite(amount) || amount < 0) return toast.error('סכום לא תקין');
    mutate(() => companyApi.createQuote(orgId, deal.id, {
      currency: deal.currency || 'ILS',
      lines: [{ description, quantity: 1, unit_price: amount }],
    }));
  };
  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-blue-700 font-semibold">חזרה לעסקאות</button>
      <div>
        <h1 className="text-2xl font-bold">{deal.title}</h1>
        <p className="text-blue-700">{deal.account_name} · {deal.status === 'won' ? 'זכייה' : 'פתוחה'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {deal.can_edit && deal.status === 'open' && <button onClick={newQuote} className="border border-blue-700 text-blue-700 rounded-xl px-4 py-2">הצעת מחיר חדשה</button>}
        {deal.can_close_won && <button onClick={() => mutate(() => companyApi.closeWon(orgId, deal.id))} className="bg-emerald-700 text-white rounded-xl px-4 py-2">סגירה כזכייה ובקשת פרויקט</button>}
      </div>
      {deal.project_approval && (
        <div className="bg-white border rounded-2xl p-4 flex flex-wrap items-center gap-2">
          <strong className="flex-1">בקשת הקמת פרויקט · {QUOTE_STATUS[deal.project_approval.status] || deal.project_approval.status}</strong>
          {deal.project_approval.can_decide && deal.project_approval.status === 'pending' && (
            <>
              <button onClick={() => mutate(() => companyApi.decideApproval(orgId, deal.project_approval.id, 'approved', ''))} className="text-emerald-700 font-semibold">אישור והקמה</button>
              <button onClick={() => {
                const reason = window.prompt('סיבת דחיית הקמת הפרויקט');
                if (reason) mutate(() => companyApi.decideApproval(orgId, deal.project_approval.id, 'rejected', reason));
              }} className="text-red-700 font-semibold">דחייה</button>
            </>
          )}
        </div>
      )}
      <h2 className="text-lg font-bold">הצעות מחיר</h2>
      {(quotes.data || []).map((quote) => (
        <article key={quote.id} className="bg-white border rounded-2xl p-4 space-y-2">
          <div className="flex justify-between"><strong>גרסה {quote.revision_no}</strong><strong>{quote.total.toLocaleString()} {quote.currency}</strong></div>
          <p className="text-sm text-blue-700">{QUOTE_STATUS[quote.status]}</p>
          {quote.lines.map((line, index) => <p key={index} className="text-sm">{line.description} · {line.total.toLocaleString()} {quote.currency}</p>)}
          {quote.can_submit && <button onClick={() => mutate(() => companyApi.submitQuote(orgId, quote.id))} className="bg-blue-700 text-white rounded-lg px-3 py-1.5">שליחה לאישור</button>}
          {quote.approvals.map((approval) => (
            <div key={approval.id} className="border-t pt-2 flex gap-2">
              <span className="flex-1">{approval.assignee_name || 'מאשר'} · {QUOTE_STATUS[approval.status] || approval.status}</span>
              {approval.can_decide && approval.status === 'pending' && (
                <>
                  <button onClick={() => mutate(() => companyApi.decideApproval(orgId, approval.id, 'approved', ''))} className="text-emerald-700 font-semibold">אישור</button>
                  <button onClick={() => {
                    const reason = window.prompt('סיבת דחייה');
                    if (reason) mutate(() => companyApi.decideApproval(orgId, approval.id, 'rejected', reason));
                  }} className="text-red-700 font-semibold">דחייה</button>
                </>
              )}
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}

export default function CrmPage({ membership }) {
  const orgId = membership.organization.id;
  const client = useQueryClient();
  const [tab, setTab] = useState('leads');
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [newLead, setNewLead] = useState(false);
  const leads = useQuery({ queryKey: ['company', orgId, 'leads'], queryFn: () => companyApi.leads(orgId) });
  const deals = useQuery({ queryKey: ['company', orgId, 'deals'], queryFn: () => companyApi.deals(orgId) });
  const accounts = useQuery({ queryKey: ['company', orgId, 'accounts'], queryFn: () => companyApi.accounts(orgId) });
  const members = useQuery({
    queryKey: ['company', orgId, 'members'],
    queryFn: () => companyApi.members(orgId),
    enabled: membership.permissions.view_members,
  });
  const action = useMutation({
    mutationFn: (task) => task(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['company', orgId] });
      setSelectedLead(null);
      setSelectedDeal(null);
      setNewLead(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const mutate = (task) => action.mutate(task);
  if (selectedLead) return <LeadDetail lead={{ ...selectedLead, orgId }} members={members.data || []} onBack={() => setSelectedLead(null)} mutate={mutate} />;
  if (selectedDeal) return <DealDetail deal={selectedDeal} orgId={orgId} onBack={() => setSelectedDeal(null)} mutate={mutate} />;

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">מכירות ולקוחות</h1>
          <p className="text-sm text-gray-500">מהליד הראשון ועד פרויקט מאושר.</p>
        </div>
        {tab === 'leads' && membership.permissions.create_leads && (
          <button onClick={() => setNewLead(true)} className="bg-blue-700 text-white rounded-xl px-4 py-2 flex gap-2"><Plus size={18} />ליד חדש</button>
        )}
      </div>
      <div className="flex border-b">
        {[['leads', 'לידים'], ['deals', 'עסקאות'], ['accounts', 'לקוחות']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={'px-5 py-2 border-b-2 font-semibold ' + (tab === key ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500')}>{label}</button>
        ))}
      </div>
      {tab === 'leads' && <div className="grid sm:grid-cols-2 gap-3">
        {(leads.data || []).map((lead) => (
          <button key={lead.id} onClick={() => setSelectedLead(lead)} className="text-right bg-white border rounded-2xl p-4 flex gap-3">
            {lead.is_confidential ? <Lock className="text-blue-700" /> : <UserPlus className="text-blue-700" />}
            <span><strong className="block">{lead.title}</strong><span className="text-sm text-gray-500">{lead.person_name} · {lead.company_name}</span><span className="block text-xs text-blue-700">{LEAD_STATUS[lead.status]} · {ASSIGNMENT[lead.assignment_state]}</span></span>
          </button>
        ))}
      </div>}
      {tab === 'deals' && <div className="grid sm:grid-cols-2 gap-3">
        {(deals.data || []).map((deal) => (
          <button key={deal.id} onClick={() => setSelectedDeal(deal)} className="text-right bg-white border rounded-2xl p-4 flex gap-3">
            <Handshake className="text-blue-700" /><span><strong className="block">{deal.title}</strong><span className="text-sm text-gray-500">{deal.account_name}</span><span className="block text-xs text-blue-700">{Number(deal.forecast_value || 0).toLocaleString()} {deal.currency}</span></span>
          </button>
        ))}
      </div>}
      {tab === 'accounts' && <div className="grid sm:grid-cols-2 gap-3">
        {(accounts.data || []).map((account) => (
          <article key={account.id} className="bg-white border rounded-2xl p-4 flex gap-3">
            <Building2 className="text-blue-700" /><span><strong className="block">{account.name}</strong><span className="text-sm text-gray-500">{account.email || account.phone}</span><span className="block text-xs text-blue-700">{account.open_deals} עסקאות פתוחות</span></span>
          </article>
        ))}
      </div>}
      {newLead && <LeadForm pending={action.isPending} onClose={() => setNewLead(false)} onSave={(body) => mutate(() => companyApi.createLead(orgId, body))} />}
    </section>
  );
}
