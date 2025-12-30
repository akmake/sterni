import Project from '../models/Project.js';
import AppError from '../utils/AppError.js';

// --- Helper: Validate Ownership ---
const assertProjectOwner = (project, userId) => {
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  if (project.owner.toString() !== userId) {
    throw new AppError('Not authorized to access this project', 403);
  }
};

// --- CRUD Operations ---

// 1. קבלת כל הפרויקטים של המשתמש
export const getProjects = async (req, res, next) => {
  try {
    // ממיינים לפי תאריך יצירה יורד (הכי חדש למעלה)
    const projects = await Project.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    next(err);
  }
};

// 2. קבלת פרויקט ספציפי
export const getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return next(new AppError('Project not found', 404));
    res.json(project);
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
      owner: req.user.id,
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

// 4. עדכון פרטי פרויקט (שם/תיאור)
export const updateProject = async (req, res, next) => {
  try {
    const { projectName, description, dueDate } = req.body;
    
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      { projectName, description, dueDate },
      { new: true, runValidators: true }
    );

    if (!project) return next(new AppError('Project not found', 404));

    res.json(project);
  } catch (err) {
    next(err);
  }
};

// 5. מחיקת פרויקט (הפונקציה שהייתה חסרה לך!)
export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    
    if (!project) return next(new AppError('Project not found', 404));

    res.status(204).send(); // 204 No Content
  } catch (err) {
    next(err);
  }
};

// --- Task Operations ---

// 6. הוספת משימה
export const addTask = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return next(new AppError('Project not found', 404));

    const { name } = req.body;
    if (!name) return next(new AppError('Task name is required', 400));

    project.tasks.push({ name, done: false });
    await project.save();
    
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

// 7. שינוי סטטוס משימה (בוצע/לא בוצע)
export const toggleTask = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return next(new AppError('Project not found', 404));

    const task = project.tasks.id(req.params.taskId);
    if (!task) return next(new AppError('Task not found', 404));

    task.done = !task.done;
    await project.save();

    res.json(project);
  } catch (err) {
    next(err);
  }
};

// 8. מחיקת משימה
export const deleteTask = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) return next(new AppError('Project not found', 404));

    // שימוש ב-pull להסרת תת-מסמך ממערך
    project.tasks.pull({ _id: req.params.taskId });
    await project.save();

    res.json(project);
  } catch (err) {
    next(err);
  }
};

// 9. הטוויסט: המרת משימה לפרויקט חדש
export const convertTaskToProject = async (req, res, next) => {
    try {
        const { id, taskId } = req.params;
        
        // 1. מוצאים את הפרויקט המקורי
        const originalProject = await Project.findOne({ _id: id, owner: req.user.id });
        if(!originalProject) return next(new AppError('Project not found', 404));

        // 2. מוצאים את המשימה
        const task = originalProject.tasks.id(taskId);
        if(!task) return next(new AppError('Task not found', 404));

        // 3. יוצרים פרויקט חדש על בסיס המשימה
        const newProject = new Project({
            owner: req.user.id,
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

    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
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

    const project = await Project.findOne({ _id: id, owner: req.user.id });
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