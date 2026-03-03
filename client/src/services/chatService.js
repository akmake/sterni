import api from '@/utils/api';

export const chatService = {
  // קבלת היסטוריית שיחה לפי מספר פנייה
  getMessages: async (ticketId) => {
    const response = await api.get(`/chat/${ticketId}`);
    return response.data;
  },

  // שליחת הודעה (כולל קבצים)
  sendMessage: async (messageData) => {
    const formData = new FormData();
    formData.append('ticketId', messageData.ticketId);
    formData.append('clientEmail', messageData.clientEmail);
    formData.append('content', messageData.content);
    formData.append('type', messageData.type);
    
    if (messageData.file) {
      formData.append('file', messageData.file);
    }

    const response = await api.post('/chat/send', formData);
    return response.data;
  }
};