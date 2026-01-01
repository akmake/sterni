import { create } from 'zustand';
import api from '@/utils/api';
import { toast } from 'react-hot-toast';

const useGroupsStore = create((set, get) => ({
  groups: [],
  halls: [],
  activeGroup: null,
  loading: false,

  fetchHalls: async () => {
    try {
      const { data } = await api.get('/halls');
      set({ halls: data });
    } catch (error) { console.error(error); }
  },

  createHall: async (hallData) => {
    try {
      const { data } = await api.post('/halls', hallData);
      set(state => ({ halls: [...state.halls, data] }));
      toast.success('האולם נוסף');
    } catch (error) { toast.error('שגיאה ביצירת אולם'); }
  },

  deleteHall: async (id) => {
    try {
        await api.delete(`/halls/${id}`);
        set(state => ({ halls: state.halls.filter(h => h._id !== id) }));
    } catch(e) { toast.error('שגיאה במחיקה'); }
  },

  fetchGroups: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/groups');
      set({ groups: data, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },

  createGroup: async (groupData) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/groups', groupData);
      set(state => ({ groups: [...state.groups, data], loading: false }));
      toast.success('הקבוצה נוצרה!');
      return data;
    } catch (error) {
      set({ loading: false });
      toast.error('שגיאה ביצירת קבוצה');
      throw error;
    }
  },

  // --- פעולה חדשה: עדכון פרטי קבוצה (כמות אנשים וכו') ---
  updateGroup: async (groupId, updates) => {
      try {
          const { data } = await api.patch(`/groups/${groupId}`, updates);
          // עדכון הסטייט המקומי
          set(state => ({
              groups: state.groups.map(g => g._id === groupId ? data : g),
              activeGroup: state.activeGroup?._id === groupId ? data : state.activeGroup
          }));
          toast.success('הפרטים עודכנו');
      } catch (error) {
          toast.error('שגיאה בעדכון פרטים');
      }
  },

  addEvent: async (groupId, eventData) => {
    try {
      const { data: updatedGroup } = await api.post(`/groups/${groupId}/events`, eventData);
      set(state => ({
        groups: state.groups.map(g => g._id === groupId ? updatedGroup : g)
      }));
      toast.success('האירוע שובץ');
    } catch (error) {
      const msg = error.response?.data?.message || 'שגיאה בשיבוץ';
      toast.error(msg);
    }
  }
}));

export default useGroupsStore;