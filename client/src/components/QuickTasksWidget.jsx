import { useState, useEffect, useRef } from 'react';
import api from '@/utils/api';
import { Plus, Trash2, Check, ChevronDown, ChevronUp, Loader2, ArrowUpRight, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QuickTasksWidget = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // טעינת משימות
  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to load tasks", err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // הוספת משימה
  const handleAddTask = async (e) => {
    if (e.key === 'Enter' && newTask.trim()) {
      setLoading(true);
      try {
        const res = await api.post('/tasks', { text: newTask });
        setTasks([res.data, ...tasks]);
        setNewTask('');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  // סימון כבוצע / החזרה
  const toggleTask = async (id, currentStatus) => {
    // עדכון אופטימיסטי מיידי
    setTasks(prev => prev.map(t => t._id === id ? { ...t, isCompleted: !currentStatus } : t));
    
    try {
      await api.patch(`/tasks/${id}`, { isCompleted: !currentStatus });
    } catch (err) {
      console.error(err);
      fetchTasks(); // שחזור במקרה שגיאה
    }
  };

  // מחיקה
  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t._id !== id));
    try {
      await api.delete(`/tasks/${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  // המרה לפרויקט
  const convertToProject = async (id) => {
    if (!window.confirm('להפוך מטלה זו לפרויקט חדש?')) return;
    try {
      const res = await api.post(`/tasks/${id}/convert`);
      setTasks(prev => prev.filter(t => t._id !== id));
      navigate(`/projects/${res.data.newProject._id}`);
    } catch (err) {
      console.error(err);
    }
  };

  // עריכה
  const startEditing = (task) => {
    setEditingId(task._id);
    setEditValue(task.text);
  };
  const saveEdit = async () => {
    const val = editValue.trim();
    if (val && editingId) {
      setTasks(prev => prev.map(t => t._id === editingId ? { ...t, text: val } : t));
      try {
        await api.patch(`/tasks/${editingId}`, { text: val });
      } catch (err) {
        console.error(err);
        fetchTasks();
      }
    }
    setEditingId(null);
    setEditValue('');
  };

  const activeTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-100px)]">
      {/* כותרת */}
      <div className="p-4 bg-gray-50 border-b border-gray-100">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          ⚡ מטלות מהירות
        </h3>
      </div>

      {/* אינפוט */}
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={handleAddTask}
            placeholder="הוסף משימה ואנטר..."
            className="w-full pl-3 pr-9 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            disabled={loading}
          />
          <div className="absolute left-2 top-2 text-gray-400">
            {loading ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>}
          </div>
        </div>
      </div>

      {/* רשימת משימות פעילות */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {activeTasks.length === 0 && !loading && (
          <p className="text-center text-xs text-gray-400 py-4">אין משימות פעילות 🎉</p>
        )}
        
        {activeTasks.map(task => (
          <div key={task._id} className="group flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors text-sm">
            <div className="flex items-center gap-3 overflow-hidden flex-1">
              <button 
                onClick={() => toggleTask(task._id, false)}
                className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-blue-500 flex items-center justify-center transition-colors flex-shrink-0"
              >
              </button>
              {editingId === task._id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  className="text-gray-700 text-sm bg-transparent border-b border-blue-500 outline-none flex-1"
                />
              ) : (
                <span 
                  className="text-gray-700 truncate cursor-pointer"
                  onDoubleClick={() => startEditing(task)}
                >{task.text}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => startEditing(task)}
                title="ערוך"
                className="text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil size={12} />
              </button>
              <button 
                onClick={() => convertToProject(task._id)}
                title="הפוך לפרויקט"
                className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ArrowUpRight size={14} />
              </button>
              <button 
                onClick={() => deleteTask(task._id)}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* אזור בוצע */}
      {completedTasks.length > 0 && (
        <div className="border-t border-gray-100">
          <button 
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between p-3 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <span>הושלמו ({completedTasks.length})</span>
            {showCompleted ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          
          {showCompleted && (
            <div className="bg-gray-50/50 p-2 space-y-1 max-h-40 overflow-y-auto">
              {completedTasks.map(task => (
                <div key={task._id} className="flex items-center justify-between p-2 rounded-lg opacity-60">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <button 
                      onClick={() => toggleTask(task._id, true)}
                      className="w-5 h-5 rounded-full bg-blue-500 border-2 border-blue-500 flex items-center justify-center text-white flex-shrink-0"
                    >
                      <Check size={10} strokeWidth={4} />
                    </button>
                    <span className="text-gray-500 line-through truncate text-sm">{task.text}</span>
                  </div>
                  <button 
                    onClick={() => deleteTask(task._id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="text-[10px] text-center text-gray-400 mt-2">
                * משימות שהושלמו יימחקו אוטומטית אחרי 30 יום
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuickTasksWidget;