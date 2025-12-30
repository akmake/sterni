import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useProjectsStore from '@/stores/projectsStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const { createProject, loading } = useProjectsStore();
  
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [initialTaskName, setInitialTaskName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    try {
      const newProject = await createProject({
        projectName,
        description,
        initialTaskName
      });
      navigate(`/projects/${newProject._id}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white/80 backdrop-blur-2xl rounded-[2rem] shadow-2xl p-8 md:p-12 border border-white/40">
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900">יצירת פרויקט חדש</h1>
          <p className="text-slate-500 mt-2">בוא ניתן לזה שם ונתחיל לעבוד</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 mr-1">שם הפרויקט</label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="לדוגמה: השקת מוצר חדש"
              className="h-14 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500/50 text-lg px-4 transition-all"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 mr-1">תיאור (אופציונלי)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="כמה מילים על המטרות..."
              className="min-h-[100px] rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500/50 text-base p-4 transition-all resize-none"
            />
          </div>

          <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
             <label className="text-sm font-semibold text-blue-900 block mb-3">🚀 משימה ראשונה לדרך</label>
             <Input 
                value={initialTaskName}
                onChange={(e) => setInitialTaskName(e.target.value)}
                placeholder="מה הדבר הכי דחוף לעשות?"
                className="h-12 rounded-xl bg-white border-blue-200/50 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button 
                type="button" 
                variant="ghost" 
                onClick={() => navigate('/projects')}
                className="flex-1 h-14 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              ביטול
            </Button>
            <Button 
                type="submit" 
                disabled={loading}
                className="flex-[2] h-14 rounded-2xl bg-black text-white hover:bg-slate-800 shadow-lg active:scale-[0.98] transition-all text-lg font-medium"
            >
              {loading ? 'יוצר...' : 'צור פרויקט'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}