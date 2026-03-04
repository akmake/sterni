import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import api from '../utils/api';
import { getSocket } from '../utils/socket';

const useHouseholdProjectStore = create(
  devtools(
    (set, get) => ({
      projects: [],
      activeProject: null,
      loading: false,
      error: null,

      // Fetch all
      fetchProjects: async () => {
        set({ loading: true, error: null });
        try {
          const res = await api.get('/household-projects');
          set({ projects: res.data, loading: false });
        } catch (err) {
          set({ error: err.response?.data?.error || err.message, loading: false });
        }
      },

      // Fetch single
      fetchProject: async (id) => {
        set({ loading: true, error: null });
        try {
          const res = await api.get(`/household-projects/${id}`);
          set({ activeProject: res.data, loading: false });
        } catch (err) {
          set({ error: err.response?.data?.error || err.message, loading: false });
        }
      },

      // Create
      createProject: async (data) => {
        set({ loading: true });
        try {
          const res = await api.post('/household-projects', data);
          set({ loading: false });
          return res.data;
        } catch (err) {
          set({ loading: false });
          throw err.response?.data || err;
        }
      },

      // Update
      updateProject: async (id, data) => {
        try {
          const res = await api.patch(`/household-projects/${id}`, data);
          set({ activeProject: res.data });
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      // Delete
      deleteProject: async (id) => {
        try {
          await api.delete(`/household-projects/${id}`);
          set(state => ({ projects: state.projects.filter(p => p._id !== id) }));
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      // Add fund (goal)
      addFund: async (id, data) => {
        set({ loading: true });
        try {
          const res = await api.post(`/household-projects/${id}/funds`, data);
          set({ activeProject: res.data, loading: false });
          return res.data;
        } catch (err) {
          set({ loading: false });
          throw err.response?.data || err;
        }
      },

      // Add task (task project)
      addTask: async (id, data) => {
        set({ loading: true });
        try {
          const res = await api.post(`/household-projects/${id}/tasks`, data);
          set({ activeProject: res.data, loading: false });
          return res.data;
        } catch (err) {
          set({ loading: false });
          throw err.response?.data || err;
        }
      },

      // Toggle task
      toggleTask: async (projectId, taskId) => {
        try {
          const res = await api.patch(`/household-projects/${projectId}/tasks/${taskId}/toggle`);
          set({ activeProject: res.data });
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      // Delete task
      deleteTask: async (projectId, taskId) => {
        try {
          const res = await api.delete(`/household-projects/${projectId}/tasks/${taskId}`);
          set({ activeProject: res.data });
          return res.data;
        } catch (err) {
          throw err.response?.data || err;
        }
      },

      // Socket listeners
      setupSocketListeners: () => {
        const socket = getSocket();
        if (!socket) return;

        socket.on('householdProject:added', (project) => {
          set(state => ({ projects: [project, ...state.projects] }));
        });
        socket.on('householdProject:updated', (project) => {
          set(state => ({
            projects: state.projects.map(p => p._id === project._id ? project : p),
            activeProject: state.activeProject?._id === project._id ? project : state.activeProject,
          }));
        });
        socket.on('householdProject:deleted', (id) => {
          set(state => ({
            projects: state.projects.filter(p => p._id !== id),
            activeProject: state.activeProject?._id === id ? null : state.activeProject,
          }));
        });
      },

      cleanupSocketListeners: () => {
        const socket = getSocket();
        if (!socket) return;
        ['householdProject:added', 'householdProject:updated', 'householdProject:deleted'].forEach(e => socket.off(e));
      },
    }),
    { name: 'Household Project Store' }
  )
);

export default useHouseholdProjectStore;
