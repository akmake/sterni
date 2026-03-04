import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Check, Circle, Trash2, Loader2,
  ClipboardCheck, User, Calendar, X, Tag, Settings2
} from 'lucide-react';
import useHouseholdStore from '@/stores/householdStore';
import useSocket from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const PRIORITIES = [
  { value: 'low', label: 'נמוך', color: 'text-gray-400 bg-gray-50' },
  { value: 'normal', label: 'רגיל', color: 'text-blue-500 bg-blue-50' },
  { value: 'high', label: 'גבוה', color: 'text-orange-500 bg-orange-50' },
  { value: 'urgent', label: 'דחוף', color: 'text-red-600 bg-red-50' },
];

export default function HouseholdTasksPage() {
  const socket = useSocket();
  const {
    family, fetchFamily, householdTasks, tasksLoading,
    fetchHouseholdTasks, addHouseholdTask, toggleHouseholdTask, deleteHouseholdTask,
    setupSocketListeners, cleanupSocketListeners,
    addCategory, removeCategory,
  } = useHouseholdStore();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('normal');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const categories = family?.taskCategories || [];

  useEffect(() => {
    fetchFamily();
    fetchHouseholdTasks();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].name);
    }
  }, [categories.length]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await addHouseholdTask({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        assignedTo: assignedTo || undefined,
        dueDate: dueDate || undefined,
      });
      setTitle('');
      setDescription('');
      setCategory(categories[0]?.name || '');
      setPriority('normal');
      setAssignedTo('');
      setDueDate('');
      setShowForm(false);
      toast.success('משימה נוספה!');
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await toggleHouseholdTask(id);
    } catch (err) {
      toast.error('שגיאה');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteHouseholdTask(id);
    } catch (err) {
      toast.error('שגיאה');
    }
  };

  const activeTasks = householdTasks.filter(t => !t.isCompleted);
  const completedTasks = householdTasks.filter(t => t.isCompleted);
  const priInfo = (pri) => PRIORITIES.find(p => p.value === pri) || PRIORITIES[1];

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await addCategory('task', { name: newCategoryName.trim() });
      setNewCategoryName('');
      toast.success('קטגוריה נוספה');
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    }
  };

  const handleRemoveCategory = async (catId) => {
    try {
      await removeCategory('task', catId);
      toast.success('קטגוריה הוסרה');
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    }
  };

  const isOverdue = (date) => {
    if (!date) return false;
    return new Date(date) < new Date() && new Date(date).toDateString() !== new Date().toDateString();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold">משימות בית</h1>
              <p className="text-xs text-gray-400">{activeTasks.length} משימות פעילות</p>
            </div>
            <button
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="p-2 hover:bg-white/60 rounded-xl transition-colors"
              title="ניהול קטגוריות"
            >
              <Settings2 size={18} className="text-gray-400" />
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 text-white p-2.5 rounded-xl shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Category manager */}
          <AnimatePresence>
            {showCategoryManager && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 pb-2 space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">ניהול קטגוריות</p>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                      <span key={cat._id} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg text-xs border border-gray-100">
                        <Tag size={10} className="text-gray-400" />
                        {cat.name}
                        <button onClick={() => handleRemoveCategory(cat._id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={handleAddCategory} className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="קטגוריה חדשה..."
                      className="flex-1 bg-white p-2 rounded-lg text-sm border border-gray-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium">
                      הוסף
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-white/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'
              }`}
            >
              פעילות ({activeTasks.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'completed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'
              }`}
            >
              הושלמו ({completedTasks.length})
            </button>
          </div>
        </div>
      </div>

      {/* Add Task Form Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <form onSubmit={handleAdd} className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold">משימה חדשה</h2>
                  <button type="button" onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="מה צריך לעשות?"
                    className="w-full p-4 rounded-xl bg-gray-50 text-lg border-none outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />

                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="פרטים נוספים (אופציונלי)"
                    rows={2}
                    className="w-full p-3 rounded-xl bg-gray-50 text-sm border-none outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />

                  {/* Category */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">קטגוריה</label>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {categories.map(cat => (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() => setCategory(cat.name)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                            category === cat.name
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-50 text-gray-500'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">עדיפות</label>
                    <div className="grid grid-cols-4 gap-2">
                      {PRIORITIES.map(p => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setPriority(p.value)}
                          className={`py-2 rounded-xl text-xs font-medium transition-all ${
                            priority === p.value
                              ? 'bg-blue-600 text-white'
                              : `${p.color} border border-gray-100`
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assign to */}
                  {family?.members?.length > 1 && (
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">הקצה ל</label>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                          type="button"
                          onClick={() => setAssignedTo('')}
                          className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                            !assignedTo ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500'
                          }`}
                        >
                          כולם
                        </button>
                        {family.members.map(m => (
                          <button
                            key={m.user?._id}
                            type="button"
                            onClick={() => setAssignedTo(m.user?._id)}
                            className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                              assignedTo === m.user?._id ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            {m.user?.name?.split(' ')[0] || 'חבר'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Due date */}
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">תאריך יעד</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="w-full p-3 rounded-xl bg-gray-50 text-sm border-none outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !title.trim()}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base transition-all disabled:opacity-50 hover:bg-blue-700"
                  >
                    {submitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'הוסף משימה'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tasks List */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-32">
        {tasksLoading && householdTasks.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : (
          <>
            {activeTab === 'active' && (
              <>
                {activeTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <ClipboardCheck size={32} className="text-green-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-400">הכל בוצע!</p>
                    <p className="text-sm text-gray-300 mt-1">אין משימות פתוחות</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <AnimatePresence>
                      {activeTasks.map(task => {
                        const overdue = isOverdue(task.dueDate);
                        return (
                          <motion.div
                            key={task._id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            className={`group bg-white p-4 rounded-2xl shadow-sm border transition-all ${
                              overdue ? 'border-red-200 bg-red-50/30' : 'border-transparent hover:border-blue-100'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => handleToggle(task._id)}
                                className="text-gray-300 hover:text-green-500 transition-colors mt-0.5 flex-shrink-0"
                              >
                                <Circle size={24} strokeWidth={1.5} />
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {task.category && (
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{task.category}</span>
                                  )}
                                  <p className="font-medium text-gray-800 truncate">{task.title}</p>
                                </div>

                                {task.description && (
                                  <p className="text-xs text-gray-400 mb-1.5 line-clamp-1">{task.description}</p>
                                )}

                                <div className="flex items-center gap-2 flex-wrap">
                                  {task.assignedTo?.name && (
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <User size={8} />
                                      {task.assignedTo.name.split(' ')[0]}
                                    </span>
                                  )}
                                  {task.dueDate && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                      overdue ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'
                                    }`}>
                                      <Calendar size={8} />
                                      {new Date(task.dueDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                                    </span>
                                  )}
                                  {task.priority !== 'normal' && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priInfo(task.priority).color}`}>
                                      {priInfo(task.priority).label}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => handleDelete(task._id)}
                                className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-red-50 rounded-lg flex-shrink-0"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}

            {activeTab === 'completed' && (
              <>
                {completedTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-400">עדיין לא הושלמו משימות</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {completedTasks.map(task => (
                      <div key={task._id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/50 group">
                        <button
                          onClick={() => handleToggle(task._id)}
                          className="text-green-500 flex-shrink-0"
                        >
                          <div className="bg-green-500 rounded-full p-0.5">
                            <Check size={12} className="text-white" strokeWidth={3} />
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-400 line-through text-sm truncate block">{task.title}</span>
                          {task.completedBy?.name && (
                            <span className="text-[10px] text-gray-300">
                              {task.completedBy.name.split(' ')[0]}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(task._id)}
                          className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
