import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, FilePlus2, FileText, History, Lock, Paperclip, ShieldCheck, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { companyApi, errorMessage } from './companyApi';

const STATUS = {
  draft: 'טיוטה', in_review: 'באישור', approved: 'מאושר', published: 'פורסם',
  rejected: 'נדחה', superseded: 'גרסה קודמת', pending: 'ממתין',
};
const TYPES = {
  spec: 'אפיון', meeting_summary: 'סיכום פגישה', quote: 'הצעת מחיר', contract: 'חוזה', sop: 'נוהל',
  decision: 'החלטה', postmortem: 'תחקיר', onboarding: 'מדריך קליטה', other: 'אחר',
};
const LINK_TYPES = { project: 'פרויקט', deal: 'עסקה', lead: 'ליד', account: 'לקוח' };
const input = 'w-full border rounded-xl px-3 py-2';

// Plain text with lightweight markup: headings (#), bullets (-), and **bold**. Rendered as
// React elements, never as HTML, so document content can't inject markup.
function Formatted({ text }) {
  const inline = (line) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  ));
  return (text || 'המסמך עדיין ריק').split('\n').map((line, index) => {
    if (line.startsWith('## ')) return <h3 key={index} className="font-bold text-lg mt-2">{inline(line.slice(3))}</h3>;
    if (line.startsWith('# ')) return <h2 key={index} className="font-bold text-xl mt-2">{inline(line.slice(2))}</h2>;
    if (line.startsWith('- ')) return <li key={index} className="mr-5 list-disc">{inline(line.slice(2))}</li>;
    return <p key={index} className="min-h-4" dir="auto">{inline(line)}</p>;
  });
}

function Editor({ title, initial = {}, isNew, templates, people, onClose, onSave, pending }) {
  const [form, setForm] = useState({
    title: initial.title || '', content: initial.content || '', type: 'other', tags: '',
    visibility: 'organization', allowed_user_ids: [], template_id: '', is_template: false,
    decision: { context: '', decision: '', alternatives: '' },
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setDecision = (key) => (e) => setForm((f) => ({ ...f, decision: { ...f.decision, [key]: e.target.value } }));
  const toggleUser = (id) => setForm((f) => ({
    ...f,
    allowed_user_ids: f.allowed_user_ids.includes(id) ? f.allowed_user_ids.filter((x) => x !== id) : [...f.allowed_user_ids, id],
  }));

  const submit = (event) => {
    event.preventDefault();
    const body = { title: form.title.trim(), content: form.content.trim(), summary: form.content.trim().slice(0, 300) };
    if (isNew) {
      Object.assign(body, {
        type: form.type,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        visibility: form.visibility,
        allowed_user_ids: form.allowed_user_ids,
        is_template: form.is_template,
        template_id: form.template_id || undefined,
        decision: form.type === 'decision' ? form.decision : undefined,
      });
    }
    onSave(body);
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 p-4 flex items-center justify-center" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-white rounded-2xl p-5 w-full max-w-2xl space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between"><h2 className="text-xl font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="סגירה"><X size={18} /></button></div>
        <input className={input} value={form.title} onChange={set('title')} placeholder="כותרת" required />
        {isNew && (
          <div className="grid grid-cols-2 gap-2">
            <select className={input} value={form.type} onChange={set('type')} aria-label="סוג מסמך">
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className={input} value={form.template_id} onChange={set('template_id')} aria-label="תבנית">
              <option value="">ללא תבנית</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <input className={`${input} col-span-2`} value={form.tags} onChange={set('tags')} placeholder="תגיות, מופרדות בפסיק" />
          </div>
        )}
        {isNew && form.type === 'decision' && (
          <div className="space-y-2 bg-gray-50 rounded-xl p-2">
            <input className={input} value={form.decision.context} onChange={setDecision('context')} placeholder="רקע" />
            <input className={input} value={form.decision.decision} onChange={setDecision('decision')} placeholder="ההחלטה" />
            <input className={input} value={form.decision.alternatives} onChange={setDecision('alternatives')} placeholder="חלופות שנבחנו" />
          </div>
        )}
        <textarea className={`${input} min-h-52 font-mono text-sm`} value={form.content} onChange={set('content')} placeholder={'תוכן. # כותרת, - רשימה, **הדגשה**'} />
        {isNew && (
          <>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" checked={form.visibility === 'restricted'} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.checked ? 'restricted' : 'organization' }))} />
              מוגבל לאנשים מסוימים
            </label>
            {form.visibility === 'restricted' && (
              <div className="flex flex-wrap gap-2 text-sm">
                {people.map((p) => (
                  <label key={p.user_id} className="flex gap-1"><input type="checkbox" checked={form.allowed_user_ids.includes(String(p.user_id))} onChange={() => toggleUser(String(p.user_id))} />{p.name}</label>
                ))}
              </div>
            )}
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.is_template} onChange={(e) => setForm((f) => ({ ...f, is_template: e.target.checked }))} />שמירה כתבנית</label>
          </>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="border rounded-xl px-4 py-2">ביטול</button>
          <button disabled={pending} className="bg-blue-700 text-white rounded-xl px-4 py-2 disabled:opacity-50">שמירה</button>
        </div>
      </form>
    </div>
  );
}

function LinkPicker({ orgId, onAdd }) {
  const [type, setType] = useState('project');
  const [id, setId] = useState('');
  const options = useQuery({
    queryKey: ['company', orgId, 'link-options', type],
    queryFn: async () => {
      if (type === 'project') return (await companyApi.projects(orgId)).data.map((p) => ({ id: p.id, name: p.name }));
      if (type === 'deal') return (await companyApi.deals(orgId)).map((d) => ({ id: d.id, name: d.title }));
      if (type === 'lead') return (await companyApi.leads(orgId)).map((l) => ({ id: l.id, name: l.title }));
      return (await companyApi.accounts(orgId)).map((a) => ({ id: a.id, name: a.name }));
    },
  });
  return (
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); onAdd(type, id); setId(''); }}>
      <select className="border rounded-lg px-2 py-1 text-sm" value={type} onChange={(e) => { setType(e.target.value); setId(''); }} aria-label="סוג קישור">
        {Object.entries(LINK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select className="flex-1 border rounded-lg px-2 py-1 text-sm" value={id} onChange={(e) => setId(e.target.value)} required aria-label="רשומה לקישור">
        <option value="">בחירה…</option>
        {(options.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <button className="text-blue-700 font-semibold text-sm">קישור</button>
    </form>
  );
}

export default function DocumentsPage({ membership }) {
  const orgId = membership.organization.id;
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('id');
  const [editor, setEditor] = useState(null);
  const [filters, setFilters] = useState({ type: '', archived: false, templates: false });
  const listParams = {
    type: filters.type || undefined,
    archived: filters.archived ? 'true' : undefined,
    templates: filters.templates ? 'true' : undefined,
  };

  const documents = useQuery({ queryKey: ['company', orgId, 'documents', listParams], queryFn: () => companyApi.documents(orgId, listParams) });
  const templates = useQuery({ queryKey: ['company', orgId, 'documents', 'templates'], queryFn: () => companyApi.documents(orgId, { templates: 'true' }) });
  const people = useQuery({
    queryKey: ['company', orgId, 'members'],
    queryFn: () => companyApi.members(orgId),
    enabled: membership.permissions.view_members,
  });
  const detail = useQuery({
    queryKey: ['company', orgId, 'document', selectedId],
    queryFn: () => companyApi.document(orgId, selectedId),
    enabled: Boolean(selectedId),
    retry: false,
  });
  const action = useMutation({
    mutationFn: (task) => task(),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['company', orgId] }); setEditor(null); },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const run = (task) => action.mutate(task);
  const activePeople = (people.data?.data ?? []).filter((p) => p.status === 'active' && !p.is_self);

  useEffect(() => {
    if (selectedId && detail.isError) setParams({});
  }, [detail.isError, selectedId, setParams]);

  if (selectedId && detail.isPending) return <p className="text-center py-12">טוען מסמך…</p>;
  if (selectedId && detail.data) {
    const item = detail.data;
    const doc = item.document;
    return (
      <section className="space-y-4">
        <button onClick={() => setParams({})} className="text-blue-700 font-semibold">חזרה למסמכים</button>
        <div>
          <h1 className="text-2xl font-bold flex gap-2">{doc.visibility === 'restricted' && <Lock size={22} />}{doc.title}</h1>
          <p className="text-sm text-blue-700">
            {TYPES[doc.type]} · גרסה {item.current_revision.revision_no} · {STATUS[doc.status]}{doc.archived && ' · בארכיון'}
          </p>
          {doc.tags?.length > 0 && <p className="text-xs text-gray-500">{doc.tags.map((t) => `#${t}`).join(' ')}</p>}
        </div>
        {doc.decision && (
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 text-sm space-y-1">
            {doc.decision.context && <p><strong>רקע:</strong> {doc.decision.context}</p>}
            {doc.decision.decision && <p><strong>החלטה:</strong> {doc.decision.decision}</p>}
            {doc.decision.alternatives && <p><strong>חלופות:</strong> {doc.decision.alternatives}</p>}
          </div>
        )}
        <article className="bg-white border rounded-2xl p-5 min-h-40 space-y-1"><Formatted text={item.current_revision.content} /></article>
        <div className="flex flex-wrap gap-2">
          {doc.permissions.edit && !doc.archived && <button onClick={() => setEditor('revision')} className="border border-blue-700 text-blue-700 rounded-xl px-4 py-2">גרסה חדשה</button>}
          {doc.permissions.edit && doc.status === 'draft' && <button onClick={() => run(() => companyApi.submitDocument(orgId, selectedId))} className="bg-blue-700 text-white rounded-xl px-4 py-2">שליחה לאישור</button>}
          {doc.permissions.publish && doc.status === 'approved' && <button onClick={() => run(() => companyApi.publishDocument(orgId, selectedId))} className="bg-emerald-700 text-white rounded-xl px-4 py-2">פרסום</button>}
          {doc.permissions.edit && (
            <button onClick={() => run(() => companyApi.archiveDocument(orgId, selectedId, !doc.archived))} className="border rounded-xl px-4 py-2 flex gap-1 items-center">
              <Archive size={16} />{doc.archived ? 'החזרה מארכיון' : 'ארכיון'}
            </button>
          )}
        </div>

        {item.approvals.length > 0 && (
          <div className="bg-white border rounded-2xl p-4 space-y-2">
            <h2 className="font-bold flex gap-2"><ShieldCheck size={20} />שרשרת אישור</h2>
            {item.approvals.map((approval) => (
              <div key={approval.id} className="flex items-center gap-2 border-t pt-2 text-sm">
                <span className="flex-1">{approval.assignee_name || 'מאשר'} · {STATUS[approval.status] || approval.status}{approval.reason && ` · ${approval.reason}`}</span>
                {approval.can_decide && (
                  <>
                    <button onClick={() => run(() => companyApi.decideApproval(orgId, approval.id, 'approved', ''))} className="text-emerald-700 font-semibold">אישור</button>
                    <RejectButton onReject={(reason) => run(() => companyApi.decideApproval(orgId, approval.id, 'rejected', reason))} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border rounded-2xl p-4 space-y-2">
          <h2 className="font-bold">קישורים</h2>
          {item.links.map((link) => (
            <div key={link.id} className="flex gap-2 text-sm">
              <span className="flex-1">{LINK_TYPES[link.resource_type]} · {String(link.resource_id).slice(-6)}</span>
              {doc.permissions.edit && <button onClick={() => run(() => companyApi.removeDocumentLink(orgId, selectedId, link.id))} className="text-red-700">הסרה</button>}
            </div>
          ))}
          {doc.permissions.edit && <LinkPicker orgId={orgId} onAdd={(type, id) => run(() => companyApi.addDocumentLink(orgId, selectedId, type, id))} />}
        </div>

        <div className="bg-white border rounded-2xl p-4 space-y-2">
          <h2 className="font-bold flex gap-2"><Paperclip size={18} />קבצים</h2>
          {item.files.map((file) => <a key={file.id} href={companyApi.fileUrl(orgId, file.id)} className="block text-sm underline">{file.name}</a>)}
          {doc.permissions.edit && (
            <input type="file" aria-label="צירוף קובץ" className="text-sm" onChange={(e) => {
              if (e.target.files[0]) run(() => companyApi.uploadDocumentFile(orgId, selectedId, e.target.files[0]));
              e.target.value = '';
            }} />
          )}
        </div>

        {item.children.length > 0 && (
          <div className="bg-white border rounded-2xl p-4 space-y-1">
            <h2 className="font-bold">מסמכי משנה</h2>
            {item.children.map((child) => <button key={child.id} onClick={() => setParams({ id: child.id })} className="block text-sm underline">{child.title}</button>)}
          </div>
        )}

        <div className="bg-white border rounded-2xl p-4 space-y-2">
          <h2 className="font-bold flex gap-2"><History size={20} />היסטוריית גרסאות</h2>
          {item.revisions.map((revision) => (
            <div key={revision.id} className="border-t pt-2 flex gap-2 text-sm">
              <span className="flex-1">גרסה {revision.revision_no}: {revision.title} · {STATUS[revision.status]} · {revision.created_by_name}</span>
              {doc.permissions.edit && revision.id !== item.current_revision.id && (
                <button onClick={() => run(() => companyApi.restoreRevision(orgId, selectedId, revision.id))} className="text-blue-700">שחזור</button>
              )}
            </div>
          ))}
        </div>
        {editor === 'revision' && (
          <Editor
            title="גרסה חדשה" initial={item.current_revision} pending={action.isPending} templates={[]} people={[]}
            onClose={() => setEditor(null)}
            onSave={(body) => run(() => companyApi.createDocumentRevision(orgId, selectedId, body))}
          />
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">מרכז הידע</h1>
          <p className="text-sm text-gray-500">מסמכים, החלטות, גרסאות ואישורים במקום אחד.</p>
        </div>
        {membership.permissions.create_documents && (
          <button onClick={() => setEditor('new')} className="bg-blue-700 text-white rounded-xl px-4 py-2 flex gap-2"><FilePlus2 size={18} />מסמך חדש</button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-sm items-center">
        <select className="border rounded-lg px-2 py-1" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} aria-label="סינון לפי סוג">
          <option value="">כל הסוגים</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex gap-1"><input type="checkbox" checked={filters.templates} onChange={(e) => setFilters((f) => ({ ...f, templates: e.target.checked }))} />תבניות</label>
        <label className="flex gap-1"><input type="checkbox" checked={filters.archived} onChange={(e) => setFilters((f) => ({ ...f, archived: e.target.checked }))} />ארכיון</label>
      </div>
      {documents.isPending && <p className="text-center py-12">טוען…</p>}
      {documents.isError && <p className="text-red-700">{errorMessage(documents.error)}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {(documents.data ?? []).map((document) => (
          <button key={document.id} onClick={() => setParams({ id: document.id })} className="text-right bg-white border rounded-2xl p-4 flex gap-3 hover:border-blue-300">
            {document.visibility === 'restricted' ? <Lock className="text-blue-700 shrink-0" /> : <FileText className="text-blue-700 shrink-0" />}
            <span>
              <strong className="block">{document.title}</strong>
              <span className="text-sm text-gray-500 line-clamp-2">{document.summary}</span>
              <span className="text-xs text-blue-700">{TYPES[document.type]} · גרסה {document.current_revision} · {STATUS[document.status]}</span>
            </span>
          </button>
        ))}
      </div>
      {documents.data?.length === 0 && <p className="text-center text-gray-500 py-12">אין מסמכים להצגה.</p>}
      {editor === 'new' && (
        <Editor
          title="מסמך חדש" isNew pending={action.isPending} templates={templates.data ?? []} people={activePeople}
          onClose={() => setEditor(null)}
          onSave={(body) => run(() => companyApi.createDocument(orgId, body))}
        />
      )}
    </section>
  );
}

function RejectButton({ onReject }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) return <button onClick={() => setOpen(true)} className="text-red-700 font-semibold">דחייה</button>;
  return (
    <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); onReject(reason.trim()); setOpen(false); }}>
      <input className="border rounded-lg px-2 py-1 text-sm" placeholder="סיבה" value={reason} onChange={(e) => setReason(e.target.value)} required />
      <button className="text-red-700 font-semibold">דחייה</button>
    </form>
  );
}
