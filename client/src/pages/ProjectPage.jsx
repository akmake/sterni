import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import useProjectsStore from '@/stores/projectsStore';
import api from '@/utils/api';
import ActionMenu from '@/components/ui/ActionMenu';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/checkbox';
import ProjectSharingModal from '@/components/ProjectSharingModal';
import {
    Trash2,
    ArrowUpRight,
    Paperclip,
    Plus,
    FileText,
    Download,
    UploadCloud,
    X, 
    Play,
    Share2,
    Pencil,
    Check as CheckIcon
} from 'lucide-react';

// כתובת השרת לתמונות - ודא שזה תואם לשרת שלך
const SERVER_URL = import.meta.env.DEV 
  ? 'http://localhost:5000' 
  : '';
export default function ProjectPage() {
  const { id } = useParams();
  const { 
      activeProject, 
      fetchProject, 
      updateProject,
      addTask, 
      toggleTask, 
      deleteTask, 
      renameTask,
      convertTaskToProject,
      uploadFileToProject,
      deleteFileFromProject
  } = useProjectsStore();

  const [newTaskName, setNewTaskName] = useState('');
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  // --- Inline editing state ---
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskValue, setEditTaskValue] = useState('');
  const nameInputRef = useRef(null);
  const descInputRef = useRef(null);
  const taskInputRef = useRef(null);

  useEffect(() => { fetchProject(id); }, [id]);

  // נפתח מהתראה / מהרשימה — פרויקט שהוקצו לי מסומן כנראה (עוצר תזכורות; השרת מסנן לבעלים בלבד)
  useEffect(() => {
    if (id) api.post('/projects/seen', { ids: [id] }).catch(() => {});
  }, [id]);

  if (!activeProject) return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center text-slate-400">
          טוען פרויקט...
      </div>
  );

  const totalTasks = activeProject.tasks.length;
  const completedTasks = activeProject.tasks.filter(t => t.done).length;
  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // --- Handlers ---
  const handleAddTask = (e) => {
      e.preventDefault();
      if(!newTaskName.trim()) return;
      addTask(id, { name: newTaskName });
      setNewTaskName('');
  };

  const handleConvert = (taskId) => {
      if(window.confirm('האם להפוך משימה זו לפרויקט חדש? המשימה תוסר מכאן.')) {
          convertTaskToProject(id, taskId);
      }
  };

  // --- Inline editing handlers ---
  const startEditName = () => {
    setEditNameValue(activeProject.projectName);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };
  const saveName = () => {
    const val = editNameValue.trim();
    if (val && val !== activeProject.projectName) {
      updateProject(id, { projectName: val });
    }
    setEditingName(false);
  };
  const startEditDesc = () => {
    setEditDescValue(activeProject.description || '');
    setEditingDesc(true);
    setTimeout(() => descInputRef.current?.focus(), 50);
  };
  const saveDesc = () => {
    const val = editDescValue.trim();
    if (val !== (activeProject.description || '')) {
      updateProject(id, { description: val });
    }
    setEditingDesc(false);
  };
  const startEditTask = (task) => {
    setEditingTaskId(task._id);
    setEditTaskValue(task.name);
    setTimeout(() => taskInputRef.current?.focus(), 50);
  };
  const saveTaskName = () => {
    const val = editTaskValue.trim();
    if (val && editingTaskId) {
      renameTask(id, editingTaskId, val);
    }
    setEditingTaskId(null);
    setEditTaskValue('');
  };

  const handleFileSelect = (e) => {
      const file = e.target.files[0];
      if (file) {
          uploadFileToProject(activeProject._id, file);
      }
  };

  const handleDeleteFile = (e, fileId) => {
      e.preventDefault(); 
      e.stopPropagation(); // מונע מהקובץ להיפתח כשלוחצים על מחיקה
      if(window.confirm('האם למחוק את הקובץ לצמיתות?')) {
          deleteFileFromProject(activeProject._id, fileId);
      }
  };

  // --- File Render Logic ---
  const renderFilePreview = (file) => {
    const isImage = file.type?.startsWith('image/');
    const isVideo = file.type?.startsWith('video/');
    
    // בניית כתובת מלאה לקובץ
    const fileUrl = `${SERVER_URL}${file.url}`;

    // כפתור מחיקה (משותף לכולם)
    const DeleteButton = () => (
        <button 
            onClick={(e) => handleDeleteFile(e, file._id)}
            className="absolute top-2 right-2 bg-white/90 text-red-500 hover:text-red-600 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-all z-20 hover:bg-red-50"
            title="מחק קובץ"
        >
            <X size={14} strokeWidth={3} />
        </button>
    );

    // 1. תצוגת תמונה
    if (isImage) {
        return (
            <div className="relative group w-full h-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <img 
                    src={fileUrl} 
                    alt={file.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                />
                <DeleteButton />
                {/* Overlay להורדה */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity hidden [@media(hover:hover)]:flex items-center justify-center">
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="text-white hover:scale-110 transition-transform bg-white/20 p-2 rounded-full backdrop-blur-sm">
                        <Download size={20} />
                    </a>
                </div>
            </div>
        );
    }

    // 2. תצוגת וידאו
    if (isVideo) {
        return (
            <div className="relative group w-full h-36 bg-black rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <video 
                    src={fileUrl} 
                    controls 
                    className="w-full h-full object-cover" 
                />
                <DeleteButton />
            </div>
        );
    }

    // 3. תצוגת מסמך (ברירת מחדל)
    return (
        <div className="relative group h-36">
            <a 
                href={fileUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="flex flex-col items-center justify-center w-full h-full bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-all p-4 text-center shadow-sm hover:shadow-md"
            >
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                </div>
                <span className="text-xs font-semibold text-slate-700 truncate w-full px-2 dir-ltr">
                    {file.name}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                    {new Date(file.uploadedAt).toLocaleDateString('he-IL')}
                </span>
            </a>
            <DeleteButton />
        </div>
    );
  };

  return (
    <div className="min-h-full bg-[#F5F5F7] px-4 pt-4 pb-28 md:p-8 font-sans text-slate-800 dir-rtl">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-8">

        {/* --- Header Section --- */}
        <div className="bg-white/80 backdrop-blur-xl p-5 md:p-8 rounded-3xl md:rounded-[2rem] shadow-sm border border-white/50 relative overflow-hidden">
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 md:gap-6">
                <div className="flex-1 min-w-0">
                    {editingName ? (
                      <input
                        ref={nameInputRef}
                        value={editNameValue}
                        onChange={e => setEditNameValue(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                        className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight bg-transparent border-b-2 border-blue-500 outline-none w-full"
                      />
                    ) : (
                      <h1 
                        className="text-[26px] md:text-4xl font-bold tracking-tight text-slate-900 leading-tight break-words group/name cursor-pointer"
                        onClick={startEditName}
                        title="לחץ לעריכה"
                      >
                        {activeProject.projectName}
                        <Pencil size={16} className="inline mr-2 opacity-0 group-hover/name:opacity-50 transition-opacity text-slate-400" />
                      </h1>
                    )}
                    {editingDesc ? (
                      <input
                        ref={descInputRef}
                        value={editDescValue}
                        onChange={e => setEditDescValue(e.target.value)}
                        onBlur={saveDesc}
                        onKeyDown={e => { if (e.key === 'Enter') saveDesc(); if (e.key === 'Escape') setEditingDesc(false); }}
                        placeholder="הוסף תיאור..."
                        className="text-slate-500 mt-2 text-lg font-light bg-transparent border-b-2 border-blue-500 outline-none w-full"
                      />
                    ) : (
                      <p 
                        className="text-slate-500 mt-2 text-[15px] md:text-lg font-light whitespace-pre-wrap break-words group/desc cursor-pointer"
                        onClick={startEditDesc}
                        title="לחץ לעריכה"
                      >
                        {activeProject.description || 'אין תיאור לפרויקט זה'}
                        <Pencil size={14} className="inline mr-2 opacity-0 group-hover/desc:opacity-50 transition-opacity text-slate-400" />
                      </p>
                    )}
                </div>

                <div className="flex flex-row-reverse md:flex-row items-center gap-3">
                    <Button
                        onClick={() => setSharingModalOpen(true)}
                        className="shrink-0 flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-4 h-12 md:h-auto md:py-2 rounded-xl md:rounded-lg transition"
                    >
                        <Share2 size={18} />
                        שתף
                    </Button>

                    {/* Progress Widget */}
                    <div className="flex-1 md:flex-none bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 md:min-w-[200px]">
                        <div className="relative w-14 h-14 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="28" cy="28" r="24" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                                <circle cx="28" cy="28" r="24" stroke="#1e293b" strokeWidth="6" fill="transparent"
                                    strokeDasharray={150.7}
                                    strokeDashoffset={150.7 - (150.7 * progress) / 100}
                                    className="transition-all duration-1000 ease-out"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute text-xs font-bold">{progress}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">התקדמות</span>
                            <span className="font-bold text-slate-800 text-lg">
                                {completedTasks} <span className="text-slate-400 text-sm font-normal">/ {totalTasks}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

          {/* --- Left Column: Tasks (8/12) --- */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Add Task Input */}
            <div className="bg-white p-2 pl-3 rounded-2xl shadow-sm border border-slate-100 focus-within:ring-2 ring-slate-900/5 transition-shadow">
                <form onSubmit={handleAddTask} className="flex items-center gap-2">
                    <div className="bg-slate-900 rounded-xl p-2.5 text-white shadow-lg shadow-slate-900/20">
                        <Plus size={20} />
                    </div>
                    <Input
                        value={newTaskName}
                        onChange={e => setNewTaskName(e.target.value)}
                        placeholder="מה המשימה הבאה שלך?"
                        className="border-none shadow-none focus-visible:ring-0 bg-transparent text-[16px] md:text-lg h-12 placeholder:text-slate-400 w-full min-w-0"
                    />
                    <Button type="submit" size="sm" className="shrink-0 rounded-xl px-4 md:px-6 bg-slate-100 text-slate-900 hover:bg-slate-200 font-bold">
                        הוסף
                    </Button>
                </form>
            </div>

            {/* Task List */}
            <div className="space-y-3">
                {activeProject.tasks.length === 0 && (
                    <div className="text-center py-12 bg-white/50 rounded-3xl border border-dashed border-slate-200">
                        <div className="inline-flex bg-slate-100 p-4 rounded-full mb-3 text-slate-400">
                            <Plus size={24} />
                        </div>
                        <p className="text-slate-500">עדיין אין משימות. זה הזמן להתחיל!</p>
                    </div>
                )}

                {activeProject.tasks.map(task => (
                    <div key={task._id} className="group relative bg-white md:hover:bg-slate-50 pr-4 pl-1.5 py-3 rounded-2xl transition-all duration-200 border border-slate-100/80 md:border-transparent md:hover:border-slate-200 shadow-sm flex items-start gap-2">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                            <Checkbox
                                checked={task.done}
                                onCheckedChange={() => toggleTask(id, task._id)}
                                className="shrink-0 mt-0.5 w-6 h-6 rounded-lg border-2 border-slate-300 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 transition-all"
                            />
                            {editingTaskId === task._id ? (
                              <input
                                ref={taskInputRef}
                                value={editTaskValue}
                                onChange={e => setEditTaskValue(e.target.value)}
                                onBlur={saveTaskName}
                                onKeyDown={e => { if (e.key === 'Enter') saveTaskName(); if (e.key === 'Escape') { setEditingTaskId(null); } }}
                                className="text-[16px] md:text-lg flex-1 min-w-0 bg-transparent border-b-2 border-blue-500 outline-none"
                              />
                            ) : (
                              <span 
                                className={`flex-1 min-w-0 text-[16px] md:text-lg leading-relaxed whitespace-pre-wrap break-words transition-all select-none cursor-pointer ${task.done ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'}`}
                                onDoubleClick={() => startEditTask(task)}
                                title="לחיצה כפולה לעריכה"
                              >
                                {task.name}
                              </span>
                            )}
                        </div>

                        {/* Task Actions — תפריט ⋮ אחד (גם במובייל, במקום כפתורים שמופיעים רק ב-hover) */}
                        <ActionMenu items={[
                            { label: 'עריכה', icon: Pencil, onClick: () => startEditTask(task) },
                            { label: 'הפוך לפרויקט חדש', icon: ArrowUpRight, onClick: () => handleConvert(task._id) },
                            { label: 'מחיקה', icon: Trash2, onClick: () => deleteTask(id, task._id), danger: true, separatorBefore: true },
                        ]} />
                    </div>
                ))}
            </div>
          </div>

          {/* --- Right Column: Files & Gallery (4/12) --- */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/80 backdrop-blur-md p-5 md:p-6 rounded-3xl md:rounded-[2rem] border border-white/60 h-full flex flex-col shadow-sm">
                
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Paperclip size={20} className="text-blue-500"/> 
                        קבצים ומדיה
                    </h3>
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">
                        {activeProject.files?.length || 0}
                    </span>
                </div>

                {/* Upload Area */}
                <div 
                    onClick={() => fileInputRef.current.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 bg-slate-50 rounded-2xl p-5 md:p-8 text-center cursor-pointer transition-all duration-300 group mb-6 flex flex-col items-center justify-center gap-3"
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileSelect} 
                    />
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:border-blue-200 transition-all">
                        <UploadCloud className="text-slate-400 group-hover:text-blue-500" /> 
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-700">העלאת קובץ</p>
                        <p className="text-xs text-slate-400">תמונות, וידאו ומסמכים</p>
                    </div>
                </div>

                {/* Gallery Grid */}
                <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[600px] custom-scrollbar pr-1 pb-2">
                    {activeProject.files?.length > 0 ? (
                        activeProject.files.map((file, index) => (
                            <div key={file._id || index}>
                                {renderFilePreview(file)}
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-10 text-slate-400 text-sm bg-slate-50/50 rounded-xl">
                            הגלריה ריקה
                        </div>
                    )}
                </div>
            </div>
          </div>

        </div>
      </div>

      <ProjectSharingModal 
        projectId={id}
        isOpen={sharingModalOpen}
        onClose={() => setSharingModalOpen(false)}
        onUpdate={() => fetchProject(id)}
      />
    </div>
  );
}