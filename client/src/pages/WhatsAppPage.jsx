import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../services/chatService';
import api from '@/utils/api';
import { 
  Search, MoreVertical, Plus, X,
  CheckCheck, Loader2, FileText, 
  Paperclip, Send, Image as ImageIcon, UserPlus 
} from 'lucide-react';

// --- רכיבים גרפיים (משולשים לבועות) ---
// ✅ תיקון: ה-paths נוקו ממספרים מדעיים שגרמו לקריסה
const TailIn = () => (
  <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -left-2 top-0 text-white fill-current">
    <path d="M0,5.31842562 C0,2.45222154 2.16912389,0.065403217 5.02324748,0.597341054 L8,1.15217852 L8,13 L0,13 L0,5.31842562 Z"></path>
  </svg>
);

const TailOut = () => (
  <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -right-2 top-0 text-[#d9fdd3] fill-current">
    <path d="M5.188,1.50376765 C5.188,1.50376765 5.188,1.50376765 5.188,1.50376765 5.188,1.50376765 6.95856984,2.2384662 8,3.95856515 8,5.88514194 L8,13 L0,13 L0,0.728954209 L5.188,1.50376765 Z"></path>
  </svg>
);

// === קומפוננטה ראשית ===
export default function WhatsAppPage() {
  const [activeTicket, setActiveTicket] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);

  // שליפת רשימת שיחות מהשרת
  const { data: conversations = [], isLoading: loadingList } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      try {
        const res = await api.get('/chat/conversations');
        return res.data; 
      } catch (err) {
        console.error("Error loading conversations:", err);
        return [];
      }
    },
    refetchInterval: 5000 // רענון מהיר יותר (5 שניות) לקליטת הודעות חדשות
  });

  // סינון רשימה לפי חיפוש
  const filteredConversations = conversations.filter(c => 
      (c.clientName && c.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.from && c.from.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (c.subject && c.subject.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // התחלת צ'אט חדש לוקאלית
  const handleStartNewChat = (contactData) => {
    const newTicket = {
        ticketId: Date.now().toString(),
        from: contactData.email,
        clientName: contactData.name,
        clientPhone: contactData.phone,
        subject: 'שיחה חדשה',
        createdAt: new Date(),
        isNew: true 
    };
    setActiveTicket(newTicket);
    setIsNewContactOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#e9edef] border-t border-gray-300 relative">
      
      {/* === מודל הוספת איש קשר === */}
      {isNewContactOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-md p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">יצירת קשר חדש</h3>
                    <button onClick={() => setIsNewContactOpen(false)} className="text-gray-400 hover:text-gray-600"><X /></button>
                </div>
                <NewContactForm onSubmit={handleStartNewChat} onCancel={() => setIsNewContactOpen(false)} />
            </div>
        </div>
      )}

      {/* === צד ימין: רשימה === */}
      <div className="w-[30%] min-w-[320px] max-w-[450px] bg-white border-l border-r border-gray-200 flex flex-col">
        
        {/* Header רשימה */}
        <div className="h-[60px] bg-[#f0f2f5] flex items-center justify-between px-4 shrink-0">
             <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex items-center justify-center text-white font-bold text-sm">ME</div>
                <span className="font-semibold text-gray-700 hidden md:block">הצ'אטים שלי</span>
             </div>
             <div className="flex gap-3 text-[#54656f]">
                 <button 
                    onClick={() => setIsNewContactOpen(true)}
                    className="p-2 rounded-full hover:bg-gray-200 transition"
                    title="שיחה חדשה"
                 >
                    <Plus size={22} />
                 </button>
                 <button className="p-2 rounded-full hover:bg-gray-200"><MoreVertical size={20} /></button>
             </div>
        </div>

        {/* חיפוש */}
        <div className="p-2 bg-white border-b border-gray-100">
            <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5">
                <Search size={18} className="text-[#54656f] ml-2" />
                <input 
                    type="text" 
                    placeholder="חיפוש או התחלת צ'אט חדש"
                    className="bg-transparent border-none outline-none text-sm w-full h-8 placeholder:text-gray-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* גוף הרשימה */}
        <div className="flex-1 overflow-y-auto bg-white">
            {loadingList ? (
                <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-[#00a884]" /></div>
            ) : filteredConversations.length === 0 ? (
                <div className="text-center mt-10 text-gray-400 p-4">
                    <p>לא נמצאו שיחות.</p>
                    <button onClick={() => setIsNewContactOpen(true)} className="text-[#00a884] mt-2 font-medium hover:underline">צור שיחה חדשה</button>
                </div>
            ) : (
                filteredConversations.map((conv) => (
                    <div 
                        key={conv._id || conv.ticketId}
                        onClick={() => setActiveTicket(conv)}
                        className={`flex items-center p-3 cursor-pointer border-b border-gray-100 hover:bg-[#f5f6f6] transition-colors
                            ${activeTicket?.ticketId === conv.ticketId ? 'bg-[#f0f2f5]' : ''}`}
                    >
                        <div className="w-12 h-12 rounded-full bg-gray-200 mr-3 shrink-0 flex items-center justify-center text-gray-500 font-bold text-lg">
                            {conv.clientName ? conv.clientName[0].toUpperCase() : (conv.from ? conv.from[0].toUpperCase() : '?')}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline">
                                <h3 className="text-[16px] text-[#111b21] truncate font-normal dir-ltr text-left">
                                    {conv.clientName || conv.from}
                                </h3>
                                <span className="text-[11px] text-[#667781]">
                                    {conv.createdAt ? new Date(conv.createdAt).toLocaleDateString() : ''}
                                </span>
                            </div>
                            <p className="text-[13px] text-[#667781] truncate mt-1 text-right" dir="auto">
                                {conv.subject || 'ללא נושא'}
                            </p>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* === צד שמאל: חלון הצ'אט === */}
      <div className="flex-1 bg-[#efeae2] relative flex flex-col">
          {activeTicket ? (
              <ChatWindow ticket={activeTicket} key={activeTicket.ticketId} />
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] border-b-[6px] border-[#25d366] text-center px-4">
                  <div className="bg-white p-6 rounded-full shadow-sm mb-6">
                      <UserPlus size={40} className="text-[#00a884]" />
                  </div>
                  <h1 className="text-3xl font-light text-[#41525d]">מערכת הפניות</h1>
                  <p className="text-[#667781] mt-4 max-w-md">
                      בחר שיחה מהרשימה או לחץ על ה-<b>+</b> כדי להתחיל שיחה עם איש קשר חדש.
                  </p>
              </div>
          )}
      </div>
    </div>
  );
}

// === קומפוננטת טופס יצירת קשר ===
function NewContactForm({ onSubmit, onCancel }) {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.email) return; 
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
                <input 
                    type="text" 
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none"
                    placeholder="ישראל ישראלי"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל (חובה)</label>
                <input 
                    type="email" 
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none"
                    placeholder="client@example.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                <input 
                    type="tel" 
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00a884] outline-none"
                    placeholder="050-0000000"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                />
            </div>
            <div className="flex gap-3 mt-6">
                <button type="button" onClick={onCancel} className="flex-1 p-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">ביטול</button>
                <button type="submit" className="flex-1 p-2 text-white bg-[#00a884] rounded-lg hover:bg-[#008f6f] font-medium">התחל צ'אט</button>
            </div>
        </form>
    );
}

// === קומפוננטת חלון הצ'אט הפנימית ===
function ChatWindow({ ticket }) {
    const queryClient = useQueryClient();
    const [inputText, setInputText] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const messagesEndRef = useRef(null);

    const shouldFetch = !ticket.isNew;

    const { data: messages = [], isLoading } = useQuery({
        queryKey: ['chat', ticket.ticketId],
        queryFn: () => chatService.getMessages(ticket.ticketId),
        refetchInterval: 3000,
        enabled: shouldFetch
    });

    const sendMessageMutation = useMutation({
        mutationFn: chatService.sendMessage,
        onSuccess: () => {
            setInputText('');
            setSelectedFile(null);
            if (ticket.isNew) {
                queryClient.invalidateQueries(['conversations']);
                ticket.isNew = false;
            }
            queryClient.invalidateQueries(['chat', ticket.ticketId]);
        },
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages, ticket]);

    const handleSend = () => {
        if (!inputText.trim() && !selectedFile) return;
        let type = 'text';
        if (selectedFile) {
             if (selectedFile.type.startsWith('image/')) type = 'image';
             else if (selectedFile.type.startsWith('video/')) type = 'video';
             else type = 'file';
        }
        
        sendMessageMutation.mutate({
            ticketId: ticket.ticketId,
            clientEmail: ticket.from,
            clientName: ticket.clientName,
            clientPhone: ticket.clientPhone,
            content: inputText,
            file: selectedFile,
            type
        });
    };

    return (
        <>
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-repeat z-0" 
                 style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')" }}>
            </div>

            {/* Header של הצ'אט */}
            <div className="h-[60px] bg-[#f0f2f5] flex items-center justify-between px-4 py-2 z-10 border-b border-gray-200">
                <div className="flex items-center gap-4 cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
                        {ticket.clientName ? ticket.clientName[0].toUpperCase() : ticket.from[0].toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-[#111b21] font-medium text-lg text-left" dir="auto">
                            {ticket.clientName || ticket.from}
                        </h2>
                        <div className="text-[12px] text-[#667781] flex gap-2">
                             {ticket.clientPhone && <span>{ticket.clientPhone}</span>}
                             <span>•</span>
                             <span>{ticket.from}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 text-[#54656f]">
                     <MoreVertical size={20} />
                </div>
            </div>

            {/* איזור ההודעות */}
            <div className="flex-1 overflow-y-auto p-[5%] pt-4 flex flex-col gap-1 z-10 scrollbar-thin scrollbar-thumb-black/20">
                {ticket.isNew && (
                    <div className="flex justify-center my-4">
                        <div className="bg-[#e7fce3] text-gray-600 text-sm px-4 py-2 rounded-lg shadow-sm text-center">
                            זוהי שיחה חדשה. ההודעה הראשונה תיצור כרטיס ותשלח מייל ללקוח.
                        </div>
                    </div>
                )}
                
                {isLoading && !ticket.isNew ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#00a884]" /></div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.sender === 'me';
                        const time = new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                            <div key={index} className={`flex w-full mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`relative max-w-[65%] min-w-[120px] rounded-lg p-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] text-[14.2px] text-[#111b21] leading-[19px] ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                    {isMe ? <TailOut /> : <TailIn />}
                                    
                                    {msg.type === 'image' && msg.fileUrl && (
                                        <div className="mb-1 rounded-md overflow-hidden bg-[#cfdcb7]"><img src={msg.fileUrl} alt="sent" className="w-full h-auto object-cover max-h-[300px]" /></div>
                                    )}
                                    {msg.type === 'file' && (
                                        <a href={msg.fileUrl} target="_blank" className="flex items-center gap-3 bg-black/5 p-3 rounded-md mb-1 hover:bg-black/10 transition"><div className="bg-red-500 p-2 rounded text-white"><FileText size={20}/></div><span className="truncate text-sm font-medium">קובץ מצורף</span></a>
                                    )}
                                    {msg.content && <div className="whitespace-pre-wrap break-words px-1 pb-2">{msg.content}</div>}
                                    
                                    <div className="absolute bottom-1 left-2 flex items-center gap-1">
                                        <span className="text-[11px] text-[#667781] leading-none mt-1">{time}</span>
                                        {isMe && <span className={`${msg.isRead ? 'text-[#53bdeb]' : 'text-[#667781]'}`}><CheckCheck size={16} strokeWidth={2} /></span>}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-[#f0f2f5] min-h-[62px] flex items-center px-4 gap-2 z-10">
                <button className="text-[#54656f] p-1 relative hover:bg-black/5 rounded-full">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} />
                    <Paperclip size={24} />
                </button>
                
                <div className="flex-1 bg-white rounded-lg flex items-center px-4 py-2 my-2 shadow-sm">
                    {selectedFile && (
                        <div className="flex items-center bg-gray-100 px-2 py-1 rounded mr-2 text-xs">
                            <span className="truncate max-w-[100px]">{selectedFile.name}</span>
                            <button onClick={() => setSelectedFile(null)} className="text-red-500 ml-2 font-bold">X</button>
                        </div>
                    )}
                    <input 
                        type="text" 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="הקלד/י הודעה"
                        className="w-full bg-transparent border-none outline-none text-[15px] placeholder:text-[#8696a0]"
                    />
                </div>
                
                <button onClick={handleSend} disabled={sendMessageMutation.isPending} className="text-[#54656f] p-2 hover:bg-black/5 rounded-full">
                    {inputText || selectedFile ? <Send size={24} className="text-[#00a884]" /> : <span className="text-2xl">🎤</span>}
                </button>
            </div>
        </>
    );
}