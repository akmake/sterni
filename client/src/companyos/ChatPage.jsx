import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRight, Hash, Lock, Pencil, Send, Trash2 } from 'lucide-react';
import { companyApi, errorMessage } from './companyApi';

const newClientId = () =>
  window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function ConversationIcon({ conversation }) {
  if (conversation.type === 'dm') return null;
  const Icon = conversation.visibility === 'private' ? Lock : Hash;
  return <Icon size={14} className="text-gray-400 shrink-0" aria-hidden="true" />;
}

function NewConversation({ orgId, canListPeople }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const people = useQuery({
    queryKey: ['company', orgId, 'members'],
    queryFn: () => companyApi.members(orgId),
    enabled: canListPeople,
  });

  const open = (conversation) => {
    queryClient.invalidateQueries({ queryKey: ['company', orgId, 'conversations'] });
    navigate(`/company/chat/${conversation.id}`);
  };
  const onError = (error) => toast.error(errorMessage(error));

  const createChannel = useMutation({
    mutationFn: () => companyApi.createChannel(orgId, { name, visibility: isPrivate ? 'private' : 'public' }),
    onSuccess: (conversation) => {
      setName('');
      open(conversation);
    },
    onError,
  });
  const openDirect = useMutation({
    mutationFn: (userId) => companyApi.openDirectMessage(orgId, userId),
    onSuccess: open,
    onError,
  });

  const colleagues = (people.data?.data ?? []).filter((person) => person.status === 'active' && !person.is_self);

  return (
    <div className="p-3 space-y-2 border-b">
      <form
        className="flex gap-2 items-center"
        onSubmit={(event) => {
          event.preventDefault();
          createChannel.mutate();
        }}
      >
        <input
          className="flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm"
          placeholder="ערוץ חדש"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <label className="text-xs flex items-center gap-1 shrink-0">
          <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
          פרטי
        </label>
        <button disabled={createChannel.isPending} className="text-sm text-blue-700 font-semibold shrink-0">יצירה</button>
      </form>
      {colleagues.length > 0 && (
        <select
          className="w-full border rounded-lg px-2 py-1 text-sm"
          value=""
          aria-label="שיחה אישית"
          onChange={(event) => event.target.value && openDirect.mutate(event.target.value)}
        >
          <option value="">שיחה אישית עם…</option>
          {colleagues.map((person) => <option key={person.user_id} value={person.user_id}>{person.name}</option>)}
        </select>
      )}
    </div>
  );
}

function ConversationList({ orgId, conversations, selectedId, canListPeople }) {
  return (
    <div className="h-full overflow-y-auto">
      <NewConversation orgId={orgId} canListPeople={canListPeople} />
      {conversations.length === 0 && <p className="p-3 text-sm text-gray-500">אין שיחות עדיין</p>}
      <ul className="divide-y">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <Link
              to={`/company/chat/${conversation.id}`}
              className={`flex items-center gap-2 p-3 ${selectedId === String(conversation.id) ? 'bg-blue-50' : ''}`}
            >
              <ConversationIcon conversation={conversation} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{conversation.name}</span>
                {conversation.last_message && (
                  <span className="block text-xs text-gray-500 truncate">
                    {conversation.last_message.author_name}: {conversation.last_message.body}
                  </span>
                )}
              </span>
              {conversation.unread_count > 0 && (
                <span className="bg-blue-700 text-white text-xs rounded-full px-2 py-0.5">{conversation.unread_count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageBubble({ message, isOwn, onEdit, onDelete }) {
  if (message.deleted) {
    return <p className="text-xs text-gray-400 italic text-center">הודעה נמחקה</p>;
  }
  return (
    <div className={`group flex ${isOwn ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isOwn ? 'bg-blue-700 text-white' : 'bg-white shadow-sm'}`}>
        {!isOwn && <p className="text-xs font-bold text-blue-700">{message.author_name}</p>}
        <p className="text-sm whitespace-pre-wrap break-words" dir="auto">{message.body}</p>
        <p className={`text-[10px] mt-1 flex items-center gap-2 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
          {new Date(message.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          {message.edited_at && ' · נערכה'}
          {isOwn && (
            <>
              <button onClick={() => onEdit(message)} aria-label="עריכת הודעה"><Pencil size={11} /></button>
              <button onClick={() => onDelete(message)} aria-label="מחיקת הודעה"><Trash2 size={11} /></button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Thread({ orgId, conversation, currentUserId }) {
  const queryClient = useQueryClient();
  const conversationId = conversation.id;
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const bottomRef = useRef(null);
  const lastMarked = useRef(0);
  const clientId = useRef(newClientId());

  const key = ['company', orgId, 'conversation', conversationId, 'messages'];
  const messages = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => companyApi.messages(orgId, conversationId, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
  });

  const items = messages.data ? [...messages.data.pages].reverse().flatMap((page) => page.data) : [];
  const newestSeq = items[items.length - 1]?.seq ?? 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    if (newestSeq > lastMarked.current) {
      lastMarked.current = newestSeq;
      companyApi.markRead(orgId, conversationId, newestSeq).catch(() => {
        lastMarked.current = 0;
      });
    }
  }, [newestSeq, orgId, conversationId]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const onError = (error) => toast.error(errorMessage(error));

  const send = useMutation({
    mutationFn: () =>
      editing
        ? companyApi.editMessage(orgId, conversationId, editing.id, draft)
        : companyApi.sendMessage(orgId, conversationId, draft, clientId.current),
    onSuccess: () => {
      setDraft('');
      setEditing(null);
      // Rotated only after success: a retry of a failed send keeps the same ID.
      clientId.current = newClientId();
      refresh();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (message) => companyApi.deleteMessage(orgId, conversationId, message.id),
    onSuccess: refresh,
    onError,
  });

  const canSend = draft.trim().length > 0 && !send.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-white flex items-center gap-2">
        <Link to="/company/chat" className="sm:hidden" aria-label="חזרה לשיחות"><ArrowRight size={18} /></Link>
        <ConversationIcon conversation={conversation} />
        <span className="font-bold truncate">{conversation.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-100">
        {messages.isPending && <p className="text-sm text-gray-500">טוען…</p>}
        {messages.isError && <p className="text-sm text-red-600">{errorMessage(messages.error)}</p>}
        {messages.hasNextPage && (
          <button onClick={() => messages.fetchNextPage()} className="block mx-auto text-xs text-blue-700 underline">
            הודעות קודמות
          </button>
        )}
        {messages.isSuccess && items.length === 0 && (
          <p className="text-sm text-gray-500 text-center">עדיין אין הודעות. אפשר לפתוח את השיחה</p>
        )}
        {items.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={String(message.author_id) === String(currentUserId)}
            onEdit={(target) => {
              setEditing(target);
              setDraft(target.body);
            }}
            onDelete={(target) => {
              if (window.confirm('למחוק את ההודעה?')) remove.mutate(target);
            }}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="p-2 border-t bg-white flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) send.mutate();
        }}
      >
        <textarea
          className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none"
          rows={1}
          dir="auto"
          placeholder={editing ? 'עריכת הודעה' : 'כתיבת הודעה'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (canSend) send.mutate();
            }
            if (event.key === 'Escape' && editing) {
              setEditing(null);
              setDraft('');
            }
          }}
        />
        <button disabled={!canSend} aria-label="שליחה" className="bg-blue-700 text-white rounded-full p-2 disabled:opacity-40">
          <Send size={18} className="-scale-x-100" />
        </button>
      </form>
    </div>
  );
}

export default function ChatPage({ membership, currentUserId }) {
  const orgId = membership.organization.id;
  const { conversationId } = useParams();

  const conversations = useQuery({
    queryKey: ['company', orgId, 'conversations'],
    queryFn: () => companyApi.conversations(orgId),
  });

  if (conversations.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (conversations.isError) return <p className="text-sm text-red-600">{errorMessage(conversations.error)}</p>;

  const selected = conversations.data.find((item) => String(item.id) === conversationId);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex h-[calc(100dvh-10.5rem)] sm:h-[calc(100dvh-8.5rem)]">
      <div className={`w-full sm:w-72 sm:border-l shrink-0 ${conversationId ? 'hidden sm:block' : ''}`}>
        <ConversationList
          orgId={orgId}
          conversations={conversations.data}
          selectedId={conversationId}
          canListPeople={membership.permissions.view_members}
        />
      </div>
      <div className={`flex-1 min-w-0 ${conversationId ? '' : 'hidden sm:block'}`}>
        {selected && <Thread key={selected.id} orgId={orgId} conversation={selected} currentUserId={currentUserId} />}
        {!selected && conversationId && <p className="p-4 text-sm text-gray-500">השיחה לא נמצאה, או שאין לך גישה אליה</p>}
        {!conversationId && <p className="p-4 text-sm text-gray-500">בחרו שיחה</p>}
      </div>
    </div>
  );
}
