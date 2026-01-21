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

  // 👇 זו הפונקציה שהייתה חסרה לך!
  updateGroup: async (id, groupData) => {
    try {
      const res = await api.patch(`/groups/${id}`, groupData);
      set((state) => ({
        groups: state.groups.map((g) => 
          g._id === id ? { ...g, ...res.data } : g
        ),
      }));
      toast.success('פרטי הקבוצה עודכנו בהצלחה');
      return res.data;
    } catch (error) {
      console.error('Failed to update group:', error);
      toast.error('שגיאה בעדכון הקבוצה');
      throw error;
    }
  },

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
      const res = await api.get('/halls');
      set({ halls: res.data });
    } catch (error) {
      console.error('Failed to fetch halls:', error);
    }
  },

  // --- אירועים (Schedule) ---

  addEvent: async (groupId, eventData) => {
    try {
      const res = await api.post(`/groups/${groupId}/events`, eventData);
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
  duplicateEvents: async (groupId, eventIds, targetDate) => {
    try {
      const res = await api.post(`/groups/${groupId}/duplicate-events`, {
        eventIds,
        targetDate
      });
      
      // עדכון המצב המקומי עם הקבוצה המעודכנת שחזרה מהשרת
      set((state) => ({
        groups: state.groups.map((g) => (g._id === groupId ? res.data : g)),
      }));
      
      toast.success('האירועים שוכפלו בהצלחה!');
      return res.data;
    } catch (error) {
      console.error('Failed to duplicate events:', error);
      toast.error('שגיאה בשכפול אירועים');
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