import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Loader2, Trash2, Plus, Target,
  CheckSquare, Banknote, Calendar, Edit2, Save, X
} from 'lucide-react';
import useHouseholdProjectStore from '@/stores/householdProjectStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';

export default function HouseholdProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    activeProject: project, fetchProject, loading, error,
    deleteProject, addFund, addTask, toggleTask, deleteTask,
    setupSocketListeners, cleanupSocketListeners
  } = useHouseholdProjectStore();

  const [fundAmount, setFundAmount] = useState('');
  const [fundDestination, setFundDestination] = useState('');
  const [taskName, setTaskName] = useState('');
  const [taskAmount, setTaskAmount] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetchProject(id);
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, [id, fetchProject]);

  useEffect(() => {
    if (project) {
      setEditName(project.projectName);
      setEditDescription(project.description || '');
    }
  }, [project]);

  const percentage = project && project.targetAmount > 0
    ? Math.min(100, Math.round((project.currentAmount / project.targetAmount) * 100))
    : 0;

  async function handleAddFund(e) {
    e.preventDefault();
    if (!fundAmount || Number(fundAmount) <= 0) return;
    await addFund(id, { amount: Number(fundAmount), destination: fundDestination || undefined });
    setFundAmount('');
    setFundDestination('');
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!taskName.trim()) return;
    await addTask(id, { name: taskName.trim(), amount: taskAmount ? Number(taskAmount) : 0 });
    setTaskName('');
    setTaskAmount('');
  }

  async function handleSaveEdit() {
    const { updateProject } = useHouseholdProjectStore.getState();
    await updateProject(id, { projectName: editName, description: editDescription });
    setIsEditing(false);
  }

  async function handleDelete() {
    await deleteProject(id);
    navigate('/household/projects');
  }

  if (loading && !project) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center gap-4">
        <p className="text-red-600">שגיאה: {error}</p>
        <Button variant="outline" onClick={() => fetchProject(id)}>נסה שוב</Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">פרויקט לא נמצא</p>
        <Button variant="outline" asChild>
          <Link to="/household/projects">חזרה לפרויקטים</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Back + Actions */}
        <div className="flex justify-between items-center">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/household/projects">
              <ArrowRight className="me-1 h-4 w-4" />
              חזרה
            </Link>
          </Button>
          <div className="flex gap-2">
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="me-1 h-4 w-4" />
                עריכה
              </Button>
            )}
            {!confirmDelete ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="me-1 h-4 w-4" />
                מחק
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="destructive" size="sm" onClick={handleDelete}>אישור מחיקה</Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>ביטול</Button>
              </div>
            )}
          </div>
        </div>

        {/* Project Header */}
        <Card className="rounded-2xl">
          <CardHeader>
            {isEditing ? (
              <div className="space-y-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-2xl font-bold border-b-2 border-blue-400 bg-transparent focus:outline-none pb-1"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full text-sm text-gray-600 border rounded-lg p-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="תיאור הפרויקט..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Save className="me-1 h-4 w-4" />
                    שמור
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="me-1 h-4 w-4" />
                    ביטול
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl">{project.projectName}</CardTitle>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    project.projectType === 'goal'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {project.projectType === 'goal' ? 'יעד' : 'משימות'}
                  </span>
                </div>
                {project.description && (
                  <p className="text-gray-500 mt-1">{project.description}</p>
                )}
              </>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xl font-bold text-gray-900">
                  {project.currentAmount.toLocaleString()} ₪
                </span>
                <span className="text-sm text-gray-500">
                  מתוך {project.targetAmount.toLocaleString()} ₪
                </span>
              </div>
              <Progress value={percentage} className="h-3" />
              <p className="text-center text-sm font-bold text-gray-700">{percentage}%</p>
            </div>
            {project.dueDate && (
              <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                <span>תאריך יעד: {new Date(project.dueDate).toLocaleDateString('he-IL')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goal type — Funds */}
        {project.projectType === 'goal' && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Banknote className="h-5 w-5 text-blue-500" />
                הפקדות
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add fund form */}
              <form onSubmit={handleAddFund} className="flex gap-2 flex-wrap">
                <input
                  type="number"
                  placeholder="סכום"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="flex-1 min-w-[100px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  required
                />
                <input
                  type="text"
                  placeholder="יעד/מקור (אופציונלי)"
                  value={fundDestination}
                  onChange={(e) => setFundDestination(e.target.value)}
                  className="flex-1 min-w-[140px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <Button type="submit" size="sm">
                  <Plus className="me-1 h-4 w-4" />
                  הוסף
                </Button>
              </form>

              {/* Fund list */}
              {project.funds && project.funds.length > 0 ? (
                <div className="divide-y">
                  {[...project.funds].reverse().map((fund, idx) => (
                    <div key={fund._id || idx} className="flex justify-between items-center py-3">
                      <div>
                        <p className="font-semibold text-gray-800">{fund.amount.toLocaleString()} ₪</p>
                        {fund.destination && (
                          <p className="text-xs text-gray-500">{fund.destination}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(fund.date).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-4 text-sm">עדיין אין הפקדות</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Task type — Checklist */}
        {project.projectType === 'task' && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-emerald-500" />
                משימות
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add task form */}
              <form onSubmit={handleAddTask} className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="שם המשימה"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="flex-1 min-w-[140px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  required
                />
                <input
                  type="number"
                  placeholder="עלות (אופציונלי)"
                  value={taskAmount}
                  onChange={(e) => setTaskAmount(e.target.value)}
                  className="w-[120px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="me-1 h-4 w-4" />
                  הוסף
                </Button>
              </form>

              {/* Task list */}
              {project.tasks && project.tasks.length > 0 ? (
                <div className="space-y-2">
                  {project.tasks.map((task) => (
                    <div
                      key={task._id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        task.done ? 'bg-emerald-50 border-emerald-200' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={() => toggleTask(id, task._id)}
                        />
                        <span className={`text-sm ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {task.name}
                        </span>
                        {task.amount > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {task.amount.toLocaleString()} ₪
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteTask(id, task._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-4 text-sm">עדיין אין משימות</p>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
