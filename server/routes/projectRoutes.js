import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url'; // הוספנו את זה

// --- הוספת הגדרת __dirname (כי אנחנו ב-ES Modules) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    uploadProjectFile,
    deleteProjectFile,
    getAllUsers,
    addCollaborator,
    removeCollaborator,
    updateCollaboratorRole
} from '../controllers/projectController.js';

const router = express.Router();

// --- תיקון הגדרת Multer: שימוש בנתיב מוחלט ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // הולכים 2 תיקיות אחורה: מ-routes ל-server, ומ-server לשורש הפרויקט
    // ואז נכנסים ל-uploads
    cb(null, path.join(__dirname, '../../uploads/'));
  },
  filename: (req, file, cb) => {
    // השארנו את יצירת השם הייחודי כמו שהיה 
    // תיקון קטן: הוספתי קידוד UTF8 לשם המקורי כדי למנוע ג'יבריש בעברית אם יש
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); 
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(originalName));
  }
});

const upload = multer({ storage: storage });

// Routes
// ⚠️ Important: PUT SPECIFIC ROUTES BEFORE GENERIC /:id ROUTES
router.get('/users/all', getAllUsers);

router.route('/')
  .get(getProjects)
  .post(createProject);

router.route('/:id')
  .get(getProject)
  .patch(updateProject)
  .delete(deleteProject);

// העלאת קובץ
router.post('/:id/upload', upload.single('file'), uploadProjectFile);

// מחיקת קובץ
router.delete('/:id/files/:fileId', deleteProjectFile);

// משימות
router.post('/:id/tasks', addTask);
router.post('/:id/tasks/:taskId/convert', convertTaskToProject);
router.patch('/:id/tasks/:taskId/toggle', toggleTask);
router.delete('/:id/tasks/:taskId', deleteTask);

// Collaboration
router.post('/:id/collaborators', addCollaborator);
router.patch('/:id/collaborators/:collaboratorId', updateCollaboratorRole);
router.delete('/:id/collaborators/:collaboratorId', removeCollaborator);

export default router;