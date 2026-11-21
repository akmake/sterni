import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useProjectsStore from '@/stores/projectsStore';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, FolderOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import api from '@/utils/api';
import { connectSocket } from '@/utils/socket';
import PushOptIn from '@/components/PushOptIn';
import ActionMenu from '@/components/ui/ActionMenu';

export default function ProjectsPage() {
  // הוספנו את deleteProject מהחנות
  const { projects, fetchProjects, deleteProject, loading } = useProjectsStore();
  const navigate = useNavigate();

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ── זמן אמת: פרויקט שמישהו יצר עבורי מופיע מיד (assignmentNotifier → 'projects:changed') ──
  useEffect(() => {
    const socket = connectSocket();
    const refresh = () => fetchProjects();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchProjects(); };
    socket?.on('projects:changed', refresh);
    socket?.on('connect', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      socket?.off('projects:changed', refresh);
      socket?.off('connect', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchProjects]);

  // פרויקטים שהוקצו לי ועוד לא נראו — מסמנים כנראו כשהעמוד גלוי (עוצר תזכורות)
  const unseenIds = projects.filter(p => p.createdBy && !p.seenAt).map(p => p._id).join(',');
  useEffect(() => {
    if (!unseenIds) return;
    const mark = () => {
      if (document.visibilityState !== 'visible') return;
      api.post('/projects/seen', { ids: unseenIds.split(',') }).catch(() => {});
    };
    const t = setTimeout(mark, 1500);
    document.addEventListener('visibilitychange', mark);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', mark); };
  }, [unseenIds]);

  // פונקציית המחיקה
  const handleDelete = async (e, id) => {
    e.preventDefault(); // מונע מהלינק להעביר אותך עמוד
    e.stopPropagation(); // מונע אירועים מתנגשים
    if (window.confirm('האם למחוק את הפרויקט לצמיתות?')) {
      await deleteProject(id);
    }
  };

  if (loading && projects.length === 0) return (
    <div className="px-4 pt-6 md:p-10 max-w-6xl mx-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map(i => <div key={i} className="h-44 bg-white/70 rounded-3xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="min-h-full bg-[#F5F5F7] px-4 pt-4 pb-28 md:p-10 font-sans dir-rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end mb-6 md:mb-10">
          <div>
            <h1 className="text-[28px] md:text-4xl font-bold md:font-semibold tracking-tight text-slate-900">הפרויקטים שלי</h1>
            <p className="text-slate-500 mt-1 text-[15px] md:text-lg">כל המשימות שלך במקום אחד מסודר.</p>
            <PushOptIn className="mt-3" />
          </div>
          <Button 
            onClick={() => navigate('/projects/new')}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl md:rounded-full h-12 md:h-auto md:px-6 md:py-6 shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 w-full md:w-auto"
          >
            <Plus className="h-5 w-5" />
            פרויקט חדש
          </Button>
        </div>

        {/* Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-16 md:py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/20 shadow-sm">
            <h2 className="text-xl md:text-2xl font-medium text-slate-700">הכל נקי כאן</h2>
            <p className="text-slate-500 mt-2">אין עדיין פרויקטים. זה הזמן ליצור את הראשון.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => {
               const total = project.tasks?.length || 0;
               const done = project.tasks?.filter(t => t.done).length || 0;
               const percent = total === 0 ? 0 : Math.round((done / total) * 100);
               const from = project.createdBy ? (project.sourceLabel || project.createdBy.name) : '';
               const isNew = project.createdBy && !project.seenAt;

               return (
                <Link 
                  key={project._id} 
                  to={`/projects/${project._id}`}
                  className={`group relative bg-white rounded-3xl p-5 md:p-6 shadow-sm md:hover:shadow-xl md:hover:-translate-y-1 active:scale-[0.99] transition-all duration-300 border block
                    ${isNew ? 'border-amber-300 ring-2 ring-amber-200/60' : 'border-slate-100/50'}`}
                >
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex items-start gap-2">
                        <h3 className="flex-1 min-w-0 text-[18px] md:text-xl font-semibold text-slate-900 leading-snug break-words">
                          {project.name || project.projectName || 'פרויקט ללא שם'}
                        </h3>
                        <ActionMenu items={[
                          { label: 'פתח פרויקט', icon: FolderOpen, onClick: () => navigate(`/projects/${project._id}`) },
                          { label: 'מחיקה', icon: Trash2, onClick: () => handleDelete({ preventDefault() {}, stopPropagation() {} }, project._id), danger: true, separatorBefore: true },
                        ]} />
                      </div>
                      {(from || isNew) && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {from && <span className="text-[12px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5">מאת {from}</span>}
                          {isNew && <span className="text-[11px] font-bold bg-amber-400 text-white rounded-full px-2 py-0.5">חדש</span>}
                        </div>
                      )}
                      <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed mt-2">
                        {project.description || 'אין תיאור לפרויקט'}
                      </p>
                    </div>

                    <div className="mt-5 md:mt-8 space-y-2">
                      <div className="flex justify-between text-xs font-medium text-slate-400">
                        <span>{total ? `${done}/${total} משימות` : 'אין משימות'}</span>
                        <span className="tabular-nums">{percent}%</span>
                      </div>
                      <Progress value={percent} className="h-2 bg-slate-100" indicatorClassName="bg-slate-900" />
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