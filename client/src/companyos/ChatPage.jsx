import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowRight, Bell, BellOff, Bookmark, CheckSquare, EyeOff, Folder, Hash, Lock, MessageSquare,
  MoreHorizontal, Paperclip, Pencil, Pin, Search, Send, Trash2, Users, X,
} from 'lucide-react';
import { companyApi, errorMessage } from './companyApi';
import { PageHeader } from './CompanyUi';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '✅', '🙏'];
const ICONS = { group: Users, project: Folder };

const newClientId = () =>
  window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const notifyError = (error) => toast.error(errorMessage(error));

function ConversationIcon({ conversation }) {
  if (conversation.type === 'dm') return null;
  const Icon = ICONS[conversation.type] ?? (conversation.visibility === 'private' ? Lock : Hash);
  return <Icon size={14} className="text-gray-400 shrink-0" aria-hidden="true" />;
}

function NewConversation({ orgId, people }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [groupIds, setGroupIds] = useState([]);
  const [showGroup, setShowGroup] = useState(false);

  const open = (conversation) => {
    queryClient.invalidateQueries({ queryKey: ['company', orgId, 'conversations'] });
    navigate(`/company/chat/${conversation.id}`);
  };

  const createChannel = useMutation({
    mutationFn: () => companyApi.createChannel(orgId, { name, visibility: isPrivate ? 'private' : 'public' }),
    onSuccess: (conversation) => {
      setName('');
      open(conversation);
    },
    onError: notifyError,
  });
  const openDirect = useMutation({
    mutationFn: (userId) => companyApi.openDirectMessage(orgId, userId),
    onSuccess: open,
    onError: notifyError,
  });
  const createGroup = useMutation({
    mutationFn: () => companyApi.createGroup(orgId, groupIds),
    onSuccess: (conversation) => {
      setGroupIds([]);
      setShowGroup(false);
      open(conversation);
    },
    onError: notifyError,
  });

  const colleagues = people.filter((person) => !person.is_self);
  const toggle = (id) => setGroupIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

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
      {colleagues.length > 1 && (
        <button onClick={() => setShowGroup((value) => !value)} className="text-xs text-blue-700 underline">
          שיחה קבוצתית
        </button>
      )}
      {showGroup && (
        <div className="space-y-1">
          {colleagues.map((person) => (
            <label key={person.user_id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={groupIds.includes(String(person.user_id))}
                onChange={() => toggle(String(person.user_id))}
              />
              {person.name}
            </label>
          ))}
          <button
            disabled={groupIds.length < 2 || createGroup.isPending}
            onClick={() => createGroup.mutate()}
            className="text-sm text-blue-700 font-semibold disabled:opacity-40"
          >
            פתיחת קבוצה
          </button>
        </div>
      )}
    </div>
  );
}

function SearchResults({ orgId, query }) {
  const results = useQuery({
    queryKey: ['company', orgId, 'conversations', 'search', query],
    queryFn: () => companyApi.searchMessages(orgId, query),
    enabled: query.length >= 2,
  });
  if (query.length < 2) return <p className="p-3 text-xs text-gray-500">יש להקליד לפחות שני תווים</p>;
  if (results.isPending) return <p className="p-3 text-sm text-gray-500">מחפש…</p>;
  if (results.isError) return <p className="p-3 text-sm text-red-600">{errorMessage(results.error)}</p>;
  if (results.data.length === 0) return <p className="p-3 text-sm text-gray-500">לא נמצאו הודעות</p>;
  return (
    <ul className="divide-y">
      {results.data.map((message) => (
        <li key={message.id}>
          <Link to={`/company/chat/${message.conversation_id}`} className="block p-3">
            <span className="block text-xs text-gray-500">{message.conversation_name} · {message.author_name}</span>
            <span className="block text-sm truncate">{message.body}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SavedMessages({ orgId }) {
  const saved = useQuery({ queryKey: ['company', orgId, 'conversations', 'saved'], queryFn: () => companyApi.savedMessages(orgId) });
  if (saved.isPending) return <p className="p-3 text-sm text-gray-500">טוען…</p>;
  if (saved.isError) return <p className="p-3 text-sm text-red-600">{errorMessage(saved.error)}</p>;
  if (saved.data.length === 0) return <p className="p-3 text-sm text-gray-500">אין הודעות שמורות</p>;
  return (
    <ul className="divide-y">
      {saved.data.map(({ message, remind_at: remindAt }) => (
        <li key={message.id}>
          <Link to={`/company/chat/${message.conversation_id}`} className="block p-3">
            <span className="block text-xs text-gray-500">{message.author_name}</span>
            <span className="block text-sm truncate">{message.body}</span>
            {remindAt && <span className="block text-xs text-blue-700">תזכורת: {new Date(remindAt).toLocaleString('he-IL')}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ConversationList({ orgId, conversations, selectedId, people }) {
  const [query, setQuery] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const searching = query.trim().length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 border-b flex items-center gap-2">
        <Search size={14} className="text-gray-400" aria-hidden="true" />
        <input
          className="flex-1 min-w-0 text-sm outline-none"
          placeholder="חיפוש בהודעות"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button onClick={() => setShowSaved((value) => !value)} aria-label="הודעות שמורות" className={showSaved ? 'text-blue-700' : 'text-gray-400'}>
          <Bookmark size={16} />
        </button>
      </div>
      {searching && <SearchResults orgId={orgId} query={query.trim()} />}
      {!searching && showSaved && <SavedMessages orgId={orgId} />}
      {!searching && !showSaved && (
        <>
          <NewConversation orgId={orgId} people={people} />
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
                  {conversation.muted && <BellOff size={12} className="text-gray-400" aria-label="מושתק" />}
                  {conversation.unread_count > 0 && (
                    <span className={`text-white text-xs rounded-full px-2 py-0.5 ${conversation.muted ? 'bg-gray-400' : 'bg-blue-700'}`}>
                      {conversation.unread_count}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Attachments({ orgId, attachments, onDark }) {
  return attachments.map((file) => {
    const url = companyApi.fileUrl(orgId, file.id);
    if (file.mime.startsWith('image/')) {
      return (
        <a key={file.id} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={file.name} className="rounded-lg max-h-48 mt-1" />
        </a>
      );
    }
    return (
      <a key={file.id} href={url} className={`block text-sm underline mt-1 truncate ${onDark ? 'text-white' : 'text-blue-700'}`}>
        📎 {file.name}
      </a>
    );
  });
}

function TaskFromMessage({ orgId, message, onClose }) {
  const [projectId, setProjectId] = useState('');
  const projects = useQuery({ queryKey: ['company', orgId, 'projects'], queryFn: () => companyApi.projects(orgId) });
  const create = useMutation({
    mutationFn: () => companyApi.taskFromMessage(orgId, message.conversation_id, message.id, projectId),
    onSuccess: () => {
      toast.success('המשימה נוצרה');
      onClose();
    },
    onError: notifyError,
  });
  const writable = (projects.data?.data ?? []).filter((project) => project.permissions.write);

  return (
    <div className="flex gap-1 items-center mt-1 text-gray-900">
      <select className="border rounded px-1 py-0.5 text-xs" value={projectId} aria-label="פרויקט" onChange={(e) => setProjectId(e.target.value)}>
        <option value="">בחירת פרויקט…</option>
        {writable.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <button disabled={!projectId || create.isPending} onClick={() => create.mutate()} className="text-xs underline disabled:opacity-40">יצירה</button>
      <button onClick={onClose} aria-label="ביטול"><X size={12} /></button>
    </div>
  );
}

function MessageBubble({ orgId, message, currentUserId, onEdit, onOpenThread, inThread, refresh }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [makingTask, setMakingTask] = useState(false);
  const conversationId = message.conversation_id;
  const isOwn = String(message.author_id) === String(currentUserId);

  const act = useMutation({
    mutationFn: (fn) => fn(),
    onSuccess: () => {
      setMenuOpen(false);
      refresh();
    },
    onError: notifyError,
  });

  if (message.deleted) {
    return <p className="text-xs text-gray-400 italic text-center">הודעה נמחקה</p>;
  }

  const remindLater = () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    act.mutate(() => companyApi.saveMessage(orgId, conversationId, message.id, tomorrow));
    toast.success('נשמר, ותגיע תזכורת מחר');
  };

  return (
    <div className={`flex ${isOwn ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${isOwn ? 'bg-blue-700 text-white' : 'bg-white shadow-sm'}`}>
        {!isOwn && <p className="text-xs font-bold text-blue-700">{message.author_name}</p>}
        {message.body && <p className="text-sm whitespace-pre-wrap break-words" dir="auto">{message.body}</p>}
        <Attachments orgId={orgId} attachments={message.attachments} onDark={isOwn} />

        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => act.mutate(() => companyApi.toggleReaction(orgId, conversationId, message.id, reaction.emoji))}
                className={`text-xs rounded-full px-1.5 ${reaction.user_ids.includes(String(currentUserId)) ? 'bg-blue-200 text-blue-900' : 'bg-gray-200 text-gray-800'}`}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        )}

        <div className={`text-[10px] mt-1 flex items-center gap-2 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
          {new Date(message.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          {message.edited_at && <span>נערכה</span>}
          {message.pinned && <Pin size={10} aria-label="מוצמדת" />}
          {!inThread && message.reply_count > 0 && (
            <button onClick={() => onOpenThread(message)} className="underline">{message.reply_count} תגובות</button>
          )}
          <button onClick={() => setMenuOpen((value) => !value)} aria-label="פעולות על ההודעה"><MoreHorizontal size={13} /></button>
        </div>

        {menuOpen && (
          <div className="flex flex-wrap items-center gap-2 mt-1 pt-1 border-t border-current/20">
            {QUICK_REACTIONS.map((emoji) => (
              <button key={emoji} aria-label={`תגובה ${emoji}`} onClick={() => act.mutate(() => companyApi.toggleReaction(orgId, conversationId, message.id, emoji))}>{emoji}</button>
            ))}
            {!inThread && <button aria-label="שרשור" onClick={() => onOpenThread(message)}><MessageSquare size={13} /></button>}
            <button aria-label="הצמדה" onClick={() => act.mutate(() => companyApi.togglePin(orgId, conversationId, message.id))}><Pin size={13} /></button>
            <button aria-label="שמירה עם תזכורת למחר" onClick={remindLater}><Bookmark size={13} /></button>
            <button aria-label="יצירת משימה" onClick={() => setMakingTask(true)}><CheckSquare size={13} /></button>
            <button aria-label="סימון כלא נקרא" onClick={() => act.mutate(() => companyApi.markUnread(orgId, conversationId, message.seq))}><EyeOff size={13} /></button>
            {isOwn && <button aria-label="עריכת הודעה" onClick={() => onEdit(message)}><Pencil size={13} /></button>}
            {isOwn && (
              <button
                aria-label="מחיקת הודעה"
                onClick={() => {
                  if (window.confirm('למחוק את ההודעה?')) act.mutate(() => companyApi.deleteMessage(orgId, conversationId, message.id));
                }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
        {makingTask && <TaskFromMessage orgId={orgId} message={message} onClose={() => setMakingTask(false)} />}
      </div>
    </div>
  );
}

function Composer({ orgId, conversationId, parentId, people, editing, onCancelEdit, onDone }) {
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState([]);
  const [mentioned, setMentioned] = useState([]);
  const clientId = useRef(newClientId());
  const fileInput = useRef(null);

  useEffect(() => {
    if (editing) setDraft(editing.body);
  }, [editing]);

  const upload = useMutation({
    mutationFn: (file) => companyApi.uploadFile(orgId, conversationId, file),
    onSuccess: (file) => setFiles((current) => [...current, file]),
    onError: notifyError,
  });

  const send = useMutation({
    mutationFn: () => {
      if (editing) return companyApi.editMessage(orgId, conversationId, editing.id, draft);
      const mentionIds = mentioned.filter((person) => draft.includes(`@${person.name}`)).map((person) => person.user_id);
      return companyApi.sendMessage(orgId, conversationId, {
        body: draft,
        client_id: clientId.current,
        parent_id: parentId,
        mention_user_ids: mentionIds,
        attachment_ids: files.map((file) => file.id),
      });
    },
    onSuccess: () => {
      setDraft('');
      setFiles([]);
      setMentioned([]);
      // Rotated only after success: a retry of a failed send keeps the same ID.
      clientId.current = newClientId();
      onDone();
    },
    onError: notifyError,
  });

  const canSend = (draft.trim().length > 0 || files.length > 0) && !send.isPending && !upload.isPending;
  const mentionQuery = draft.match(/(?:^|\s)@([^\s@]*)$/)?.[1];
  const suggestions = mentionQuery === undefined
    ? []
    : people.filter((person) => !person.is_self && person.name.includes(mentionQuery)).slice(0, 5);

  const insertMention = (person) => {
    setDraft((text) => text.replace(/@([^\s@]*)$/, `@${person.name} `));
    setMentioned((current) => [...current, person]);
  };

  return (
    <div className="border-t bg-white">
      {suggestions.length > 0 && (
        <ul className="border-b max-h-32 overflow-y-auto">
          {suggestions.map((person) => (
            <li key={person.user_id}>
              <button type="button" className="w-full text-right p-2 text-sm hover:bg-gray-100" onClick={() => insertMention(person)}>{person.name}</button>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <div className="p-2 flex flex-wrap gap-2 text-xs">
          {files.map((file) => (
            <span key={file.id} className="bg-gray-100 rounded px-2 py-1 flex items-center gap-1">
              {file.name}
              <button aria-label="הסרת קובץ" onClick={() => setFiles((current) => current.filter((f) => f.id !== file.id))}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <form
        className="p-2 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) send.mutate();
        }}
      >
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          aria-label="צירוף קובץ"
          onChange={(event) => {
            if (event.target.files[0]) upload.mutate(event.target.files[0]);
            event.target.value = '';
          }}
        />
        {!editing && (
          <button type="button" aria-label="צירוף קובץ" onClick={() => fileInput.current.click()} className="p-2 text-gray-500">
            <Paperclip size={18} />
          </button>
        )}
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
              onCancelEdit();
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

function ThreadPanel({ orgId, conversationId, root, currentUserId, people, onClose }) {
  const queryClient = useQueryClient();
  const key = ['company', orgId, 'conversation', conversationId, 'thread', root.id];
  const thread = useQuery({ queryKey: key, queryFn: () => companyApi.replies(orgId, conversationId, root.id) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['company', orgId, 'conversation', conversationId] });

  return (
    <div className="absolute inset-0 z-10 bg-gray-100 flex flex-col">
      <div className="p-3 border-b bg-white flex items-center justify-between">
        <span className="font-bold">שרשור</span>
        <button onClick={onClose} aria-label="סגירת השרשור"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {thread.isPending && <p className="text-sm text-gray-500">טוען…</p>}
        {thread.isError && <p className="text-sm text-red-600">{errorMessage(thread.error)}</p>}
        {thread.data && (
          <>
            <MessageBubble orgId={orgId} message={thread.data.parent} currentUserId={currentUserId} inThread refresh={refresh} onEdit={() => {}} onOpenThread={() => {}} />
            <hr />
            {thread.data.replies.map((message) => (
              <MessageBubble key={message.id} orgId={orgId} message={message} currentUserId={currentUserId} inThread refresh={refresh} onEdit={() => {}} onOpenThread={() => {}} />
            ))}
          </>
        )}
      </div>
      <Composer orgId={orgId} conversationId={conversationId} parentId={root.id} people={people} onDone={refresh} />
    </div>
  );
}

function PinsBar({ orgId, conversationId }) {
  const pins = useQuery({
    queryKey: ['company', orgId, 'conversation', conversationId, 'pins'],
    queryFn: () => companyApi.pins(orgId, conversationId),
  });
  if (!pins.data?.length) return null;
  return (
    <div className="bg-amber-50 border-b px-3 py-1 text-xs flex items-center gap-2">
      <Pin size={12} aria-hidden="true" />
      <span className="truncate">{pins.data[0].body || pins.data[0].attachments[0]?.name}</span>
      {pins.data.length > 1 && <span className="text-gray-500 shrink-0">+{pins.data.length - 1}</span>}
    </div>
  );
}

function Thread({ orgId, conversation, currentUserId, people }) {
  const queryClient = useQueryClient();
  const conversationId = conversation.id;
  const [editing, setEditing] = useState(null);
  const [threadRoot, setThreadRoot] = useState(null);
  const bottomRef = useRef(null);
  const lastMarked = useRef(0);

  const key = ['company', orgId, 'conversation', conversationId, 'messages'];
  const messages = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => companyApi.messages(orgId, conversationId, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
  });

  const items = messages.data ? [...messages.data.pages].reverse().flatMap((page) => page.data) : [];
  const newestSeq = Math.max(conversation.last_seq, items[items.length - 1]?.seq ?? 0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [items.length]);

  useEffect(() => {
    if (newestSeq > lastMarked.current) {
      lastMarked.current = newestSeq;
      companyApi.markRead(orgId, conversationId, newestSeq).catch(() => {
        lastMarked.current = 0;
      });
    }
  }, [newestSeq, orgId, conversationId]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['company', orgId, 'conversation', conversationId] });

  const mute = useMutation({
    mutationFn: () => companyApi.setMuted(orgId, conversationId, !conversation.muted),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', orgId, 'conversations'] }),
    onError: notifyError,
  });

  const MuteIcon = conversation.muted ? BellOff : Bell;

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-3 border-b bg-white flex items-center gap-2">
        <Link to="/company/chat" className="sm:hidden" aria-label="חזרה לשיחות"><ArrowRight size={18} /></Link>
        <ConversationIcon conversation={conversation} />
        <span className="font-bold truncate flex-1">{conversation.name}</span>
        <button onClick={() => mute.mutate()} aria-label={conversation.muted ? 'ביטול השתקה' : 'השתקה'} className="text-gray-500">
          <MuteIcon size={16} />
        </button>
      </div>
      <PinsBar orgId={orgId} conversationId={conversationId} />

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-100">
        {messages.isPending && <p className="text-sm text-gray-500">טוען…</p>}
        {messages.isError && <p className="text-sm text-red-600">{errorMessage(messages.error)}</p>}
        {messages.hasNextPage && (
          <button onClick={() => messages.fetchNextPage()} className="block mx-auto text-xs text-blue-700 underline">הודעות קודמות</button>
        )}
        {messages.isSuccess && items.length === 0 && (
          <p className="text-sm text-gray-500 text-center">עדיין אין הודעות. אפשר לפתוח את השיחה</p>
        )}
        {items.map((message) => (
          <MessageBubble
            key={message.id}
            orgId={orgId}
            message={message}
            currentUserId={currentUserId}
            refresh={refresh}
            onEdit={setEditing}
            onOpenThread={setThreadRoot}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer
        orgId={orgId}
        conversationId={conversationId}
        people={people}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          refresh();
        }}
      />

      {threadRoot && (
        <ThreadPanel
          orgId={orgId}
          conversationId={conversationId}
          root={threadRoot}
          currentUserId={currentUserId}
          people={people}
          onClose={() => setThreadRoot(null)}
        />
      )}
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
  const members = useQuery({
    queryKey: ['company', orgId, 'members'],
    queryFn: () => companyApi.members(orgId),
    enabled: membership.permissions.view_members,
  });

  if (conversations.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (conversations.isError) return <p className="text-sm text-red-600">{errorMessage(conversations.error)}</p>;

  const selected = conversations.data.find((item) => String(item.id) === conversationId);
  const people = (members.data?.data ?? []).filter((person) => person.status === 'active');

  return (
    <section className="space-y-3">
      <PageHeader title="שיחות" subtitle="ערוצים, שיחות אישיות ועדכוני פרויקטים." />
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden flex h-[calc(100dvh-16rem)] sm:h-[calc(100dvh-14rem)]">
      <div className={`w-full sm:w-72 sm:border-l shrink-0 ${conversationId ? 'hidden sm:block' : ''}`}>
        <ConversationList orgId={orgId} conversations={conversations.data} selectedId={conversationId} people={people} />
      </div>
      <div className={`flex-1 min-w-0 ${conversationId ? '' : 'hidden sm:block'}`}>
        {selected && <Thread key={selected.id} orgId={orgId} conversation={selected} currentUserId={currentUserId} people={people} />}
        {!selected && conversationId && <p className="p-4 text-sm text-gray-500">השיחה לא נמצאה, או שאין לך גישה אליה</p>}
        {!conversationId && <p className="p-4 text-sm text-gray-500">בחרו שיחה</p>}
      </div>
      </div>
    </section>
  );
}
