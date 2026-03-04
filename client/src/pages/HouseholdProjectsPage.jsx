import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Loader2, FolderKanban, Trash2 } from 'lucide-react';
import useHouseholdProjectStore from '@/stores/householdProjectStore';
import useProjectsStore from '@/stores/projectsStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

/* ========== Unified Project Card ========== */
function ProjectCard({ project, source, onDelete }) {
  const navigate = useNavigate();

  // Detect type and compute progress
  const isHousehold = source === 'household';
  const name = project.projectName || project.name || 'פרויקט ללא שם';
  const description = project.description || 'אין תיאור';

  let percentage = 0;
  let progressLabel = '';
  let badge = '';
  let badgeColor = '';
  let detailPath = '';

  if (isHousehold) {
    // Household project — goal or task with ₪
    const { currentAmount = 0, targetAmount = 0, projectType } = project;
    percentage = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
    progressLabel = `${currentAmount.toLocaleString()} ₪ מתוך ${targetAmount.toLocaleString()} ₪`;
    badge = projectType === 'goal' ? 'יעד' : 'משימות';
    badgeColor = projectType === 'goal' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800';
    detailPath = `/household/projects/${project._id}`;
  } else {
    // Management project — simple task checklist
    const total = project.tasks?.length || 0;
    const done = project.tasks?.filter(t => t.done).length || 0;
    percentage = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    progressLabel = total > 0 ? `${done}/${total} משימות הושלמו` : 'אין משימות';
    badge = 'אישי';
    badgeColor = 'bg-indigo-100 text-indigo-800';
    detailPath = `/projects/${project._id}`;
  }

  const handleDelete = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (window.confirm('האם למחוק את הפרויקט לצמיתות?')) onDelete?.(project._id);
  };

  return (
    <Card
      className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer group relative"
      onClick={() => navigate(detailPath)}
    >
      {/* Delete button — only on personal/management projects */}
      {!isHousehold && onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-3 left-3 p-2 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 z-10"
          title="מחק פרויקט"
        >
          <Trash2 size={16} />
        </button>
      )}

      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg font-bold">{name}</CardTitle>
          <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        </div>
        <CardDescription className="pt-1 line-clamp-2">{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-grow">
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold text-gray-800">{progressLabel}</span>
          </div>
          <Progress value={percentage} className="h-2" />
          <p className="text-center text-sm font-bold text-gray-700">{percentage}%</p>
        </div>
      </CardContent>

      <CardFooter>
        <Button variant="link" className="w-full text-blue-600">
          צפה בפרטים
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ========== Main Page ========== */
export default function HouseholdProjectsPage() {
  const navigate = useNavigate();

  const {
    projects: householdProjects, fetchProjects: fetchHousehold,
    loading: hLoading, error: hError,
    setupSocketListeners, cleanupSocketListeners,
  } = useHouseholdProjectStore();

  const {
    projects: managementProjects, fetchProjects: fetchManagement,
    deleteProject, loading: mLoading,
  } = useProjectsStore();

  useEffect(() => {
    fetchHousehold();
    fetchManagement();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  const loading = hLoading || mLoading;
  const allProjects = [
    ...householdProjects.map(p => ({ ...p, _source: 'household' })),
    ...managementProjects.map(p => ({ ...p, _source: 'management' })),
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      <div className="container mx-auto p-4 sm:p-6">

        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">פרויקטים</h1>
            <p className="text-gray-500 mt-1 text-sm">מעקב אחר יעדי חיסכון ומשימות</p>
          </div>
          <Button asChild>
            <Link to="/household/projects/new">
              <PlusCircle className="me-2 h-4 w-4" />
              פרויקט חדש
            </Link>
          </Button>
        </header>

        {/* Loading */}
        {loading && allProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-gray-500 text-sm">טוען פרויקטים...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && allProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-5 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm">
            <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
              <FolderKanban className="h-8 w-8 text-blue-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-700">אין פרויקטים עדיין</h2>
              <p className="text-gray-500 mt-1">צור פרויקט ראשון ותתחיל לעקוב אחר היעדים</p>
            </div>
            <Button asChild>
              <Link to="/household/projects/new">
                <PlusCircle className="me-2 h-4 w-4" />
                צור פרויקט ראשון
              </Link>
            </Button>
          </div>
        )}

        {/* Grid */}
        {!loading && allProjects.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allProjects.map(p => (
              <ProjectCard
                key={p._id}
                project={p}
                source={p._source}
                onDelete={p._source === 'management' ? deleteProject : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
