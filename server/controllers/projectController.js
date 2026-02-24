import Project from '../models/Project.js';
import User from '../models/userModel.js';
import AppError from '../utils/AppError.js';

// --- Helper: Validate Ownership ---
const assertProjectOwner = (project, userId) => {
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  if (project.owner.toString() !== userId.toString()) {
    throw new AppError('Not authorized to access this project', 403);
  }
};

// --- CRUD Operations ---

// 1. קבלת כל הפרויקטים של המשתמש (אישיים + משותפים)
export const getProjects = async (req, res, next) => {
  try {
    // פרויקטים שאני הבעלים שלהם
    const ownProjects = await Project.find({ owner: req.user._id }).sort({ createdAt: -1 });
    
    // פרויקטים משותפים (כשאני collaborator)
    const sharedProjects = await Project.find({
      'collaborators.userId': req.user._id
    }).sort({ createdAt: -1 });
    
    // שילוב שניהם
    const allProjects = [...ownProjects, ...sharedProjects];
    
    // מיון לפי תאריך ירידה
    allProjects.sort((a, b) => b.createdAt - a.createdAt);
    
    res.json(allProjects);
  } catch (err) {
    next(err);
  }
};

// 2. קבלת פרויקט ספציפי (עם בדיקת הרשאות)
export const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) return next(new AppError('Project not found', 404));
    
    // בדיקה: האם אני בעלים או משתתף?
    const isOwner = project.owner.toString() === req.user._id.toString();
    const collaborator = project.collaborators.find(
      c => c.userId.toString() === req.user._id.toString()
    );
    
    if (!isOwner && !collaborator) {
      return next(new AppError('Not authorized to access this project', 403));
    }
    
    // הוספת מידע על הרשאותיי
    const projectData = project.toJSON();
    projectData.myRole = isOwner ? 'owner' : collaborator.role;
    
    res.json(projectData);
  } catch (err) {
    next(err);
  }
};

// 3. יצירת פרויקט חדש
export const createProject = async (req, res, next) => {
  try {
    const { projectName, description, dueDate, initialTaskName } = req.body;

    const tasks = [];
    if (initialTaskName && initialTaskName.trim().length > 0) {
        tasks.push({ name: initialTaskName, done: false });
    }

    const project = new Project({
      owner: req.user._id,
      projectName,
      description,
      dueDate,
      tasks
      // files: [] (יתווסף בהמשך אם נרצה)
    });

    await project.save();
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

// 4. עדכון פרטי פרויקט (שם/תיאור) - רק בעלים או משתתפים עם edit
export const updateProject = async (req, res, next) => {
  try {
    const { projectName, description, dueDate } = req.body;
    
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));
    
    // בדיקה: האם יש לי הרשאה לעריכה?
    const isOwner = project.owner.toString() === req.user._id.toString();
    const collaborator = project.collaborators.find(
      c => c.userId.toString() === req.user._id.toString()
    );
    
    const hasEditAccess = isOwner || (collaborator && collaborator.role === 'edit');
    
    if (!hasEditAccess) {
      return next(new AppError('Not authorized to edit this project', 403));
    }

    project.projectName = projectName || project.projectName;
    project.description = description || project.description;
    project.dueDate = dueDate || project.dueDate;
    
    await project.save();
    res.json(project);
  } catch (err) {
    next(err);
  }
};

// 5. מחיקת פרויקט (רק בעלים)
export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) return next(new AppError('Project not found', 404));
    
    if (project.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized to delete this project', 403));
    }

    await Project.findByIdAndDelete(req.params.id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// --- Task Operations ---

// 6. הוספת משימה - רק בעלים או משתתפים עם edit
export const addTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));

    // בדיקה: האם יש לי הרשאה לעריכה?
    const isOwner = project.owner.toString() === req.user._id.toString();
    const collaborator = project.collaborators.find(
      c => c.userId.toString() === req.user._id.toString()
    );
    
    const hasEditAccess = isOwner || (collaborator && collaborator.role === 'edit');
    
    if (!hasEditAccess) {
      return next(new AppError('Not authorized to edit this project', 403));
    }

    const { name } = req.body;
    if (!name) return next(new AppError('Task name is required', 400));

    project.tasks.push({ name, done: false });
    await project.save();
    
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

// 7. שינוי סטטוס משימה (בוצע/לא בוצע) - רק בעלים או משתתפים עם edit
export const toggleTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));

    // בדיקה: האם יש לי הרשאה לעריכה?
    const isOwner = project.owner.toString() === req.user._id.toString();
    const collaborator = project.collaborators.find(
      c => c.userId.toString() === req.user._id.toString()
    );
    
    const hasEditAccess = isOwner || (collaborator && collaborator.role === 'edit');
    
    if (!hasEditAccess) {
      return next(new AppError('Not authorized to edit this project', 403));
    }

    const task = project.tasks.id(req.params.taskId);
    if (!task) return next(new AppError('Task not found', 404));

    task.done = !task.done;
    await project.save();

    res.json(project);
  } catch (err) {
    next(err);
  }
};

// 8. מחיקת משימה - רק בעלים או משתתפים עם edit
export const deleteTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));

    // בדיקה: האם יש לי הרשאה לעריכה?
    const isOwner = project.owner.toString() === req.user._id.toString();
    const collaborator = project.collaborators.find(
      c => c.userId.toString() === req.user._id.toString()
    );
    
    const hasEditAccess = isOwner || (collaborator && collaborator.role === 'edit');
    
    if (!hasEditAccess) {
      return next(new AppError('Not authorized to edit this project', 403));
    }

    // שימוש ב-pull להסרת תת-מסמך ממערך
    project.tasks.pull({ _id: req.params.taskId });
    await project.save();

    res.json(project);
  } catch (err) {
    next(err);
  }
};

// 9. עדכון שם משימה בפרויקט
export const renameTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));

    const isOwner = project.owner.toString() === req.user._id.toString();
    const collaborator = project.collaborators.find(
      c => c.userId.toString() === req.user._id.toString()
    );
    const hasEditAccess = isOwner || (collaborator && collaborator.role === 'edit');
    if (!hasEditAccess) return next(new AppError('Not authorized to edit this project', 403));

    const task = project.tasks.id(req.params.taskId);
    if (!task) return next(new AppError('Task not found', 404));

    const { name } = req.body;
    if (!name || !name.trim()) return next(new AppError('Task name is required', 400));

    task.name = name.trim();
    await project.save();
    res.json(project);
  } catch (err) { next(err); }
};

// 10. הטוויסט: המרת משימה לפרויקט חדש
export const convertTaskToProject = async (req, res, next) => {
    try {
        const { id, taskId } = req.params;
        
        // 1. מוצאים את הפרויקט המקורי
        const originalProject = await Project.findOne({ _id: id, owner: req.user._id });
        if(!originalProject) return next(new AppError('Project not found', 404));

        // 2. מוצאים את המשימה
        const task = originalProject.tasks.id(taskId);
        if(!task) return next(new AppError('Task not found', 404));

        // 3. יוצרים פרויקט חדש על בסיס המשימה
        const newProject = new Project({
            owner: req.user._id,
            projectName: task.name, // שם המשימה הופך לשם הפרויקט
            description: `נוצר אוטומטית מפרויקט: ${originalProject.projectName}`,
            tasks: [{ name: 'הגדר משימות ראשונות', done: false }] 
        });

        // 4. מוחקים את המשימה מהפרויקט הישן
        originalProject.tasks.pull({ _id: taskId });

        // 5. שומרים את שניהם במקביל
        await Promise.all([originalProject.save(), newProject.save()]);

        res.status(200).json({ 
            message: 'Task converted successfully', 
            newProject, 
            originalProject 
        });

    } catch (err) { next(err); }
};

// server/controllers/projectController.js

export const uploadProjectFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('לא נבחר קובץ', 400));
    }

    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
    if (!project) return next(new AppError('Project not found', 404));

    // יצירת אובייקט הקובץ לפי הסכמה שלך [cite: 1321]
    const newFile = {
      name: req.file.originalname,
      url: `/uploads/${req.file.filename}`, // הנתיב היחסי
      type: req.file.mimetype,
      uploadedAt: new Date()
    };

    project.files.push(newFile);
    await project.save();

    res.status(200).json(project);
  } catch (err) {
    next(err);
  }
};

export const deleteProjectFile = async (req, res, next) => {
  try {
    const { id, fileId } = req.params;

    const project = await Project.findOne({ _id: id, owner: req.user._id });
    if (!project) return next(new AppError('Project not found', 404));

    // מציאת הקובץ בתוך המערך
    const fileIndex = project.files.findIndex(f => f._id.toString() === fileId);
    
    if (fileIndex === -1) {
        return next(new AppError('File not found in project', 404));
    }

    const fileToDelete = project.files[fileIndex];

    // 1. הסרה מהמערך במסד הנתונים
    project.files.splice(fileIndex, 1);
    await project.save();

    // 2. ניסיון למחוק את הקובץ הפיזי מהשרת (אופציונלי, כדי לא לבזבז מקום)
    if (fileToDelete.url) {
        // המרת ה-URL לנתיב במחשב
        const fileName = fileToDelete.url.split('/uploads/')[1];
        if (fileName) {
            const filePath = path.join(__dirname, '../../uploads', fileName);
            fs.unlink(filePath, (err) => {
                if (err) console.error("Failed to delete local file:", err.message);
                else console.log("Local file deleted:", fileName);
            });
        }
    }

    res.status(200).json(project);
  } catch (err) {
    next(err);
  }
};

// --- Collaboration Functions ---

// 10. קבלת כל המשתמשים באתר (לשתוף פרויקטים איתם)
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('_id name email')
      .lean();
    
    // הסרת המשתמש הנוכחי מהרשימה
    const filteredUsers = users.filter(u => u._id.toString() !== req.user._id.toString());
    
    res.json(filteredUsers);
  } catch (err) {
    next(err);
  }
};

// 11. הוספת משתתף לפרויקט
export const addCollaborator = async (req, res, next) => {
  try {
    const { userId, role } = req.body;
    
    if (!userId || !['view', 'edit'].includes(role)) {
      return next(new AppError('userId and valid role are required', 400));
    }
    
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));
    
    // רק בעלים יכול להוסיף משתתפים
    if (project.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized to add collaborators', 403));
    }
    
    // בדיקה שהמשתמש כבר לא משתתף
    const exists = project.collaborators.some(
      c => c.userId.toString() === userId
    );
    
    if (exists) {
      return next(new AppError('User is already a collaborator', 400));
    }
    
    // בדיקה שהמשתמש קיים במערכת
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    
    // הוספת המשתתף
    project.collaborators.push({
      userId,
      role,
      addedAt: new Date()
    });
    
    await project.save();
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

// 12. הסרת משתתף מפרויקט
export const removeCollaborator = async (req, res, next) => {
  try {
    const { collaboratorId } = req.params;
    
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));
    
    // רק בעלים יכול להסיר משתתפים
    if (project.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized to remove collaborators', 403));
    }
    
    // הסרת המשתתף
    project.collaborators.pull({ _id: collaboratorId });
    await project.save();
    
    res.json(project);
  } catch (err) {
    next(err);
  }
};

// 13. עדכון הרשאות משתתף
export const updateCollaboratorRole = async (req, res, next) => {
  try {
    const { collaboratorId } = req.params;
    const { role } = req.body;
    
    if (!['view', 'edit'].includes(role)) {
      return next(new AppError('Invalid role', 400));
    }
    
    const project = await Project.findById(req.params.id);
    if (!project) return next(new AppError('Project not found', 404));
    
    // רק בעלים יכול לשנות הרשאות
    if (project.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized to change roles', 403));
    }
    
    const collaborator = project.collaborators.id(collaboratorId);
    if (!collaborator) {
      return next(new AppError('Collaborator not found', 404));
    }
    
    collaborator.role = role;
    await project.save();
    
    res.json(project);
  } catch (err) {
    next(err);
  }
};