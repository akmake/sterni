import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getHouseholdProjects,
  getHouseholdProject,
  createHouseholdProject,
  updateHouseholdProject,
  deleteHouseholdProject,
  addFund,
  updateFund,
  deleteFund,
  addProjectTask,
  toggleProjectTask,
  deleteProjectTask,
  renameProjectTask,
  uploadHouseholdProjectFile,
  deleteHouseholdProjectFile,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
} from '../controllers/householdProjectController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/')),
  filename: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(originalName));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|csv|txt/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowedTypes.test(ext) || allowedTypes.test(file.mimetype)) cb(null, true);
    else cb(new Error('סוג קובץ לא מורשה'), false);
  }
});

const router = express.Router();
router.use(requireAuth);

router.get('/', getHouseholdProjects);
router.get('/:id', getHouseholdProject);
router.post('/', createHouseholdProject);
router.patch('/:id', updateHouseholdProject);
router.delete('/:id', deleteHouseholdProject);

// Fund operations (goal projects)
router.post('/:id/funds', addFund);
router.patch('/:id/funds/:fundId', updateFund);
router.delete('/:id/funds/:fundId', deleteFund);

// Task operations (task + simple projects)
router.post('/:id/tasks', addProjectTask);
router.patch('/:id/tasks/:taskId/toggle', toggleProjectTask);
router.patch('/:id/tasks/:taskId/rename', renameProjectTask);
router.delete('/:id/tasks/:taskId', deleteProjectTask);

// File operations
router.post('/:id/upload', upload.single('file'), uploadHouseholdProjectFile);
router.delete('/:id/files/:fileId', deleteHouseholdProjectFile);

// Collaborator operations
router.post('/:id/collaborators', addCollaborator);
router.patch('/:id/collaborators/:collaboratorId', updateCollaboratorRole);
router.delete('/:id/collaborators/:collaboratorId', removeCollaborator);

export default router;
