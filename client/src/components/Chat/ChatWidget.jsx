import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Paperclip, Phone, Mail, MessageCircle } from 'lucide-react';

const ChatWidget = ({ ticketId, clientEmail, clientPhone, existingMessages }) => {
  const [messages, setMessages] = useState(existingMessages || []);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef(null);

  // גלילה למטה כשמגיעה הודעה
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // פונקציה להעלאת קובץ (אם יש לך כבר לוגיקה כזו במערכת - תשתמש בה)
  const uploadFile = async (fileToUpload) => {
    const formData = new FormData();
    formData.append('file', fileToUpload);
    
    // הנחה: יש לך ראוט להעלאת קבצים שמחזיר { fileUrl: '/uploads/...' }
    const res = await axios.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.fileUrl;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage && !file) return;

    try {
      setIsUploading(true);
      let fileUrl = null;
      let type = 'text';

      // 1. קודם מעלים את הקובץ (אם יש)
      if (file) {
        fileUrl = await uploadFile(file);
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else type = 'file';
      }

      // 2. שולחים את ההודעה לשרת שלנו (שמנתב למייל/וואצפ)
      const payload = {
        ticketId,
        clientEmail,     // חובה בשביל המייל
        clientPhone,     // חובה בשביל הוואצפ
        content: newMessage,
        type,
        fileUrl
      };

      const { data } = await axios.post('/api/chat', payload);
      
      // עדכון התצוגה (אופטימי או מהשרת)
      setMessages([...messages, data.data]);
      setNewMessage('');
      setFile(null);

    } catch (error) {
      console.error("Failed to send:", error);
      alert("שגיאה בשליחת ההודעה");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow-md border overflow-hidden">
      
      {/* כותרת */}
      <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
        <h3 className="font-bold text-gray-700">התכתבות</h3>
        <div className="flex gap-3 text-sm text-gray-500">
           {clientPhone && (
             <span className="flex items-center gap-1 text-green-600">
               <MessageCircle size={16} /> זמין בוואצפ
             </span>
           )}
           <span className="flex items-center gap-1 text-blue-600">
             <Mail size={16} /> זמין במייל
           </span>
        </div>
      </div>

      {/* איזור ההודעות */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100/50">
        {messages.map((msg, idx) => {
          const isMe = msg.sender === 'me' || msg.sender === 'admin';
          return (
            <div key={idx} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[70%] p-3 rounded-lg shadow-sm text-sm relative ${
                isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border'
              }`}>
                
                {/* אייקון מקור (מאיפה ההודעה הגיעה/נשלחה) */}
                <div className="absolute -top-3 right-0 bg-white rounded-full p-0.5 shadow border text-xs">
                    {msg.source === 'whatsapp' && <MessageCircle size={14} className="text-green-500" />}
                    {msg.source === 'email' && <Mail size={14} className="text-blue-500" />}
                    {msg.source === 'web' && <Send size={14} className="text-gray-500" />}
                </div>

                {/* הצגת תוכן */}
                {msg.type === 'image' && msg.fileUrl && (
                  <img src={msg.fileUrl} alt="attachment" className="mb-2 rounded max-h-40 w-full object-cover bg-black/10" />
                )}
                {msg.type === 'file' && msg.fileUrl && (
                   <a href={msg.fileUrl} target="_blank" className="flex items-center gap-2 bg-black/10 p-2 rounded mb-2 hover:bg-black/20 transition">
                      <Paperclip size={16} /> קובץ מצורף
                   </a>
                )}
                
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <div className={`text-[10px] mt-1 text-left opacity-70`}>
                  {new Date(msg.createdAt).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* שליחה */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t flex flex-col gap-2">
        {file && (
            <div className="flex items-center justify-between bg-gray-100 p-2 rounded text-xs">
                <span>📎 {file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="text-red-500">X</button>
            </div>
        )}
        <div className="flex items-center gap-2">
            <label className="cursor-pointer p-2 text-gray-400 hover:text-blue-600 transition">
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                <Paperclip size={20} />
            </label>
            
            <input
              type="text"
              className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:border-blue-500 text-sm"
              placeholder="כתוב הודעה..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isUploading}
            />
            
            <button 
                type="submit" 
                disabled={isUploading || (!newMessage && !file)}
                className={`p-2 rounded-full text-white transition shadow-sm ${isUploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                <Send size={18} />
            </button>
        </div>
      </form>
    </div>
  );
};

export default ChatWidget;