import { create } from 'zustand';
import { toast } from 'react-hot-toast';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addTask,
  toggleTask,
  deleteTask,
  convertTaskToProject,
  uploadFile,
  deleteFile
} from '../utils/projects';

const useProjectsStore = create((set, get) => ({
  projects: [],
  activeProject: null,
  loading: false,
  error: null,

  _start: () => set({ loading: true, error: null }),
  _success: (overrides = {}) => set({ loading: false, ...overrides }),
  _fail: (err) => {
      console.error(err);
      toast.error('שגיאה בפעולה, נסה שנית.');
      set({ loading: false, error: err });
  },

  fetchProjects: async () => {
    get()._start();
    try {
      const projects = await getProjects();
      get()._success({ projects });
    } catch (err) { get()._fail(err); }
  },

  fetchProject: async (id) => {
    get()._start();
    try {
      const project = await getProject(id);
      get()._success({ activeProject: project });
    } catch (err) { get()._fail(err); }
  },

  createProject: async (payload) => {
    get()._start();
    try {
      const project = await createProject(payload);
      get()._success({ projects: [project, ...get().projects] });
      toast.success('הפרויקט נוצר בהצלחה');
      return project;
    } catch (err) {
        get()._fail(err);
        throw err;
    }
  },

  deleteProject: async (id) => {
    get()._start();
    try {
      await deleteProject(id);
      const projects = get().projects.filter((p) => p._id !== id);
      const activeProject = get().activeProject?._id === id ? null : get().activeProject;
      get()._success({ projects, activeProject });
      toast.success('הפרויקט נמחק');
    } catch (err) { get()._fail(err); }
  },

  // --- Task Actions ---
  addTask: async (projectId, task) => {
    try {
      const updated = await addTask(projectId, task);
      set({ activeProject: updated });
    } catch (err) { get()._fail(err); }
  },

  toggleTask: async (projectId, taskId) => {
    try {
      const current = get().activeProject;
      // עדכון אופטימי (לפני השרת)
      const updatedTasks = current.tasks.map(t =>
          t._id === taskId ? { ...t, done: !t.done } : t
      );
      set({ activeProject: { ...current, tasks: updatedTasks }});
      await toggleTask(projectId, taskId);
    } catch (err) {
        get()._fail(err);
        get().fetchProject(projectId); // רענון במקרה של שגיאה
    }
  },

  deleteTask: async (projectId, taskId) => {
    try {
      await deleteTask(projectId, taskId);
      const current = get().activeProject;
      const updatedTasks = current.tasks.filter(t => t._id !== taskId);
      set({ activeProject: { ...current, tasks: updatedTasks }});
      toast.success('המשימה נמחקה');
    } catch (err) { get()._fail(err); }
  },

  convertTaskToProject: async (projectId, taskId) => {
      get()._start();
      try {
          await convertTaskToProject(projectId, taskId);
          const updatedOriginal = await getProject(projectId);
          const allProjects = await getProjects();
          get()._success({
              activeProject: updatedOriginal,
              projects: allProjects
          });
          toast.success('המשימה הפכה לפרויקט חדש! 🚀');
      } catch (err) { get()._fail(err); }
  },

  // --- Files Actions (החדשים) ---
  
  uploadFileToProject: async (projectId, file) => {
    const { _start, _success, _fail } = get();
    try {
        _start();
        const formData = new FormData();
        formData.append('file', file);

        const updatedProject = await uploadFile(projectId, formData);
        
        // עדכון הפרויקט ברשימה ובפרויקט הפעיל
        const projects = get().projects.map(p => p._id === projectId ? updatedProject : p);
        
        _success({ 
            projects, 
            activeProject: updatedProject 
        });
        toast.success('הקובץ הועלה בהצלחה!');
    } catch (err) {
        _fail(err);
        toast.error('שגיאה בהעלאת הקובץ');
    }
  },

  deleteFileFromProject: async (projectId, fileId) => {
      const { activeProject, _fail } = get();
      try {
          // 1. שמירת המצב הקודם למקרה של שגיאה
          const previousProject = { ...activeProject };

          // 2. עדכון אופטימי ב-UI (מחיקה מיידית מהמסך)
          const updatedFiles = activeProject.files.filter(f => f._id !== fileId);
          set({ activeProject: { ...activeProject, files: updatedFiles } });

          // 3. שליחת בקשה לשרת
          await deleteFile(projectId, fileId);
          toast.success('הקובץ נמחק');
      } catch (err) {
          _fail(err);
          // במקרה שגיאה - שחזור המצב
          set({ activeProject: get().activeProject }); 
          toast.error('לא ניתן למחוק את הקובץ');
      }
  }
}));

export default useProjectsStore;