import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../services/chatService';
import { 
  Send, Paperclip, MoreVertical, Phone, Video, 
  ArrowLeft, CheckCheck, Loader2, FileText, Image as ImageIcon 
} from 'lucide-react';

// הנתיב שכבר וידאנו שהוא נכון:
import { Button } from "../components/ui/button"; 

// --- אייקונים של וואטסאפ ---
const TailIn = () => (
  <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -left-2 top-0 text-white fill-current">
    <path d="M-2.28658669e-13,5.31842562 C-2.28658669e-13,2.45222154 2.16912389,0.065403217 5.02324748,0.597341054 L8,1.15217852 L8,13 L-2.28658669e-13,13 L-2.28658669e-13,5.31842562 Z"></path>
  </svg>
);

const TailOut = () => (
  <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -right-2 top-0 text-[#d9fdd3] fill-current">
    <path d="M5.188,1.50376765 C5.188,1.50376765 5.188,1.50376765 5.188,1.50376765 5.188,1.50376765 6.95856984,2.2384662 8,3.95856515 8,5.88514194 L8,13 L-2.28658669e-13,13 L-2.28658669e-13,0.728954209 L5.188,1.50376765 Z"></path>
  </svg>
);

const ChatPage = () => {
  const { ticketId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  
  const clientEmail = location.state?.clientEmail || 'לקוח';
  const clientName = clientEmail.includes('@') ? clientEmail.split('@')[0] : clientEmail; 

  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', ticketId],
    queryFn: () => chatService.getMessages(ticketId),
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: chatService.sendMessage,
    onSuccess: () => {
      setInputText('');
      setSelectedFile(null);
      queryClient.invalidateQueries(['chat', ticketId]);
    },
  });

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() && !selectedFile) return;

    let type = 'text';
    if (selectedFile) {
      if (selectedFile.type.startsWith('image/')) type = 'image';
      else if (selectedFile.type.startsWith('video/')) type = 'video';
      else type = 'file';
    }

    sendMessageMutation.mutate({
      ticketId,
      clientEmail,
      content: inputText,
      file: selectedFile,
      type
    });
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-[#efeae2]"><Loader2 className="animate-spin text-[#008069]" /></div>;

  return (
    <div className="flex flex-col h-screen bg-[#efeae2] relative overflow-hidden">
      
      {/* === רקע === */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-repeat" 
           style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')" }}>
      </div>

      {/* === Header === */}
      <div className="bg-[#008069] h-[60px] flex items-center px-2 shadow-md z-10 text-white shrink-0">
        {/* שימוש ב-Button כאן במקום button רגיל */}
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="rounded-full hover:bg-white/10 mr-1 text-white hover:text-white h-10 w-10 p-0"
        >
            <ArrowLeft size={24} />
        </Button>
        
        <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden ml-1 mr-3 flex items-center justify-center">
             <span className="text-gray-600 font-bold text-lg">{clientName[0]?.toUpperCase()}</span>
        </div>

        <div className="flex-1 cursor-pointer">
          <h2 className="font-semibold text-[17px] leading-tight">{clientEmail}</h2>
          <p className="text-[13px] opacity-80 leading-tight">פנייה #{ticketId}</p>
        </div>

        <div className="flex items-center gap-4 mx-2">
            <Video size={22} className="cursor-pointer" />
            <Phone size={20} className="cursor-pointer" />
            <MoreVertical size={20} className="cursor-pointer" />
        </div>
      </div>

      {/* === Messages === */}
      <div className="flex-1 overflow-y-auto p-[5%] pt-4 flex flex-col gap-1 z-10 scrollbar-thin scrollbar-thumb-black/20">
        
        <div className="flex justify-center mb-4">
            <div className="bg-[#ffeecd] text-[12.5px] text-[#54656f] px-3 py-1.5 rounded-lg shadow-sm text-center max-w-[90%]">
                הודעות בשיחה זו מוצפנות מקצה לקצה ונשלחות למייל של הלקוח.
            </div>
        </div>

        {messages.map((msg, index) => {
          const isMe = msg.sender === 'me';
          const time = new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={index} className={`flex w-full mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative max-w-[65%] min-w-[120px] rounded-lg p-2 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] text-[14.2px] text-[#111b21] leading-[19px]
                ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                
                {isMe ? <TailOut /> : <TailIn />}

                {msg.type === 'image' && msg.fileUrl && (
                    <div className="mb-1 rounded-md overflow-hidden bg-[#cfdcb7]">
                        <img src={msg.fileUrl} alt="sent" className="w-full h-auto object-cover max-h-[300px]" />
                    </div>
                )}
                
                {msg.type === 'file' && (
                    <a href={msg.fileUrl} target="_blank" className="flex items-center gap-3 bg-black/5 p-3 rounded-md mb-1 hover:bg-black/10 transition">
                         <div className="bg-red-500 p-2 rounded text-white"><FileText size={20}/></div>
                         <span className="truncate text-sm font-medium">קובץ מצורף</span>
                    </a>
                )}

                {msg.content && <div className="whitespace-pre-wrap break-words px-1 pb-2">{msg.content}</div>}

                <div className="absolute bottom-1 left-2 flex items-center gap-1">
                    <span className="text-[11px] text-[#667781] leading-none mt-1">{time}</span>
                    {isMe && (
                        <span className={`${msg.isRead ? 'text-[#53bdeb]' : 'text-[#667781]'}`}>
                           <CheckCheck size={16} strokeWidth={2} /> 
                        </span>
                    )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* === Footer === */}
      <div className="bg-[#f0f2f5] p-2 flex items-center gap-2 z-10 min-h-[62px]">
        <div className="flex items-center gap-2 text-[#54656f] px-1">
            <button className="p-1 hover:bg-black/10 rounded-full transition">
                 <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={handleFileSelect} />
                    <span className="block transform rotate-45"><Paperclip size={24} /></span>
                 </label>
            </button>
        </div>

        <div className="flex-1 bg-white rounded-lg flex items-end py-2 px-4 shadow-sm">
             {selectedFile && (
                <div className="mr-2 mb-1 bg-gray-100 p-1 rounded text-xs flex items-center gap-1">
                    <ImageIcon size={12}/> קובץ נבחר
                    <button onClick={() => setSelectedFile(null)} className="text-red-500 font-bold ml-1">X</button>
                </div>
             )}
             <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="הקלד/י הודעה"
                className="w-full max-h-[100px] bg-transparent border-none outline-none resize-none text-[15px] leading-[20px] text-[#111b21] placeholder:text-[#8696a0]"
                rows={1}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
             />
        </div>

        {/* שימוש ב-Button כאן לשליחה */}
        <Button 
            onClick={handleSend}
            disabled={sendMessageMutation.isPending || (!inputText.trim() && !selectedFile)}
            className="rounded-full p-0 h-12 w-12 flex items-center justify-center transition shadow-none border-none bg-transparent hover:bg-transparent"
        >
            {inputText.trim() || selectedFile ? (
                 <div className="bg-[#008069] h-10 w-10 flex items-center justify-center rounded-full text-white shadow-sm hover:bg-[#00705a] transition-all transform hover:scale-105">
                     {sendMessageMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
                 </div>
            ) : (
                <div className="bg-[#008069] h-10 w-10 flex items-center justify-center rounded-full text-white shadow-sm hover:bg-[#00705a]">
                     <span className="block"><Loader2 size={20} className="opacity-0 absolute" /> <span className="text-white font-bold">🎤</span></span> 
                </div>
            )}
        </Button>
      </div>
    </div>
  );
};

export default ChatPage;