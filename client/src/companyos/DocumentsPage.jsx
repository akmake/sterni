import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, FileText, History, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { companyApi, errorMessage } from './companyApi';

const STATUS = {
  draft: 'טיוטה', in_review: 'באישור', approved: 'מאושר',
  published: 'פורסם', rejected: 'נדחה', superseded: 'גרסה קודמת',
};

function Editor({ title, initial = {}, onClose, onSave, pending }) {
  const [name, setName] = useState(initial.title || '');
  const [content, setContent] = useState(initial.content || '');
  return (
    <div className="fixed inset-0 z-30 bg-black/40 p-4 flex items-center justify-center" role="dialog" aria-modal="true">
      <form
        onSubmit={(event) => { event.preventDefault(); onSave({ title: name.trim(), content: content.trim(), summary: content.trim() }); }}
        className="bg-white rounded-2xl p-5 w-full max-w-2xl space-y-3 shadow-xl"
      >
        <h2 className="text-xl font-bold">{title}</h2>
        <input className="w-full border rounded-xl px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="כותרת" required />
        <textarea className="w-full border rounded-xl px-3 py-2 min-h-52" value={content} onChange={(event) => setContent(event.target.value)} placeholder="תוכן המסמך" />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="border rounded-xl px-4 py-2">ביטול</button>
          <button disabled={pending} className="bg-blue-700 text-white rounded-xl px-4 py-2 disabled:opacity-50">שמירה</button>
        </div>
      </form>
    </div>
  );
}

export default function DocumentsPage({ membership }) {
  const orgId = membership.organization.id;
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('id');
  const [editor, setEditor] = useState(null);
  const documents = useQuery({
    queryKey: ['company', orgId, 'documents'],
    queryFn: () => companyApi.documents(orgId),
  });
  const detail = useQuery({
    queryKey: ['company', orgId, 'document', selectedId],
    queryFn: () => companyApi.document(orgId, selectedId),
    enabled: Boolean(selectedId),
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['company', orgId, 'documents'] });
    if (selectedId) client.invalidateQueries({ queryKey: ['company', orgId, 'document', selectedId] });
  };
  const action = useMutation({
    mutationFn: (task) => task(),
    onSuccess: () => { refresh(); setEditor(null); },
    onError: (error) => toast.error(errorMessage(error)),
  });

  useEffect(() => {
    if (selectedId && documents.data && !documents.data.some((item) => item.id === selectedId)) {
      setParams({});
    }
  }, [documents.data, selectedId, setParams]);

  if (detail.isPending && selectedId) return <p className="text-center py-12">טוען מסמך…</p>;
  if (selectedId && detail.data) {
    const item = detail.data;
    return (
      <section className="space-y-4">
        <button onClick={() => setParams({})} className="text-blue-700 font-semibold">חזרה למסמכים</button>
        <div>
          <h1 className="text-2xl font-bold">{item.document.title}</h1>
          <p className="text-sm text-blue-700">גרסה {item.current_revision.revision_no} · {STATUS[item.document.status]}</p>
        </div>
        <article className="bg-white border rounded-2xl p-5 whitespace-pre-wrap min-h-40">{item.current_revision.content || 'המסמך עדיין ריק'}</article>
        <div className="flex flex-wrap gap-2">
          {item.document.permissions.edit && (
            <button onClick={() => setEditor('revision')} className="border border-blue-700 text-blue-700 rounded-xl px-4 py-2">גרסה חדשה</button>
          )}
          {item.document.status === 'draft' && (
            <button onClick={() => action.mutate(() => companyApi.submitDocument(orgId, selectedId))} className="bg-blue-700 text-white rounded-xl px-4 py-2">שליחה לאישור</button>
          )}
          {item.document.permissions.publish && item.document.status === 'approved' && (
            <button onClick={() => action.mutate(() => companyApi.publishDocument(orgId, selectedId))} className="bg-emerald-700 text-white rounded-xl px-4 py-2">פרסום</button>
          )}
        </div>
        {item.approvals.length > 0 && (
          <div className="bg-white border rounded-2xl p-4 space-y-2">
            <h2 className="font-bold flex gap-2"><ShieldCheck size={20} />שרשרת אישור</h2>
            {item.approvals.map((approval) => (
              <div key={approval.id} className="flex items-center gap-2 border-t pt-2">
                <span className="flex-1">{approval.assignee_name || 'מאשר'} · {STATUS[approval.status] || approval.status}</span>
                {approval.can_decide && approval.status === 'pending' && (
                  <>
                    <button onClick={() => action.mutate(() => companyApi.decideApproval(orgId, approval.id, 'approved', ''))} className="text-emerald-700 font-semibold">אישור</button>
                    <button onClick={() => {
                      const reason = window.prompt('סיבת דחייה');
                      if (reason) action.mutate(() => companyApi.decideApproval(orgId, approval.id, 'rejected', reason));
                    }} className="text-red-700 font-semibold">דחייה</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="bg-white border rounded-2xl p-4 space-y-2">
          <h2 className="font-bold flex gap-2"><History size={20} />היסטוריית גרסאות</h2>
          {item.revisions.map((revision) => (
            <p key={revision.id} className="border-t pt-2">גרסה {revision.revision_no}: {revision.title} · {STATUS[revision.status]}</p>
          ))}
        </div>
        {editor === 'revision' && (
          <Editor
            title="גרסה חדשה" initial={item.current_revision} pending={action.isPending}
            onClose={() => setEditor(null)}
            onSave={(body) => action.mutate(() => companyApi.createDocumentRevision(orgId, selectedId, body))}
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
          <p className="text-sm text-gray-500">מסמכים, גרסאות ואישורים במקום אחד.</p>
        </div>
        {membership.permissions.create_documents && (
          <button onClick={() => setEditor('new')} className="bg-blue-700 text-white rounded-xl px-4 py-2 flex gap-2"><FilePlus2 size={18} />מסמך חדש</button>
        )}
      </div>
      {documents.isPending && <p className="text-center py-12">טוען…</p>}
      {documents.isError && <p className="text-red-700">{errorMessage(documents.error)}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {(documents.data || []).map((document) => (
          <button key={document.id} onClick={() => setParams({ id: document.id })} className="text-right bg-white border rounded-2xl p-4 flex gap-3 hover:border-blue-300">
            <FileText className="text-blue-700 shrink-0" />
            <span>
              <strong className="block">{document.title}</strong>
              <span className="text-sm text-gray-500 line-clamp-2">{document.summary}</span>
              <span className="text-xs text-blue-700">גרסה {document.current_revision} · {STATUS[document.status]}</span>
            </span>
          </button>
        ))}
      </div>
      {documents.data?.length === 0 && <p className="text-center text-gray-500 py-12">עדיין אין מסמכים.</p>}
      {editor === 'new' && (
        <Editor
          title="מסמך חדש" pending={action.isPending} onClose={() => setEditor(null)}
          onSave={(body) => action.mutate(() => companyApi.createDocument(orgId, body))}
        />
      )}
    </section>
  );
}
