import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, Hotel, DollarSign, BedDouble, UtensilsCrossed } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';

// ─── Generic inline-edit table ────────────────────────────────────────────────

function ManageTable({ columns, rows, onAdd, onSave, onDelete, emptyLabel }) {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addData, setAddData] = useState({});

  const startEdit = (row) => {
    setEditingId(row._id);
    const init = {};
    columns.forEach(c => { init[c.key] = row[c.key] ?? c.default ?? ''; });
    setEditData(init);
  };

  const startAdd = () => {
    const init = {};
    columns.forEach(c => { init[c.key] = c.default ?? ''; });
    setAddData(init);
    setShowAdd(true);
  };

  const handleSave = async () => {
    await onSave(editingId, editData);
    setEditingId(null);
  };

  const handleAdd = async () => {
    await onAdd(addData);
    setShowAdd(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={startAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus size={16} /> הוסף
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map(c => (
                <th key={c.key} className="px-4 py-3 text-right font-semibold text-gray-700">{c.label}</th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-gray-700">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {showAdd && (
              <tr className="bg-blue-50 border-b border-gray-200">
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-2">
                    {c.type === 'select' ? (
                      <select
                        value={addData[c.key]}
                        onChange={e => setAddData({ ...addData, [c.key]: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-sm"
                      >
                        <option value="">בחר...</option>
                        {c.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type={c.type || 'text'}
                        value={addData[c.key]}
                        onChange={e => setAddData({ ...addData, [c.key]: e.target.value })}
                        placeholder={c.label}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        autoFocus={c.autoFocus}
                      />
                    )}
                  </td>
                ))}
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button onClick={handleAdd} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={16} /></button>
                    <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><X size={16} /></button>
                  </div>
                </td>
              </tr>
            )}

            {rows.length === 0 && !showAdd ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-400">{emptyLabel}</td>
              </tr>
            ) : rows.map(row => (
              <tr key={row._id} className="border-b border-gray-100 hover:bg-gray-50">
                {editingId === row._id ? (
                  <>
                    {columns.map(c => (
                      <td key={c.key} className="px-4 py-2">
                        {c.type === 'select' ? (
                          <select
                            value={editData[c.key]}
                            onChange={e => setEditData({ ...editData, [c.key]: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-sm"
                          >
                            {c.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input
                            type={c.type || 'text'}
                            value={editData[c.key]}
                            onChange={e => setEditData({ ...editData, [c.key]: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button onClick={handleSave} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={16} /></button>
                        <button onClick={() => setEditingId(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded"><X size={16} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    {columns.map(c => (
                      <td key={c.key} className="px-4 py-2 text-gray-800">
                        {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(row)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title="עריכה"><Edit2 size={15} /></button>
                        <button onClick={() => onDelete(row._id)} className="text-red-600 hover:bg-red-50 p-1 rounded" title="מחיקה"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'hotels',     label: 'מלונות',       icon: Hotel },
  { key: 'pricelists', label: 'מחירונים',      icon: DollarSign },
  { key: 'roomtypes',  label: 'סוגי חדרים',   icon: BedDouble },
  { key: 'extras',     label: 'תוספות',        icon: UtensilsCrossed },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HotelDataAdminPage() {
  const [activeTab, setActiveTab] = useState('hotels');
  const [hotels, setHotels]         = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [roomTypes, setRoomTypes]   = useState([]);
  const [extras, setExtras]         = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [h, p, rt, e] = await Promise.all([
        api.get('/hotel-data/hotels'),
        api.get('/hotel-data/pricelists'),
        api.get('/hotel-data/room-types/all').catch(() => ({ data: [] })),
        api.get('/hotel-data/extras'),
      ]);
      setHotels(h.data);
      setPriceLists(p.data);
      // room-types per hotel — fetch for all hotels
      const allRooms = await fetchAllRoomTypes(h.data);
      setRoomTypes(allRooms);
      setExtras(e.data);
    } catch (err) {
      toast.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRoomTypes = async (hotelList) => {
    if (!hotelList.length) return [];
    const results = await Promise.all(
      hotelList.map(h => api.get(`/hotel-data/room-types/${h._id}`).then(r => r.data).catch(() => []))
    );
    return results.flat();
  };

  const hotelOptions = hotels.map(h => ({ value: h._id, label: h.name }));
  const hotelName = (id) => hotels.find(h => h._id === id)?.name ?? id;

  // ── Hotels ──
  const hotelColumns = [
    { key: 'name', label: 'שם מלון', autoFocus: true },
  ];

  const addHotel = async (data) => {
    try {
      const res = await api.post('/hotel-data/hotels', data);
      setHotels(prev => [...prev, res.data]);
      toast.success('מלון נוצר');
    } catch { toast.error('שגיאה ביצירת מלון'); }
  };

  const saveHotel = async (id, data) => {
    try {
      const res = await api.put(`/hotel-data/hotels/${id}`, data);
      setHotels(prev => prev.map(h => h._id === id ? res.data : h));
      toast.success('מלון עודכן');
    } catch { toast.error('שגיאה בעדכון מלון'); }
  };

  const deleteHotel = async (id) => {
    if (!window.confirm('למחוק מלון זה?')) return;
    try {
      await api.delete(`/hotel-data/hotels/${id}`);
      setHotels(prev => prev.filter(h => h._id !== id));
      setPriceLists(prev => prev.filter(p => p.hotel !== id));
      setRoomTypes(prev => prev.filter(r => r.hotel !== id));
      toast.success('מלון נמחק');
    } catch { toast.error('שגיאה במחיקת מלון'); }
  };

  // ── Price Lists ──
  const priceListColumns = [
    { key: 'hotel',       label: 'מלון',       type: 'select', options: hotelOptions, render: (v) => hotelName(v) },
    { key: 'name',        label: 'שם מחירון',  autoFocus: true },
    { key: 'couple',      label: 'זוגי',       type: 'number', default: 0 },
    { key: 'teen',        label: 'נוער',       type: 'number', default: 0 },
    { key: 'child',       label: 'ילד',        type: 'number', default: 0 },
    { key: 'baby',        label: 'תינוק',      type: 'number', default: 0 },
    { key: 'single_room', label: 'חדר יחיד',  type: 'number', default: 0 },
    { key: 'fixedNights', label: 'לילות קבועים', type: 'number', default: 0 },
    { key: 'maxNights',   label: 'מקס׳ לילות', type: 'number', default: 0 },
    { key: 'isVisible',   label: 'פעיל',       type: 'select',
      options: [{ value: true, label: 'כן' }, { value: false, label: 'לא' }],
      default: true,
      render: (v) => v ? <span className="text-green-600 font-medium">כן</span> : <span className="text-gray-400">לא</span>
    },
  ];

  const addPriceList = async (data) => {
    try {
      const res = await api.post('/hotel-data/pricelists', {
        ...data,
        couple: Number(data.couple), teen: Number(data.teen),
        child: Number(data.child), baby: Number(data.baby),
        single_room: Number(data.single_room),
        fixedNights: Number(data.fixedNights), maxNights: Number(data.maxNights),
        isVisible: data.isVisible === 'false' ? false : Boolean(data.isVisible),
      });
      setPriceLists(prev => [...prev, res.data]);
      toast.success('מחירון נוצר');
    } catch { toast.error('שגיאה ביצירת מחירון'); }
  };

  const savePriceList = async (id, data) => {
    try {
      const res = await api.put(`/hotel-data/pricelists/${id}`, {
        ...data,
        couple: Number(data.couple), teen: Number(data.teen),
        child: Number(data.child), baby: Number(data.baby),
        single_room: Number(data.single_room),
        fixedNights: Number(data.fixedNights), maxNights: Number(data.maxNights),
        isVisible: data.isVisible === 'false' ? false : Boolean(data.isVisible),
      });
      setPriceLists(prev => prev.map(p => p._id === id ? res.data : p));
      toast.success('מחירון עודכן');
    } catch { toast.error('שגיאה בעדכון מחירון'); }
  };

  const deletePriceList = async (id) => {
    if (!window.confirm('למחוק מחירון זה?')) return;
    try {
      await api.delete(`/hotel-data/pricelists/${id}`);
      setPriceLists(prev => prev.filter(p => p._id !== id));
      toast.success('מחירון נמחק');
    } catch { toast.error('שגיאה במחיקת מחירון'); }
  };

  // ── Room Types ──
  const roomTypeColumns = [
    { key: 'hotel',               label: 'מלון',             type: 'select', options: hotelOptions, render: (v) => hotelName(v) },
    { key: 'name',                label: 'שם סוג חדר',       autoFocus: true },
    { key: 'supplementPerNight',  label: 'תוספת ללילה (₪)',  type: 'number', default: 0 },
    { key: 'isDefault',           label: 'ברירת מחדל',       type: 'select',
      options: [{ value: true, label: 'כן' }, { value: false, label: 'לא' }],
      default: false,
      render: (v) => v ? <span className="text-blue-600 font-medium">כן</span> : '—'
    },
  ];

  const addRoomType = async (data) => {
    try {
      const res = await api.post('/hotel-data/room-types', {
        ...data,
        supplementPerNight: Number(data.supplementPerNight),
        isDefault: data.isDefault === 'true' || data.isDefault === true,
      });
      setRoomTypes(prev => [...prev, res.data]);
      toast.success('סוג חדר נוצר');
    } catch { toast.error('שגיאה ביצירת סוג חדר'); }
  };

  const saveRoomType = async (id, data) => {
    try {
      const res = await api.put(`/hotel-data/room-types/${id}`, {
        ...data,
        supplementPerNight: Number(data.supplementPerNight),
        isDefault: data.isDefault === 'true' || data.isDefault === true,
      });
      setRoomTypes(prev => prev.map(r => r._id === id ? res.data : r));
      toast.success('סוג חדר עודכן');
    } catch { toast.error('שגיאה בעדכון סוג חדר'); }
  };

  const deleteRoomType = async (id) => {
    if (!window.confirm('למחוק סוג חדר זה?')) return;
    try {
      await api.delete(`/hotel-data/room-types/${id}`);
      setRoomTypes(prev => prev.filter(r => r._id !== id));
      toast.success('סוג חדר נמחק');
    } catch { toast.error('שגיאה במחיקת סוג חדר'); }
  };

  // ── Extras ──
  const extraColumns = [
    { key: 'name', label: 'שם תוספת', autoFocus: true },
  ];

  const addExtra = async (data) => {
    try {
      const res = await api.post('/hotel-data/extras', data);
      setExtras(prev => [...prev, res.data]);
      toast.success('תוספת נוצרה');
    } catch { toast.error('שגיאה ביצירת תוספת'); }
  };

  const saveExtra = async (id, data) => {
    try {
      const res = await api.put(`/hotel-data/extras/${id}`, data);
      setExtras(prev => prev.map(e => e._id === id ? res.data : e));
      toast.success('תוספת עודכנה');
    } catch { toast.error('שגיאה בעדכון תוספת'); }
  };

  const deleteExtra = async (id) => {
    if (!window.confirm('למחוק תוספת זו?')) return;
    try {
      await api.delete(`/hotel-data/extras/${id}`);
      setExtras(prev => prev.filter(e => e._id !== id));
      toast.success('תוספת נמחקה');
    } catch { toast.error('שגיאה במחיקת תוספת'); }
  };

  // ── Render ──
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">ניהול נתוני מלונות</h1>
        <p className="text-gray-500 mt-1">הגדרת מלונות, מחירונים, סוגי חדרים ותוספות</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">טוען...</div>
      ) : (
        <div>
          {activeTab === 'hotels' && (
            <ManageTable
              columns={hotelColumns}
              rows={hotels}
              onAdd={addHotel}
              onSave={saveHotel}
              onDelete={deleteHotel}
              emptyLabel="אין מלונות במערכת"
            />
          )}
          {activeTab === 'pricelists' && (
            <ManageTable
              columns={priceListColumns}
              rows={priceLists}
              onAdd={addPriceList}
              onSave={savePriceList}
              onDelete={deletePriceList}
              emptyLabel="אין מחירונים במערכת"
            />
          )}
          {activeTab === 'roomtypes' && (
            <ManageTable
              columns={roomTypeColumns}
              rows={roomTypes}
              onAdd={addRoomType}
              onSave={saveRoomType}
              onDelete={deleteRoomType}
              emptyLabel="אין סוגי חדרים במערכת"
            />
          )}
          {activeTab === 'extras' && (
            <ManageTable
              columns={extraColumns}
              rows={extras}
              onAdd={addExtra}
              onSave={saveExtra}
              onDelete={deleteExtra}
              emptyLabel="אין תוספות במערכת"
            />
          )}
        </div>
      )}
    </div>
  );
}
