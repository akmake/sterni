import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';

const getKosherDisplay = (opt) => {
  if (!opt) return 'פרווה';
  const code = String(opt).toLowerCase().trim();
  if (code === 'meat' || code === 'בשרי' || code === 'בשר') return 'בשרי';
  if (code === 'halavi' || code === 'חלבי' || code === 'חלב') return 'חלבי';
  if (code === 'parve' || code === 'פרווה' || code === 'פרו') return 'פרווה';
  return 'פרווה';
};

const getKosherColor = (opt) => {
  if (!opt) return 'bg-green-600';
  const code = String(opt).toLowerCase().trim();
  if (code === 'meat' || code === 'בשרי' || code === 'בשר') return 'bg-red-600';
  if (code === 'halavi' || code === 'חלבי' || code === 'חלב') return 'bg-blue-600';
  if (code === 'parve' || code === 'פרווה' || code === 'פרו') return 'bg-green-600';
  return 'bg-green-600';
};

export default function AdminMealsPage() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    kosherOptions: [],
    menuOptions: [],
    order: 0,
  });
  
  const [newKosher, setNewKosher] = useState('');
  const [newMenu, setNewMenu] = useState('');

  useEffect(() => {
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      const response = await api.get('/meals');
      setMeals(response.data.data?.meals || []);
    } catch (error) {
      toast.error('שגיאה בטעינת ארוחות');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeal = async () => {
    if (!formData.name || formData.kosherOptions.length === 0 || formData.menuOptions.length === 0) {
      toast.error('שם, סוגי כשרות ותפריטים הם שדות חובה');
      return;
    }

    try {
      await api.post('/meals', formData);
      toast.success('ארוחה נוצרה בהצלחה');
      fetchMeals();
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('שגיאה ביצירת ארוחה');
      console.error(error);
    }
  };

  const handleUpdateMeal = async (mealId) => {
    try {
      await api.patch(`/meals/${mealId}`, formData);
      toast.success('ארוחה עודכנה בהצלחה');
      fetchMeals();
      setEditingId(null);
      resetForm();
    } catch (error) {
      toast.error('שגיאה בעדכון ארוחה');
      console.error(error);
    }
  };

  const handleDeleteMeal = async (mealId) => {
    if (!window.confirm('האם אתה בטוח?')) return;

    try {
      await api.delete(`/meals/${mealId}`);
      toast.success('ארוחה מחוקה בהצלחה');
      fetchMeals();
    } catch (error) {
      toast.error('שגיאה במחיקת ארוחה');
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      kosherOptions: [],
      menuOptions: [],
      order: 0,
    });
    setNewKosher('');
    setNewMenu('');
  };

  const startEdit = (meal) => {
    setEditingId(meal._id);
    setFormData({
      name: meal.name,
      kosherOptions: meal.kosherOptions || [],
      menuOptions: meal.menuOptions || [],
      order: meal.order || 0,
    });
    setNewKosher('');
    setNewMenu('');
  };

  const addKosherOption = () => {
    if (newKosher && !formData.kosherOptions.includes(newKosher)) {
      // Normalize to English code
      let normalized = newKosher.toLowerCase().trim();
      if (normalized === 'בשרי' || normalized === 'בשר' || normalized.includes('meat')) normalized = 'meat';
      if (normalized === 'חלבי' || normalized === 'חלב' || normalized.includes('halavi') || normalized.includes('dairy')) normalized = 'halavi';
      if (normalized === 'פרווה' || normalized === 'פרו' || normalized.includes('parve')) normalized = 'parve';
      
      setFormData(prev => ({
        ...prev,
        kosherOptions: [...prev.kosherOptions, normalized]
      }));
      setNewKosher('');
    }
  };

  const removeKosherOption = (option) => {
    setFormData(prev => ({
      ...prev,
      kosherOptions: prev.kosherOptions.filter(o => o !== option)
    }));
  };

  const addMenuOption = () => {
    if (newMenu && !formData.menuOptions.includes(newMenu)) {
      setFormData(prev => ({
        ...prev,
        menuOptions: [...prev.menuOptions, newMenu]
      }));
      setNewMenu('');
    }
  };

  const removeMenuOption = (index) => {
    setFormData(prev => ({
      ...prev,
      menuOptions: prev.menuOptions.filter((_, i) => i !== index)
    }));
  };

  if (loading) return <div className="p-8 text-center">טוען...</div>;

  return (
    <div className="p-8" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">ניהול ארוחות</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setIsCreateDialogOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          ארוחה חדשה
        </button>
      </div>

      {/* Meals Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-right">שם הארוחה</th>
              <th className="px-6 py-3 text-right">סוגי כשרות</th>
              <th className="px-6 py-3 text-right">אפשרויות תפריט</th>
              <th className="px-6 py-3 text-right">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {meals.map((meal) => (
              <tr key={meal._id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-4 font-semibold">{meal.name}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {meal.kosherOptions?.map((opt) => (
                      <span key={opt} className={`px-2 py-1 rounded text-white text-sm ${getKosherColor(opt)}`}>
                        {getKosherDisplay(opt)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {meal.menuOptions?.map((opt) => (
                      <span key={opt} className="bg-gray-200 px-2 py-1 rounded text-sm">
                        {opt}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button
                    onClick={() => startEdit(meal)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteMeal(meal._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      {(isCreateDialogOpen || editingId) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{editingId ? 'עריכת ארוחה' : 'ארוחה חדשה'}</h2>
              <X
                size={24}
                className="cursor-pointer"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setEditingId(null);
                  resetForm();
                }}
              />
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* שם הארוחה */}
              <div>
                <label className="block font-semibold mb-1">שם הארוחה</label>
                <input
                  type="text"
                  placeholder="ארוחת בוקר"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              {/* סוגי כשרות */}
              <div>
                <label className="block font-semibold mb-2">סוגי כשרות</label>
                <div className="flex gap-2 mb-2">
                  <select
                    value={newKosher}
                    onChange={(e) => setNewKosher(e.target.value)}
                    className="border rounded px-3 py-2 flex-1"
                  >
                    <option value="">בחר סוג כשרות...</option>
                    <option value="meat">בשרי</option>
                    <option value="halavi">חלבי</option>
                    <option value="parve">פרווה</option>
                  </select>
                  <button
                    onClick={addKosherOption}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    הוסף
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.kosherOptions.map((opt) => (
                    <div
                      key={opt}
                      className={`px-3 py-1 rounded text-white text-sm flex items-center gap-2 ${getKosherColor(opt)}`}
                    >
                      {getKosherDisplay(opt)}
                      <X
                        size={14}
                        className="cursor-pointer"
                        onClick={() => removeKosherOption(opt)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* אפשרויות תפריט */}
              <div>
                <label className="block font-semibold mb-2">אפשרויות תפריט</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="תפריט נוער"
                    value={newMenu}
                    onChange={(e) => setNewMenu(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addMenuOption()}
                    className="border rounded px-3 py-2 flex-1"
                  />
                  <button
                    onClick={addMenuOption}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    הוסף
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.menuOptions.map((opt, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-200 px-3 py-1 rounded text-sm flex items-center gap-2"
                    >
                      {opt}
                      <X
                        size={14}
                        className="cursor-pointer"
                        onClick={() => removeMenuOption(idx)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-6">
                <button
                  onClick={editingId ? () => handleUpdateMeal(editingId) : handleCreateMeal}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex-1"
                >
                  <Plus size={20} />
                  {editingId ? 'עדכן' : 'צור'}
                </button>
                <button
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="px-6 py-2 border rounded hover:bg-gray-100"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
