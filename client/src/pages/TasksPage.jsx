import { useState, useEffect } from 'react';
// 👇 השינוי הקריטי: משתמשים ב-api המוגדר שלך במקום ב-axios רגיל
import api from '../utils/api'; 
import { Plus, Trash2, Check, Circle, Loader2 } from 'lucide-react';

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      // ✅ api.get מוסיף לבד את /api בהתחלה ושולח קוקיז
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    setSubmitting(true);
    try {
      // ✅ אין צורך לשלוח headers ידנית
      const res = await api.post('/tasks', { text: newTask });
      setTasks([res.data, ...tasks]);
      setNewTask('');
    } catch (err) {
      console.error(err);
      // ה-api.js שלך כבר מטפל בשגיאות 401 (רענון טוקן), אז אין צורך בלוגיקה מסובכת כאן
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTask = async (id, currentStatus) => {
    // עדכון אופטימיסטי
    setTasks(prev => prev.map(t => t._id === id ? { ...t, isCompleted: !currentStatus } : t));
    
    try {
      await api.patch(`/tasks/${id}`, { isCompleted: !currentStatus });
    } catch (err) {
      console.error(err);
      fetchTasks(); // שחזור
    }
  };

  const deleteTask = async (id) => {
    const originalTasks = [...tasks];
    setTasks(prev => prev.filter(t => t._id !== id));

    try {
      await api.delete(`/tasks/${id}`);
    } catch (err) {
      console.error(err);
      setTasks(originalTasks);
    }
  };

  const activeTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);
  const todayDate = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 font-sans text-[#1D1D1F]">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 pt-4">
          <p className="text-gray-500 font-semibold text-sm uppercase tracking-wide mb-1">{todayDate}</p>
          <div className="flex justify-between items-end">
            <h1 className="text-4xl font-bold tracking-tight">מטלות לביצוע</h1>
            <span className="text-sm font-medium bg-white px-3 py-1 rounded-full text-gray-400 shadow-sm border border-gray-100">
              {activeTasks.length} נותרו
            </span>
          </div>
        </div>

        {/* Add Task Input */}
        <form onSubmit={handleAddTask} className="relative mb-8 group">
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
            {submitting ? <Loader2 size={20} className="animate-spin text-blue-500"/> : <Plus size={24} />}
          </div>
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="הוסף משימה חדשה..."
            className="w-full bg-white p-5 pr-14 rounded-3xl text-lg shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-none focus:ring-4 focus:ring-blue-500/10 placeholder-gray-400 transition-all outline-none"
            autoFocus
          />
        </form>

        {/* Active Tasks List */}
        <div className="space-y-3 mb-10">
          {loading && tasks.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400"/></div>
          ) : (
            activeTasks.map(task => (
              <div 
                key={task._id} 
                className="group bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-transparent hover:border-blue-500/20 hover:shadow-md transition-all duration-200 cursor-pointer"
              >
                <button 
                  onClick={() => toggleTask(task._id, false)}
                  className="text-gray-300 hover:text-blue-500 transition-colors focus:outline-none"
                >
                  <Circle size={26} strokeWidth={1.5} />
                </button>
                
                <div className="flex-1">
                  <span className="text-lg text-gray-800 font-medium">{task.text}</span>
                </div>

                <button 
                  onClick={() => deleteTask(task._id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={20} strokeWidth={1.5} />
                </button>
              </div>
            ))
          )}
          
          {activeTasks.length === 0 && !loading && (
            <div className="text-center py-12 opacity-50">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Check size={32} className="text-green-500" />
              </div>
              <p className="text-lg">הכל בוצע! איזה כיף.</p>
            </div>
          )}
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div>
            <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-4 px-2">הושלמו לאחרונה</h3>
            <div className="space-y-2">
              {completedTasks.map(task => (
                <div key={task._id} className="flex items-center gap-4 p-3 px-4 rounded-xl hover:bg-white/50 transition-colors group">
                  <button onClick={() => toggleTask(task._id, true)} className="text-blue-500">
                    <div className="bg-blue-500 rounded-full p-1">
                       <Check size={14} className="text-white" strokeWidth={3} />
                    </div>
                  </button>
                  <span className="text-gray-400 line-through decoration-gray-300 flex-1">{task.text}</span>
                  <button 
                    onClick={() => deleteTask(task._id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-300 mt-6 font-medium">
              משימות שהושלמו נמחקות אוטומטית אחרי 30 יום
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default TasksPage;