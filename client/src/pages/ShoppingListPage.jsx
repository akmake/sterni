import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Check, Circle, Trash2, Loader2,
  ShoppingCart, X, Tag, Settings2, Pencil, ChevronDown
} from 'lucide-react';
import useHouseholdStore from '@/stores/householdStore';
import useSocket from '@/hooks/useSocket';
import toast from 'react-hot-toast';

const PRIORITIES = [
  { value: 'low', label: 'נמוך', color: 'bg-slate-100 text-slate-500' },
  { value: 'normal', label: 'רגיל', color: 'bg-blue-50 text-blue-600' },
  { value: 'high', label: 'גבוה', color: 'bg-orange-50 text-orange-600' },
  { value: 'urgent', label: 'דחוף!', color: 'bg-red-50 text-red-600' },
];

export default function ShoppingListPage() {
  const socket = useSocket();
  const {
    family, fetchFamily,
    shoppingItems, shoppingLoading, fetchShopping,
    addShoppingItem, toggleShoppingItem, deleteShoppingItem, updateShoppingItem, clearBoughtItems,
    setupSocketListeners, cleanupSocketListeners,
    addCategory, removeCategory,
  } = useHouseholdStore();

  const [newItem, setNewItem] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editValues, setEditValues] = useState({});
  const inputRef = useRef(null);
  const editRef = useRef(null);

  const categories = family?.shoppingCategories || [];

  useEffect(() => {
    fetchFamily();
    fetchShopping();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !newCategory) setNewCategory(categories[0].name);
  }, [categories.length]);

  useEffect(() => {
    if (editingItem) setTimeout(() => editRef.current?.focus(), 50);
  }, [editingItem]);

  // --- Handlers ---
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setSubmitting(true);
    try {
      await addShoppingItem({
        name: newItem.trim(),
        quantity: newQuantity.trim() || undefined,
        category: newCategory || categories[0]?.name || 'כללי',
        priority: newPriority,
      });
      setNewItem('');
      setNewQuantity('');
      setNewPriority('normal');
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id) => {
    try { await toggleShoppingItem(id); } catch { toast.error('שגיאה'); }
  };

  const handleDelete = async (id) => {
    try { await deleteShoppingItem(id); } catch { toast.error('שגיאה'); }
  };

  const handleClearBought = async () => {
    if (!window.confirm('למחוק את כל הפריטים שנקנו?')) return;
    try { await clearBoughtItems(); toast.success('נוקה!'); } catch { toast.error('שגיאה'); }
  };

  const startEdit = (item) => {
    setEditingItem(item._id);
    setEditValues({ name: item.name, quantity: item.quantity || '', category: item.category || '', priority: item.priority || 'normal' });
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    const name = editValues.name?.trim();
    if (!name) { setEditingItem(null); return; }
    try {
      await updateShoppingItem(editingItem, editValues);
    } catch { toast.error('שגיאה בעדכון'); }
    setEditingItem(null);
    setEditValues({});
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try { await addCategory('shopping', { name: newCategoryName.trim() }); setNewCategoryName(''); toast.success('קטגוריה נוספה'); }
    catch (err) { toast.error(err.error || 'שגיאה'); }
  };

  const handleRemoveCategory = async (catId) => {
    try { await removeCategory('shopping', catId); toast.success('הוסרה'); }
    catch (err) { toast.error(err.error || 'שגיאה'); }
  };

  // --- Data ---
  const activeItems = shoppingItems.filter(i => !i.isBought);
  const boughtItems = shoppingItems.filter(i => i.isBought);
  const filtered = activeFilter === 'all' ? activeItems : activeItems.filter(i => i.category === activeFilter);

  const grouped = {};
  filtered.forEach(item => {
    const cat = item.category || 'כללי';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const todayDate = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">

        {/* Header */}
        <div className="mb-6 pt-2">
          <p className="text-slate-400 font-semibold text-sm uppercase tracking-wide mb-1">{todayDate}</p>
          <div className="flex justify-between items-end">
            <h1 className="text-4xl font-bold tracking-tight">רשימת קניות</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                className={`p-2.5 rounded-xl transition-colors ${showCategoryManager ? 'bg-slate-800 text-white' : 'hover:bg-white/60 text-slate-400'}`}
                title="ניהול קטגוריות"
              >
                <Settings2 size={18} />
              </button>
              <span className="text-sm font-medium bg-white px-3 py-1 rounded-full text-slate-400 shadow-sm border border-slate-100">
                {activeItems.length} פריטים
              </span>
            </div>
          </div>
        </div>

        {/* Category Manager */}
        <AnimatePresence>
          {showCategoryManager && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ניהול קטגוריות</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <span key={cat._id} className="inline-flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg text-sm border border-slate-100">
                      <Tag size={12} className="text-slate-400" />
                      {cat.name}
                      <button onClick={() => handleRemoveCategory(cat._id)} className="text-slate-300 hover:text-red-500 transition-colors mr-1">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="קטגוריה חדשה..." className="flex-1 bg-slate-50 p-2.5 rounded-xl text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20" />
                  <button type="submit" className="bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-900 transition-colors">הוסף</button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Item */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 focus-within:ring-2 ring-slate-900/5 transition-shadow mb-4">
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <div className="bg-slate-900 rounded-xl p-2.5 text-white shadow-lg shadow-slate-900/20 shrink-0">
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="הוסף פריט לרשימה..."
              className="flex-1 bg-transparent text-lg h-12 placeholder:text-slate-400 outline-none px-1"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-2 rounded-lg transition-colors shrink-0 ${showAdvanced ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
            >
              <ChevronDown size={18} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            <button type="submit" disabled={submitting || !newItem.trim()}
              className="bg-slate-100 text-slate-900 hover:bg-slate-200 font-bold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40 shrink-0">
              הוסף
            </button>
          </form>

          {/* Advanced options */}
          <AnimatePresence>
            {showAdvanced && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-3 pb-1 px-1 space-y-3 border-t border-slate-100 mt-2">
                  <input type="text" value={newQuantity} onChange={e => setNewQuantity(e.target.value)}
                    placeholder="כמות (למשל: 2 ק״ג, חבילה)" className="w-full bg-slate-50 p-2.5 rounded-xl text-sm border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20" />
                  {/* Category pills */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {categories.map(cat => (
                      <button key={cat._id} type="button" onClick={() => setNewCategory(cat.name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                          newCategory === cat.name ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  {/* Priority */}
                  <div className="flex gap-2">
                    {PRIORITIES.map(p => (
                      <button key={p.value} type="button" onClick={() => setNewPriority(p.value)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                          newPriority === p.value ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-6 pb-1">
          <button onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-100'}`}>
            הכל ({activeItems.length})
          </button>
          {categories.map(cat => {
            const count = activeItems.filter(i => i.category === cat.name).length;
            if (count === 0) return null;
            return (
              <button key={cat._id} onClick={() => setActiveFilter(cat.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeFilter === cat.name ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-100'}`}>
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Items */}
        {shoppingLoading && shoppingItems.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ShoppingCart size={32} className="text-slate-300" />
            </div>
            <p className="text-lg font-medium text-slate-400">הרשימה ריקה</p>
            <p className="text-sm text-slate-300 mt-1">הוסף פריטים למעלה</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Tag size={12} className="text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{cat}</span>
                  <span className="text-xs text-slate-300">({items.length})</span>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {items.map(item => (
                      <motion.div
                        key={item._id} layout
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }}
                        className="group bg-white p-4 rounded-2xl flex items-center gap-3 shadow-sm border border-transparent hover:border-slate-200 hover:shadow-md transition-all"
                      >
                        {/* Toggle */}
                        <button onClick={() => handleToggle(item._id)} className="text-slate-300 hover:text-green-500 transition-colors shrink-0">
                          <Circle size={24} strokeWidth={1.5} />
                        </button>

                        {/* Content */}
                        {editingItem === item._id ? (
                          <div className="flex-1 space-y-2">
                            <input ref={editRef} value={editValues.name || ''}
                              onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingItem(null); }}
                              className="w-full text-base font-medium bg-transparent border-b-2 border-blue-500 outline-none pb-1" />
                            <div className="flex gap-2 flex-wrap">
                              <input value={editValues.quantity || ''}
                                onChange={e => setEditValues(v => ({ ...v, quantity: e.target.value }))}
                                placeholder="כמות"
                                className="bg-slate-50 px-3 py-1.5 rounded-lg text-xs border border-slate-200 outline-none w-28" />
                              <select value={editValues.category || ''}
                                onChange={e => setEditValues(v => ({ ...v, category: e.target.value }))}
                                className="bg-slate-50 px-2 py-1.5 rounded-lg text-xs border border-slate-200 outline-none">
                                {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                              </select>
                              <select value={editValues.priority || 'normal'}
                                onChange={e => setEditValues(v => ({ ...v, priority: e.target.value }))}
                                className="bg-slate-50 px-2 py-1.5 rounded-lg text-xs border border-slate-200 outline-none">
                                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                              </select>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={saveEdit} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-700">שמור</button>
                              <button onClick={() => setEditingItem(null)} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-slate-200">ביטול</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.quantity && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{item.quantity}</span>}
                              {item.addedBy?.name && <span className="text-[10px] text-slate-300">הוסיף: {item.addedBy.name.split(' ')[0]}</span>}
                            </div>
                          </div>
                        )}

                        {/* Priority badge */}
                        {!editingItem && item.priority && item.priority !== 'normal' && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            PRIORITIES.find(p => p.value === item.priority)?.color || ''}`}>
                            {PRIORITIES.find(p => p.value === item.priority)?.label}
                          </span>
                        )}

                        {/* Actions */}
                        {editingItem !== item._id && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            <button onClick={() => startEdit(item)} title="ערוך"
                              className="text-slate-300 hover:text-amber-500 p-1.5 hover:bg-amber-50 rounded-lg transition-all">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => handleDelete(item._id)} title="מחק"
                              className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bought */}
        {boughtItems.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">נקנו ({boughtItems.length})</h3>
              <button onClick={handleClearBought} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">נקה הכל</button>
            </div>
            <div className="space-y-1.5">
              {boughtItems.map(item => (
                <motion.div key={item._id} layout
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/50 group hover:bg-white transition-colors">
                  <button onClick={() => handleToggle(item._id)} className="text-green-500 shrink-0">
                    <div className="bg-green-500 rounded-full p-0.5"><Check size={12} className="text-white" strokeWidth={3} /></div>
                  </button>
                  <span className="text-slate-400 line-through flex-1 text-sm truncate">{item.name}</span>
                  {item.boughtBy?.name && <span className="text-[10px] text-slate-300">{item.boughtBy.name.split(' ')[0]}</span>}
                  <button onClick={() => handleDelete(item._id)} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
            <p className="text-center text-xs text-slate-300 mt-4 font-medium">נמחקות אוטומטית אחרי 7 ימים</p>
          </div>
        )}

      </div>
    </div>
  );
}
