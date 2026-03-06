import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Target, CheckSquare, FolderOpen, PiggyBank } from 'lucide-react';
import useHouseholdProjectStore from '@/stores/householdProjectStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewHouseholdProjectPage() {
  const navigate = useNavigate();
  const { createProject, loading } = useHouseholdProjectStore();

  const [form, setForm] = useState({
    projectName: '',
    description: '',
    projectType: '',
    targetAmount: '',
    dueDate: '',
  });

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.projectType || !form.projectName.trim()) return;

    const payload = {
      projectName: form.projectName.trim(),
      description: form.description.trim(),
      projectType: form.projectType,
      targetAmount: form.targetAmount ? Number(form.targetAmount) : 0,
      dueDate: form.dueDate || undefined,
    };

    const created = await createProject(payload);
    if (created?._id) {
      navigate(`/household/projects/${created._id}`);
    } else {
      navigate('/household/projects');
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Back */}
        <Button variant="ghost" size="sm" asChild>
          <Link to="/household/projects">
            <ArrowRight className="me-1 h-4 w-4" />
            חזרה לפרויקטים
          </Link>
        </Button>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">פרויקט חדש</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Type selector */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">סוג הפרויקט</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => set('projectType', 'goal')}
                    className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                      form.projectType === 'goal'
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <Target className={`h-8 w-8 ${form.projectType === 'goal' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold text-sm ${form.projectType === 'goal' ? 'text-blue-700' : 'text-gray-600'}`}>
                      יעד כספי
                    </span>
                    <span className="text-xs text-gray-500 text-center">
                      חיסכון לסכום מסוים
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => set('projectType', 'task')}
                    className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                      form.projectType === 'task'
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <CheckSquare className={`h-8 w-8 ${form.projectType === 'task' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold text-sm ${form.projectType === 'task' ? 'text-emerald-700' : 'text-gray-600'}`}>
                      משימות + כסף
                    </span>
                    <span className="text-xs text-gray-500 text-center">
                      צ'קליסט עם עלויות
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => set('projectType', 'simple')}
                    className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                      form.projectType === 'simple'
                        ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <FolderOpen className={`h-8 w-8 ${form.projectType === 'simple' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold text-sm ${form.projectType === 'simple' ? 'text-indigo-700' : 'text-gray-600'}`}>
                      פרויקט פשוט
                    </span>
                    <span className="text-xs text-gray-500 text-center">
                      משימות בלי כסף
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => set('projectType', 'savings')}
                    className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                      form.projectType === 'savings'
                        ? 'border-pink-500 bg-pink-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <PiggyBank className={`h-8 w-8 ${form.projectType === 'savings' ? 'text-pink-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold text-sm ${form.projectType === 'savings' ? 'text-pink-700' : 'text-gray-600'}`}>
                      חיסכון
                    </span>
                    <span className="text-xs text-gray-500 text-center">
                      צבירת כסף לאורך זמן
                    </span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">שם הפרויקט</label>
                <input
                  type="text"
                  value={form.projectName}
                  onChange={(e) => set('projectName', e.target.value)}
                  placeholder="לדוגמה: שיפוץ סלון, טיול משפחתי..."
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">תיאור (אופציונלי)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                  placeholder="תאר את הפרויקט..."
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
              </div>

              {/* Target amount (relevant for goal, optional for task, hidden for simple) */}
              {form.projectType !== 'simple' && form.projectType !== 'savings' && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">
                  {form.projectType === 'goal' ? 'סכום יעד (₪)' : 'תקציב כולל (אופציונלי)'}
                </label>
                <input
                  type="number"
                  value={form.targetAmount}
                  onChange={(e) => set('targetAmount', e.target.value)}
                  placeholder="0"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  {...(form.projectType === 'goal' ? { required: true, min: 1 } : {})}
                />
              </div>
              )}

              {/* Due date */}
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">תאריך יעד (אופציונלי)</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => set('dueDate', e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !form.projectType || !form.projectName.trim()}
              >
                {loading ? 'יוצר...' : 'צור פרויקט'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
