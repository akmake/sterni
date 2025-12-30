import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useProjectsStore from '@/stores/projectsStore';
import { Button } from '@/components/ui/Button';
import { Plus, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function ProjectsPage() {
  const { projects, fetchProjects, loading } = useProjectsStore();
  const navigate = useNavigate();

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  if (loading && projects.length === 0) return <div className="flex justify-center pt-20 text-slate-400">טוען נתונים...</div>;

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">הפרויקטים שלי</h1>
            <p className="text-slate-500 mt-1 text-lg">כל המשימות שלך במקום אחד מסודר.</p>
          </div>
          <Button 
            onClick={() => navigate('/projects/new')}
            className="bg-black hover:bg-slate-800 text-white rounded-full px-6 py-6 shadow-lg transition-transform active:scale-95"
          >
            <Plus className="mr-2 h-5 w-5" />
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
               // חישוב פרוגרס מקומי לתצוגה
               const total = project.tasks?.length || 0;
               const done = project.tasks?.filter(t => t.done).length || 0;
               const percent = total === 0 ? 0 : Math.round((done / total) * 100);

               return (
                <Link 
                  key={project._id} 
                  to={`/projects/${project._id}`}
                  className="group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100/50"
                >
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900 mb-2 truncate">
                        {project.projectName}
                      </h3>
                      <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">
                        {project.description || 'אין תיאור לפרויקט'}
                      </p>
                    </div>

                    <div className="mt-8 space-y-3">
                      <div className="flex justify-between text-xs font-medium text-slate-400 uppercase tracking-wider">
                        <span>התקדמות</span>
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