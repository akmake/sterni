import { create } from 'zustand';
import api from '@/utils/api';
import { toast } from 'react-hot-toast';

const useGroupsStore = create((set, get) => ({
  groups: [],
  halls: [],
  loading: false,

  // --- קבוצות ---

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/groups');
      set({ groups: res.data, loading: false });
    } catch (error) {
      set({ loading: false });
      console.error('Failed to fetch groups:', error);
      toast.error('שגיאה בטעינת קבוצות');
    }
  },

  addGroup: async (groupData) => {
    try {
      const res = await api.post('/groups', groupData);
      set((state) => ({ groups: [...state.groups, res.data] }));
      toast.success('קבוצה נוצרה בהצלחה');
      return res.data;
    } catch (error) {
      console.error('Failed to add group:', error);
      toast.error('שגיאה ביצירת קבוצה');
      throw error;
    }
  },

  updateEvent: async (groupId, eventId, eventData) => {
    try {
      // 👇 השינוי הוא כאן: מ-put ל-patch
      const res = await api.patch(`/groups/${groupId}/events/${eventId}`, eventData);
      
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
      }));
      toast.success('האירוע עודכן');
      return res.data;
    } catch (error) {
      console.error('Failed to update event:', error);
      toast.error('שגיאה בעדכון אירוע');
      throw error;
    }
  },

  // הפונקציה החדשה למחיקת קבוצה
  deleteGroup: async (id) => {
    try {
      await api.delete(`/groups/${id}`);
      set((state) => ({
        groups: state.groups.filter((g) => g._id !== id)
      }));
      toast.success('הקבוצה נמחקה בהצלחה');
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast.error('שגיאה במחיקת הקבוצה');
      throw error;
    }
  },

  // --- אולמות ---

  fetchHalls: async () => {
    try {
      const res = await api.get('/halls'); // או הנתיב המתאים אצלך
      set({ halls: res.data });
    } catch (error) {
      console.error('Failed to fetch halls:', error);
    }
  },

  // --- אירועים (Schedule) ---

  addEvent: async (groupId, eventData) => {
    try {
      const res = await api.post(`/groups/${groupId}/events`, eventData);
      // השרת מחזיר את הקבוצה המעודכנת
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
      }));
      return res.data; 
    } catch (error) {
      console.error('Failed to add event:', error);
      toast.error('שגיאה בהוספת אירוע');
      throw error;
    }
  },

  updateEvent: async (groupId, eventId, eventData) => {
    try {
      const res = await api.patch(`/groups/${groupId}/events/${eventId}`, eventData);
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
      }));
      toast.success('האירוע עודכן');
      return res.data;
    } catch (error) {
      console.error('Failed to update event:', error);
      toast.error('שגיאה בעדכון אירוע');
      throw error;
    }
  },

  deleteEvent: async (groupId, eventId) => {
    try {
      const res = await api.delete(`/groups/${groupId}/events/${eventId}`);
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
      }));
      toast.success('האירוע נמחק');
      return res.data;
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('שגיאה במחיקת אירוע');
      throw error;
    }
  },
}));

export default useGroupsStore;