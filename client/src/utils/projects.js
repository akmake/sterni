import api from '@/utils/api';

// --- Project CRUD ---
export const getProjects = async () => {
  const { data } = await api.get('/projects');
  return data;
};

export const getProject = async (id) => {
  const { data } = await api.get(`/projects/${id}`);
  return data;
};

export const createProject = async (body) => {
  const { data } = await api.post('/projects', body);
  return data;
};

export const updateProject = async (id, body) => {
  const { data } = await api.patch(`/projects/${id}`, body);
  return data;
};

export const deleteProject = async (id) => {
  const { data } = await api.delete(`/projects/${id}`);
  return data;
};

// --- Tasks ---
export const addTask = async (projectId, task) => {
  const { data } = await api.post(`/projects/${projectId}/tasks`, task);
  return data;
};

export const toggleTask = async (projectId, taskId) => {
  const { data } = await api.patch(`/projects/${projectId}/tasks/${taskId}/toggle`);
  return data;
};

export const deleteTask = async (projectId, taskId) => {
  const { data } = await api.delete(`/projects/${projectId}/tasks/${taskId}`);
  return data;
};

export const renameTask = async (projectId, taskId, name) => {
  const { data } = await api.patch(`/projects/${projectId}/tasks/${taskId}/rename`, { name });
  return data;
};

export const convertTaskToProject = async (projectId, taskId) => {
    const { data } = await api.post(`/projects/${projectId}/tasks/${taskId}/convert`);
    return data;
};

// --- Files (העלאה ומחיקה) ---
export const uploadFile = async (projectId, formData) => {
  // Axios מזהה לבד FormData ושולח את ה-Headers הנכונים
  const { data } = await api.post(`/projects/${projectId}/upload`, formData);
  return data;
};

export const deleteFile = async (projectId, fileId) => {
    const { data } = await api.delete(`/projects/${projectId}/files/${fileId}`);
    return data;
};