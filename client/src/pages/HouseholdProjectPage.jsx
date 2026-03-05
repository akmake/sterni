import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trash2, Plus, Paperclip, FileText, Download,
  UploadCloud, X, Pencil, Banknote, Target, CheckSquare, Users
} from 'lucide-react';
import useHouseholdProjectStore from '@/stores/householdProjectStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/checkbox';
import ProjectSharingModal from '@/components/ProjectSharingModal';

const SERVER_URL = import.meta.env.DEV ? 'http://localhost:5000' : '';

export default function HouseholdProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    activeProject: project, fetchProject, loading, error,
    updateProject, deleteProject,
    addFund, updateFund, deleteFund,
    addTask, toggleTask, deleteTask, renameTask,
    uploadFileToProject, deleteFileFromProject,
    setupSocketListeners, cleanupSocketListeners,
  } = useHouseholdProjectStore();

  const [fundAmount, setFundAmount] = useState('');
  const [fundDestination, setFundDestination] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [taskAmount, setTaskAmount] = useState('');
  const fileInputRef = useRef(null);

  // Inline editing
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskValue, setEditTaskValue] = useState('');
  const [editTaskAmountValue, setEditTaskAmountValue] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);
  const [editTargetValue, setEditTargetValue] = useState('');
  const [editingFundId, setEditingFundId] = useState(null);
  const [editFundAmount, setEditFundAmount] = useState('');
  const [editFundDest, setEditFundDest] = useState('');
  const nameInputRef = useRef(null);
  const descInputRef = useRef(null);
  const taskInputRef = useRef(null);
  const targetInputRef = useRef(null);
  const fundAmountRef = useRef(null);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);

  useEffect(() => {
    fetchProject(id);
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, [id]);

  if (loading && !project) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center text-slate-400">
        טוען פרויקט...
      </div>
    );
  }
  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center gap-4">
        <p className="text-red-600">{error || 'פרויקט לא נמצא'}</p>
        <Button variant="outline" onClick={() => navigate('/household/projects')}>חזרה לפרויקטים</Button>
      </div>
    );
  }

  const isGoal = project.projectType === 'goal';
  const isTask = project.projectType === 'task';
  const isSimple = project.projectType === 'simple';
  const hasTasks = isTask || isSimple;

  // Progress
  let progress = 0;
  let completedTasks = 0;
  let totalTasks = 0;
  if (isGoal) {
    progress = project.targetAmount > 0
      ? Math.min(100, Math.round((project.currentAmount / project.targetAmount) * 100))
      : 0;
  } else {
    totalTasks = project.tasks?.length || 0;
    completedTasks = project.tasks?.filter(t => t.done).length || 0;
    progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  }

  // --- Handlers ---
  const handleDelete = async () => {
    if (window.confirm('האם למחוק את הפרויקט לצמיתות?')) {
      await deleteProject(id);
      navigate('/household/projects');
    }
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    addTask(id, { name: newTaskName, amount: isTask ? (Number(taskAmount) || 0) : 0 });
    setNewTaskName('');
    setTaskAmount('');
  };

  const handleAddFund = (e) => {
    e.preventDefault();
    if (!fundAmount || Number(fundAmount) <= 0) return;
    addFund(id, { amount: Number(fundAmount), destination: fundDestination || undefined });
    setFundAmount('');
    setFundDestination('');
  };

  // Inline edit handlers
  const startEditName = () => {
    setEditNameValue(project.projectName);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };
  const saveName = () => {
    const val = editNameValue.trim();
    if (val && val !== project.projectName) updateProject(id, { projectName: val });
    setEditingName(false);
  };
  const startEditDesc = () => {
    setEditDescValue(project.description || '');
    setEditingDesc(true);
    setTimeout(() => descInputRef.current?.focus(), 50);
  };
  const saveDesc = () => {
    const val = editDescValue.trim();
    if (val !== (project.description || '')) updateProject(id, { description: val });
    setEditingDesc(false);
  };

  // Target amount editing (goal projects)
  const startEditTarget = () => {
    setEditTargetValue(String(project.targetAmount || ''));
    setEditingTarget(true);
    setTimeout(() => targetInputRef.current?.focus(), 50);
  };
  const saveTarget = () => {
    const val = Number(editTargetValue);
    if (val > 0 && val !== project.targetAmount) updateProject(id, { targetAmount: val });
    setEditingTarget(false);
  };

  // Task editing (name + amount)
  const startEditTask = (task) => {
    setEditingTaskId(task._id);
    setEditTaskValue(task.name);
    setEditTaskAmountValue(String(task.amount || ''));
    setTimeout(() => taskInputRef.current?.focus(), 50);
  };
  const saveTask = () => {
    if (!editingTaskId) return;
    const name = editTaskValue.trim();
    const amount = Number(editTaskAmountValue) || 0;
    if (name) renameTask(id, editingTaskId, { name, amount });
    setEditingTaskId(null);
    setEditTaskValue('');
    setEditTaskAmountValue('');
  };

  // Fund editing
  const startEditFund = (fund) => {
    setEditingFundId(fund._id);
    setEditFundAmount(String(fund.amount || ''));
    setEditFundDest(fund.destination || '');
    setTimeout(() => fundAmountRef.current?.focus(), 50);
  };
  const saveFund = () => {
    if (!editingFundId) return;
    const amount = Number(editFundAmount);
    if (amount > 0) updateFund(id, editingFundId, { amount, destination: editFundDest });
    setEditingFundId(null);
  };
  const handleDeleteFund = (fundId) => {
    if (window.confirm('למחוק הפקדה זו?')) deleteFund(id, fundId);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) uploadFileToProject(project._id, file);
  };
  const handleDeleteFile = (e, fileId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('האם למחוק את הקובץ לצמיתות?')) deleteFileFromProject(project._id, fileId);
  };

  // File preview renderer
  const renderFilePreview = (file) => {
    const isImage = file.type?.startsWith('image/');
    const isVideo = file.type?.startsWith('video/');
    const fileUrl = `${SERVER_URL}${file.url}`;

    const DeleteButton = () => (
      <button
        onClick={(e) => handleDeleteFile(e, file._id)}
        className="absolute top-2 right-2 bg-white/90 text-red-500 hover:text-red-600 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20 hover:bg-red-50"
        title="מחק קובץ"
      >
        <X size={14} strokeWidth={3} />
      </button>
    );

    if (isImage) {
      return (
        <div className="relative group w-full h-36 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <img src={fileUrl} alt={file.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <DeleteButton />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <a href={fileUrl} target="_blank" rel="noreferrer" className="text-white hover:scale-110 transition-transform bg-white/20 p-2 rounded-full backdrop-blur-sm">
              <Download size={20} />
            </a>
          </div>
        </div>
      );
    }
    if (isVideo) {
      return (
        <div className="relative group w-full h-36 bg-black rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <video src={fileUrl} controls className="w-full h-full object-cover" />
          <DeleteButton />
        </div>
      );
    }
    return (
      <div className="relative group h-36">
        <a href={fileUrl} target="_blank" rel="noreferrer"
          className="flex flex-col items-center justify-center w-full h-full bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 transition-all p-4 text-center shadow-sm hover:shadow-md">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <FileText size={24} />
          </div>
          <span className="text-xs font-semibold text-slate-700 truncate w-full px-2 dir-ltr">{file.name}</span>
          <span className="text-[10px] text-slate-400 mt-1">{new Date(file.uploadedAt).toLocaleDateString('he-IL')}</span>
        </a>
        <DeleteButton />
      </div>
    );
  };

  // Type badge
  const typeBadge = isGoal
    ? { label: 'יעד כספי', cls: 'bg-blue-100 text-blue-700' }
    : isTask
      ? { label: 'משימות + ₪', cls: 'bg-emerald-100 text-emerald-700' }
      : { label: 'משימות', cls: 'bg-indigo-100 text-indigo-700' };

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-4 md:p-8 font-sans text-slate-800 dir-rtl">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">

        {/* --- Header Section --- */}
        <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-sm border border-white/50 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
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
                <div className="flex items-center gap-3">
                  <h1
                    className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight group/name cursor-pointer"
                    onClick={startEditName}
                    title="לחץ לעריכה"
                  >
                    {project.projectName}
                    <Pencil size={16} className="inline mr-2 opacity-0 group-hover/name:opacity-50 transition-opacity text-slate-400" />
                  </h1>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${typeBadge.cls}`}>
                    {typeBadge.label}
                  </span>
                </div>
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
                  className="text-slate-500 mt-2 text-lg font-light group/desc cursor-pointer"
                  onClick={startEditDesc}
                  title="לחץ לעריכה"
                >
                  {project.description || 'אין תיאור לפרויקט זה'}
                  <Pencil size={14} className="inline mr-2 opacity-0 group-hover/desc:opacity-50 transition-opacity text-slate-400" />
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Share */}
              <Button
                onClick={() => setSharingModalOpen(true)}
                variant="outline"
                className="text-blue-500 border-blue-200 hover:bg-blue-50 hover:text-blue-600 rounded-lg"
              >
                <Users size={18} className="ml-1" />
                שתף
              </Button>

              {/* Delete */}
              <Button
                onClick={handleDelete}
                variant="outline"
                className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 rounded-lg"
              >
                <Trash2 size={18} className="ml-1" />
                מחק
              </Button>

              {/* Progress Widget */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 min-w-[200px]">
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
                  {isGoal ? (
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-800 text-lg">
                        {project.currentAmount.toLocaleString()}
                      </span>
                      <span className="text-slate-400 text-sm font-normal">/</span>
                      {editingTarget ? (
                        <input
                          ref={targetInputRef}
                          type="number"
                          value={editTargetValue}
                          onChange={e => setEditTargetValue(e.target.value)}
                          onBlur={saveTarget}
                          onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditingTarget(false); }}
                          className="w-24 text-sm font-bold bg-transparent border-b-2 border-blue-500 outline-none text-slate-800"
                        />
                      ) : (
                        <span
                          className="text-slate-400 text-sm font-normal cursor-pointer hover:text-blue-500 group/target transition-colors"
                          onClick={startEditTarget}
                          title="לחץ לעריכת יעד"
                        >
                          {project.targetAmount.toLocaleString()} ₪
                          <Pencil size={10} className="inline mr-1 opacity-0 group-hover/target:opacity-100 transition-opacity" />
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="font-bold text-slate-800 text-lg">
                      {completedTasks} <span className="text-slate-400 text-sm font-normal">/ {totalTasks}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

          {/* --- Left Column: Content (8/12) --- */}
          <div className="lg:col-span-8 space-y-6">

            {/* Goal type — Funds section */}
            {isGoal && (
              <div className="bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-white/60 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Banknote size={20} className="text-blue-500" />
                  הפקדות
                </h3>
                <form onSubmit={handleAddFund} className="flex items-center gap-2">
                  <div className="bg-slate-900 rounded-xl p-2.5 text-white shadow-lg shadow-slate-900/20">
                    <Plus size={20} />
                  </div>
                  <Input
                    type="number" placeholder="סכום" value={fundAmount}
                    onChange={e => setFundAmount(e.target.value)}
                    className="border-none shadow-none focus-visible:ring-0 bg-transparent text-lg h-12 placeholder:text-slate-400 flex-1"
                    required
                  />
                  <Input
                    placeholder="יעד/מקור (אופציונלי)" value={fundDestination}
                    onChange={e => setFundDestination(e.target.value)}
                    className="border-none shadow-none focus-visible:ring-0 bg-transparent text-lg h-12 placeholder:text-slate-400 flex-1"
                  />
                  <Button type="submit" size="sm" className="rounded-xl px-6 bg-slate-100 text-slate-900 hover:bg-slate-200 font-bold">
                    הוסף
                  </Button>
                </form>
                {project.funds && project.funds.length > 0 ? (
                  <div className="space-y-2">
                    {[...project.funds].reverse().map((fund, idx) => (
                      <div key={fund._id || idx} className="group flex justify-between items-center p-4 bg-white rounded-2xl border border-transparent hover:border-slate-200 shadow-sm transition-all">
                        {editingFundId === fund._id ? (
                          <div className="flex-1 flex items-center gap-3">
                            <input
                              ref={fundAmountRef}
                              type="number"
                              value={editFundAmount}
                              onChange={e => setEditFundAmount(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveFund(); if (e.key === 'Escape') setEditingFundId(null); }}
                              className="w-28 text-lg font-bold bg-transparent border-b-2 border-blue-500 outline-none"
                              placeholder="סכום"
                            />
                            <span className="text-slate-400">₪</span>
                            <input
                              value={editFundDest}
                              onChange={e => setEditFundDest(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveFund(); if (e.key === 'Escape') setEditingFundId(null); }}
                              className="flex-1 text-sm bg-transparent border-b-2 border-blue-500 outline-none"
                              placeholder="יעד/מקור"
                            />
                            <button onClick={saveFund} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg font-bold hover:bg-blue-700">שמור</button>
                            <button onClick={() => setEditingFundId(null)} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-lg hover:bg-slate-200">ביטול</button>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="font-bold text-slate-800 text-lg">{fund.amount.toLocaleString()} ₪</p>
                              {fund.destination && <p className="text-xs text-slate-500">{fund.destination}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">{new Date(fund.date).toLocaleDateString('he-IL')}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => startEditFund(fund)} title="ערוך"
                                  className="p-1.5 rounded-lg text-slate-300 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDeleteFund(fund._id)} title="מחק"
                                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-white/50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-500">עדיין אין הפקדות</p>
                  </div>
                )}
              </div>
            )}

            {/* Task/Simple type — Task list */}
            {hasTasks && (
              <>
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
                      className="border-none shadow-none focus-visible:ring-0 bg-transparent text-lg h-12 placeholder:text-slate-400 flex-1"
                    />
                    {isTask && (
                      <Input
                        type="number" value={taskAmount}
                        onChange={e => setTaskAmount(e.target.value)}
                        placeholder="עלות ₪"
                        className="border-none shadow-none focus-visible:ring-0 bg-transparent text-lg h-12 placeholder:text-slate-400 w-24"
                      />
                    )}
                    <Button type="submit" size="sm" className="rounded-xl px-6 bg-slate-100 text-slate-900 hover:bg-slate-200 font-bold">
                      הוסף
                    </Button>
                  </form>
                </div>

                {/* Task List */}
                <div className="space-y-3">
                  {(!project.tasks || project.tasks.length === 0) && (
                    <div className="text-center py-12 bg-white/50 rounded-3xl border border-dashed border-slate-200">
                      <div className="inline-flex bg-slate-100 p-4 rounded-full mb-3 text-slate-400">
                        <Plus size={24} />
                      </div>
                      <p className="text-slate-500">עדיין אין משימות. זה הזמן להתחיל!</p>
                    </div>
                  )}

                  {project.tasks?.map(task => (
                    <div key={task._id} className="group relative bg-white hover:bg-slate-50 p-4 rounded-2xl transition-all duration-200 border border-transparent hover:border-slate-200 shadow-sm hover:shadow-md flex items-center justify-between">
                      <div className="flex items-center gap-4 overflow-hidden flex-1">
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={() => toggleTask(id, task._id)}
                          className={`w-6 h-6 rounded-lg border-2 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 transition-all ${task.done ? 'border-slate-300' : 'border-slate-300'}`}
                        />
                        {editingTaskId === task._id ? (
                          <div className="flex items-center gap-3 flex-1">
                            <input
                              ref={taskInputRef}
                              value={editTaskValue}
                              onChange={e => setEditTaskValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveTask(); if (e.key === 'Escape') setEditingTaskId(null); }}
                              className="text-lg flex-1 bg-transparent border-b-2 border-blue-500 outline-none"
                              placeholder="שם משימה"
                            />
                            {isTask && (
                              <input
                                type="number"
                                value={editTaskAmountValue}
                                onChange={e => setEditTaskAmountValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveTask(); if (e.key === 'Escape') setEditingTaskId(null); }}
                                className="w-24 text-sm bg-transparent border-b-2 border-blue-500 outline-none text-center"
                                placeholder="₪ סכום"
                              />
                            )}
                            <button onClick={saveTask} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg font-bold hover:bg-blue-700 shrink-0">שמור</button>
                            <button onClick={() => setEditingTaskId(null)} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-lg hover:bg-slate-200 shrink-0">ביטול</button>
                          </div>
                        ) : (
                          <>
                            <span
                              className={`text-lg truncate transition-all select-none cursor-pointer ${task.done ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'}`}
                              onDoubleClick={() => startEditTask(task)}
                              title="לחיצה כפולה לעריכה"
                            >
                              {task.name}
                            </span>
                            {isTask && task.amount > 0 && (
                              <span
                                className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0 cursor-pointer hover:bg-amber-100 hover:text-amber-700 transition-colors"
                                onClick={() => startEditTask(task)}
                                title="לחץ לעריכת סכום"
                              >
                                {task.amount.toLocaleString()} ₪
                              </span>
                            )}
                            {isTask && (!task.amount || task.amount === 0) && (
                              <span
                                className="text-[10px] text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full shrink-0 cursor-pointer hover:bg-amber-50 hover:text-amber-500 transition-colors"
                                onClick={() => startEditTask(task)}
                                title="לחץ להגדרת סכום"
                              >
                                + סכום
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Task Actions */}
                      {editingTaskId !== task._id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 pl-2">
                          <Button variant="ghost" size="icon" onClick={() => startEditTask(task)} title="ערוך"
                            className="w-9 h-9 rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                            <Pencil size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteTask(id, task._id)} title="מחק משימה"
                            className="w-9 h-9 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50">
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* --- Right Column: Files & Gallery (4/12) --- */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-white/60 h-full flex flex-col shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Paperclip size={20} className="text-blue-500" />
                  קבצים ומדיה
                </h3>
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">
                  {project.files?.length || 0}
                </span>
              </div>

              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 bg-slate-50 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 group mb-6 flex flex-col items-center justify-center gap-3"
              >
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
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
                {project.files?.length > 0 ? (
                  project.files.map((file, index) => (
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

      {/* Sharing Modal */}
      <ProjectSharingModal
        projectId={id}
        isOpen={sharingModalOpen}
        onClose={() => setSharingModalOpen(false)}
        onUpdate={() => fetchProject(id)}
        apiBase="/household-projects"
      />
    </div>
  );
}
