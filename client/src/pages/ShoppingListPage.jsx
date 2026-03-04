import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Check, Circle, Trash2, Loader2, 
  ShoppingCart, Filter, X, Tag, Settings2
} from 'lucide-react';
import useHouseholdStore from '@/stores/householdStore';
import useSocket from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const PRIORITIES = [
  { value: 'low', label: 'נמוך', color: 'text-gray-400' },
  { value: 'normal', label: 'רגיל', color: 'text-blue-500' },
  { value: 'high', label: 'גבוה', color: 'text-orange-500' },
  { value: 'urgent', label: 'דחוף!', color: 'text-red-600' },
];

export default function ShoppingListPage() {
  const socket = useSocket();
  const {
    family, fetchFamily,
    shoppingItems, shoppingLoading, fetchShopping,
    addShoppingItem, toggleShoppingItem, deleteShoppingItem, clearBoughtItems,
    setupSocketListeners, cleanupSocketListeners,
    addCategory, removeCategory,
  } = useHouseholdStore();

  const [newItem, setNewItem] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const inputRef = useRef(null);

  const categories = family?.shoppingCategories || [];

  useEffect(() => {
    fetchFamily();
    fetchShopping();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !newCategory) {
      setNewCategory(categories[0].name);
    }
  }, [categories.length]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setSubmitting(true);
    try {
      await addShoppingItem({
        name: newItem.trim(),
        quantity: newQuantity.trim(),
        category: newCategory || 'כללי',
        priority: newPriority,
      });
      setNewItem('');
      setNewQuantity('');
      setNewPriority('normal');
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err.error || 'שגיאה בהוספת פריט');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setSubmitting(true);
    try {
      await addShoppingItem({
        name: newItem.trim(),
        category: categories[0]?.name || 'כללי',
        priority: 'normal',
      });
      setNewItem('');
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await toggleShoppingItem(id);
    } catch (err) {
      toast.error('שגיאה בעדכון');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteShoppingItem(id);
    } catch (err) {
      toast.error('שגיאה במחיקה');
    }
  };

  const handleClearBought = async () => {
    if (!window.confirm('למחוק את כל הפריטים שנקנו?')) return;
    try {
      await clearBoughtItems();
      toast.success('נוקה!');
    } catch (err) {
      toast.error('שגיאה');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await addCategory('shopping', { name: newCategoryName.trim() });
      setNewCategoryName('');
      toast.success('קטגוריה נוספה');
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    }
  };

  const handleRemoveCategory = async (catId) => {
    try {
      await removeCategory('shopping', catId);
      toast.success('קטגוריה הוסרה');
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    }
  };

  // Filter logic
  const activeItems = shoppingItems.filter(i => !i.isBought);
  const boughtItems = shoppingItems.filter(i => i.isBought);
  const filteredActive = activeFilter === 'all' 
    ? activeItems 
    : activeItems.filter(i => i.category === activeFilter);

  // Group by category for display
  const groupedItems = {};
  filteredActive.forEach(item => {
    const cat = item.category || 'כללי';
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold">רשימת קניות</h1>
              <p className="text-xs text-gray-400">{activeItems.length} פריטים לקנות</p>
            </div>
            <button
              onClick={() => setShowCategoryManager(!showCategoryManager)}
              className="p-2 hover:bg-white/60 rounded-xl transition-colors"
              title="ניהול קטגוריות"
            >
              <Settings2 size={18} className="text-gray-400" />
            </button>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-gray-400">חי</span>
            </div>
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

          {/* Quick add bar */}
          <form onSubmit={handleQuickAdd} className="mt-3 relative">
            <input
              ref={inputRef}
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="הוסף פריט מהיר..."
              className="w-full bg-white p-3.5 pr-4 pl-24 rounded-2xl text-base shadow-sm border border-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none transition-all"
            />
            <div className="absolute inset-y-0 left-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                title="אפשרויות מתקדמות"
              >
                <Filter size={16} />
              </button>
              <button
                type="submit"
                disabled={submitting || !newItem.trim()}
                className="bg-blue-600 text-white p-2 rounded-xl disabled:opacity-40 transition-all hover:bg-blue-700"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </button>
            </div>
          </form>

          {/* Advanced add form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleAdd}
                className="overflow-hidden"
              >
                <div className="pt-3 pb-1 space-y-3">
                  <input
                    type="text"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="כמות (למשל: 2 ק״ג, חבילה)"
                    className="w-full bg-white p-3 rounded-xl text-sm border border-gray-100 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  
                  {/* Category pills */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {categories.map(cat => (
                      <button
                        key={cat._id}
                        type="button"
                        onClick={() => setNewCategory(cat.name)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                          newCategory === cat.name 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'bg-white text-gray-500 border border-gray-200'
                        }`}
                      >
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Priority */}
                  <div className="flex gap-2">
                    {PRIORITIES.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setNewPriority(p.value)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                          newPriority === p.value 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-gray-500 border border-gray-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !newItem.trim()}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 hover:bg-blue-700"
                  >
                    {submitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'הוסף לרשימה'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Category filter bar */}
        <div className="max-w-2xl mx-auto px-4 pb-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === 'all' 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-white text-gray-500 border border-gray-100'
              }`}
            >
              הכל ({activeItems.length})
            </button>
            {categories.map(cat => {
              const count = activeItems.filter(i => i.category === cat.name).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat._id}
                  onClick={() => setActiveFilter(cat.name)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    activeFilter === cat.name 
                      ? 'bg-gray-800 text-white' 
                      : 'bg-white text-gray-500 border border-gray-100'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-32">
        {shoppingLoading && shoppingItems.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : filteredActive.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ShoppingCart size={32} className="text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-400">הרשימה ריקה</p>
            <p className="text-sm text-gray-300 mt-1">הוסף פריטים למעלה</p>
          </div>
        ) : (
          <>
            {/* Grouped by category */}
            {Object.entries(groupedItems).map(([cat, items]) => {
              return (
                <div key={cat} className="mb-5">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Tag size={12} className="text-gray-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{cat}</span>
                    <span className="text-xs text-gray-300">({items.length})</span>
                  </div>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {items.map(item => (
                        <motion.div
                          key={item._id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          className="group bg-white p-3.5 rounded-2xl flex items-center gap-3 shadow-sm border border-transparent hover:border-blue-100 transition-all"
                        >
                          <button
                            onClick={() => handleToggle(item._id)}
                            className="text-gray-300 hover:text-green-500 transition-colors flex-shrink-0"
                          >
                            <Circle size={24} strokeWidth={1.5} />
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.quantity && (
                                <span className="text-xs text-gray-400">{item.quantity}</span>
                              )}
                              {item.addedBy?.name && (
                                <span className="text-[10px] text-gray-300">
                                  הוסיף: {item.addedBy.name.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </div>

                          {item.priority === 'urgent' && (
                            <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">דחוף</span>
                          )}
                          {item.priority === 'high' && (
                            <span className="text-[10px] bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full font-medium">חשוב</span>
                          )}

                          <button
                            onClick={() => handleDelete(item._id)}
                            className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 md:opacity-0 transition-all p-1.5 hover:bg-red-50 rounded-lg flex-shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Bought items */}
        {boughtItems.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                נקנו ({boughtItems.length})
              </h3>
              <button
                onClick={handleClearBought}
                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
              >
                נקה הכל
              </button>
            </div>
            <div className="space-y-1.5">
              {boughtItems.map(item => (
                <motion.div
                  key={item._id}
                  layout
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/50 group"
                >
                  <button
                    onClick={() => handleToggle(item._id)}
                    className="text-green-500 flex-shrink-0"
                  >
                    <div className="bg-green-500 rounded-full p-0.5">
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </div>
                  </button>
                  <span className="text-gray-400 line-through flex-1 text-sm truncate">{item.name}</span>
                  {item.boughtBy?.name && (
                    <span className="text-[10px] text-gray-300">
                      {item.boughtBy.name.split(' ')[0]}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
