import { create } from 'zustand';
import api from '@/utils/api';
import { toast } from 'react-hot-toast';

const usePaymentStore = create((set, get) => ({
  // --- State ---
  payments: [],
  billing: null,
  summary: null,
  groupInfo: null,
  loading: false,
  uploading: false,

  // דוח כללי
  allGroupsReport: null,
  reportLoading: false,

  // ═══════════════════════════════════════════════
  // סיכום כספי לקבוצה (Dashboard)
  // ═══════════════════════════════════════════════
  fetchFinancialSummary: async (groupId) => {
    set({ loading: true });
    try {
      const res = await api.get(`/payments/groups/${groupId}/summary`);
      set({
        payments: res.data.payments,
        billing: res.data.billing,
        summary: res.data.summary,
        groupInfo: res.data.group,
        loading: false,
      });
      return res.data;
    } catch (error) {
      set({ loading: false });
      console.error('Failed to fetch financial summary:', error);
      toast.error('שגיאה בטעינת נתונים כספיים');
      throw error;
    }
  },

  // ═══════════════════════════════════════════════
  // CRUD תשלומים
  // ═══════════════════════════════════════════════
  addPayment: async (groupId, formData) => {
    set({ uploading: true });
    try {
      const res = await api.post(`/payments/groups/${groupId}/payments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      set((state) => ({
        payments: [res.data, ...state.payments],
        uploading: false,
      }));
      toast.success('התשלום נרשם בהצלחה');
      // רענון סיכום
      get().fetchFinancialSummary(groupId);
      return res.data;
    } catch (error) {
      set({ uploading: false });
      console.error('Failed to add payment:', error);
      toast.error('שגיאה ברישום תשלום');
      throw error;
    }
  },

  updatePayment: async (paymentId, formData, groupId) => {
    set({ uploading: true });
    try {
      const res = await api.patch(`/payments/payments/${paymentId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      set((state) => ({
        payments: state.payments.map(p => p._id === paymentId ? res.data : p),
        uploading: false,
      }));
      toast.success('התשלום עודכן בהצלחה');
      if (groupId) get().fetchFinancialSummary(groupId);
      return res.data;
    } catch (error) {
      set({ uploading: false });
      console.error('Failed to update payment:', error);
      toast.error('שגיאה בעדכון תשלום');
      throw error;
    }
  },

  deletePayment: async (paymentId, groupId) => {
    try {
      await api.delete(`/payments/payments/${paymentId}`);
      set((state) => ({
        payments: state.payments.filter(p => p._id !== paymentId),
      }));
      toast.success('התשלום נמחק');
      if (groupId) get().fetchFinancialSummary(groupId);
    } catch (error) {
      console.error('Failed to delete payment:', error);
      toast.error('שגיאה במחיקת תשלום');
      throw error;
    }
  },

  confirmPayment: async (paymentId, groupId) => {
    try {
      const res = await api.patch(`/payments/payments/${paymentId}/confirm`);
      set((state) => ({
        payments: state.payments.map(p => p._id === paymentId ? res.data : p),
      }));
      toast.success('התשלום אושר');
      if (groupId) get().fetchFinancialSummary(groupId);
    } catch (error) {
      toast.error('שגיאה באישור תשלום');
      throw error;
    }
  },

  rejectPayment: async (paymentId, reason, groupId) => {
    try {
      const res = await api.patch(`/payments/payments/${paymentId}/reject`, { reason });
      set((state) => ({
        payments: state.payments.map(p => p._id === paymentId ? res.data : p),
      }));
      toast.success('התשלום נדחה');
      if (groupId) get().fetchFinancialSummary(groupId);
    } catch (error) {
      toast.error('שגיאה בדחיית תשלום');
      throw error;
    }
  },

  deleteAttachment: async (paymentId, attachmentId, groupId) => {
    try {
      const res = await api.delete(`/payments/payments/${paymentId}/attachments/${attachmentId}`);
      set((state) => ({
        payments: state.payments.map(p => p._id === paymentId ? res.data : p),
      }));
      toast.success('הקובץ נמחק');
    } catch (error) {
      toast.error('שגיאה במחיקת קובץ');
      throw error;
    }
  },

  // ═══════════════════════════════════════════════
  // פרופיל חיוב
  // ═══════════════════════════════════════════════
  updateBilling: async (groupId, billingData) => {
    try {
      const res = await api.put(`/payments/groups/${groupId}/billing`, billingData);
      set({ billing: res.data });
      toast.success('פרופיל חיוב עודכן');
      get().fetchFinancialSummary(groupId);
      return res.data;
    } catch (error) {
      toast.error('שגיאה בעדכון פרופיל חיוב');
      throw error;
    }
  },

  // ═══════════════════════════════════════════════
  // דוח כולל
  // ═══════════════════════════════════════════════
  fetchAllGroupsReport: async () => {
    set({ reportLoading: true });
    try {
      const res = await api.get('/payments/report');
      set({ allGroupsReport: res.data, reportLoading: false });
      return res.data;
    } catch (error) {
      set({ reportLoading: false });
      toast.error('שגיאה בטעינת דוח כספי');
      throw error;
    }
  },

  // --- Reset ---
  reset: () => set({ payments: [], billing: null, summary: null, groupInfo: null }),
}));

export default usePaymentStore;