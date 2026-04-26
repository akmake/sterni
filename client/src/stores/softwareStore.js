import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import api from '../utils/api';

const useSoftwareStore = create(
  devtools(
    (set, get) => ({
      items: [],
      loading: false,
      error: null,
      // Per-item upload progress: { [id]: 0-100 }
      uploadProgress: {},

      fetchItems: async () => {
        set({ loading: true, error: null });
        try {
          const res = await api.get('/software');
          set({ items: res.data, loading: false });
        } catch (err) {
          set({ error: err.response?.data?.message || err.message, loading: false });
        }
      },

      createItem: async (data) => {
        const res = await api.post('/software', data);
        set(state => ({ items: [...state.items, res.data] }));
        return res.data;
      },

      updateItem: async (id, data) => {
        const res = await api.patch(`/software/${id}`, data);
        set(state => ({
          items: state.items.map(i => i._id === id ? res.data : i),
        }));
        return res.data;
      },

      deleteItem: async (id) => {
        await api.delete(`/software/${id}`);
        set(state => ({ items: state.items.filter(i => i._id !== id) }));
      },

      // Upload file with progress tracking
      uploadFile: async (id, file) => {
        const formData = new FormData();
        formData.append('file', file);

        set(state => ({ uploadProgress: { ...state.uploadProgress, [id]: 0 } }));

        const res = await api.post(`/software/${id}/upload`, formData, {
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded * 100) / (e.total || 1));
            set(state => ({ uploadProgress: { ...state.uploadProgress, [id]: pct } }));
          },
        });

        set(state => {
          const prog = { ...state.uploadProgress };
          delete prog[id];
          return {
            items: state.items.map(i => i._id === id ? res.data : i),
            uploadProgress: prog,
          };
        });
        return res.data;
      },

      deleteFile: async (id) => {
        const res = await api.delete(`/software/${id}/file`);
        set(state => ({
          items: state.items.map(i => i._id === id ? res.data : i),
        }));
        return res.data;
      },

      getDownloadUrl: (id) => `/api/software/${id}/download`,
    }),
    { name: 'Software Store' }
  )
);

export default useSoftwareStore;
