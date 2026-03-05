import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useHouseholdProjectStore from '@/stores/householdProjectStore';
import { Button } from '@/components/ui/Button';
import { Plus, ArrowRight, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function HouseholdProjectsPage() {
  const {
    projects, fetchProjects, deleteProject, loading,
    setupSocketListeners, cleanupSocketListeners,
  } = useHouseholdProjectStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('האם למחוק את הפרויקט לצמיתות?')) {
      await deleteProject(id);
    }
  };

  const getProgress = (project) => {
    if (project.projectType === 'goal') {
      const { currentAmount = 0, targetAmount = 0 } = project;
      return targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
    }
    const total = project.tasks?.length || 0;
    const done = project.tasks?.filter(t => t.done).length || 0;
    return total === 0 ? 0 : Math.round((done / total) * 100);
  };

  const getProgressLabel = (project) => {
    if (project.projectType === 'goal') {
      const { currentAmount = 0, targetAmount = 0 } = project;
      return `${currentAmount.toLocaleString()} ₪ / ${targetAmount.toLocaleString()} ₪`;
    }
    const total = project.tasks?.length || 0;
    const done = project.tasks?.filter(t => t.done).length || 0;
    return total > 0 ? `${done}/${total} משימות` : 'אין משימות';
  };

  const typeBadge = (type) => {
    if (type === 'goal') return { label: 'יעד כספי', cls: 'bg-blue-100 text-blue-700' };
    if (type === 'task') return { label: 'משימות + ₪', cls: 'bg-emerald-100 text-emerald-700' };
    return { label: 'משימות', cls: 'bg-indigo-100 text-indigo-700' };
  };

  if (loading && projects.length === 0) {
    return <div className="flex justify-center pt-20 text-slate-400">טוען נתונים...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-10 font-sans dir-rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">פרויקטים</h1>
            <p className="text-slate-500 mt-1 text-lg">מעקב אחר יעדים, משימות ותקציבים</p>
          </div>
          <Button
            onClick={() => navigate('/household/projects/new')}
            className="bg-black hover:bg-slate-800 text-white rounded-full px-6 py-6 shadow-lg transition-transform active:scale-95 flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            פרויקט חדש
          </Button>
        </div>

        {/* Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/20 shadow-sm">
            <h2 className="text-2xl font-medium text-slate-700">הכל נקי כאן</h2>
            <p className="text-slate-500 mt-2">אין עדיין פרויקטים. זה הזמן ליצור את הראשון.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => {
              const percent = getProgress(project);
              const badge = typeBadge(project.projectType);

              return (
                <Link
                  key={project._id}
                  to={`/household/projects/${project._id}`}
                  className="group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100/50 block"
                >
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, project._id)}
                    className="absolute top-4 left-4 p-2.5 rounded-full text-slate-300 
                               hover:text-red-500 hover:bg-red-50 
                               transition-all duration-300 ease-out
                               opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0
                               z-20"
                    title="מחק פרויקט"
                  >
                    <Trash2 size={20} strokeWidth={2} />
                  </button>

                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="text-xl font-semibold text-slate-900 truncate">
                          {project.projectName || 'פרויקט ללא שם'}
                        </h3>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed h-10">
                        {project.description || 'אין תיאור לפרויקט'}
                      </p>
                    </div>

                    <div className="mt-8 space-y-3">
                      <div className="flex justify-between text-xs font-medium text-slate-400 uppercase tracking-wider">
                        <span>{getProgressLabel(project)}</span>
                        <span>{percent}%</span>
                      </div>
                      <Progress value={percent} className="h-2 bg-slate-100" indicatorClassName="bg-slate-900" />

                      <div className="pt-4 flex items-center text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                        הכנס לפרויקט <ArrowRight className="ml-1 w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
