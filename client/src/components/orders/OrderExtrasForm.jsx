import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { Button } from '@/components/ui/Button.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.jsx";
import { Plus, Trash2, LoaderCircle } from 'lucide-react';

const fetchExtraTypes = async () => (await api.get('/hotel-data/extras')).data;

export function OrderExtrasForm({ extras, onChange }) {
  const { data: types = [], isLoading } = useQuery({
    queryKey: ['hotelExtraTypes'],
    queryFn: fetchExtraTypes,
    staleTime: 1000 * 60 * 5
  });

  const [newExtra, setNewExtra] = useState({ type: '', price: '' });

  const handleAdd = () => {
    if (!newExtra.type || !newExtra.price) return;
    onChange([...extras, { extraType: newExtra.type, price: parseFloat(newExtra.price), quantity: 1 }]);
    setNewExtra({ type: '', price: '' });
  };

  const handleRemove = (index) => onChange(extras.filter((_, i) => i !== index));

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-600 mb-1.5">סוג התוספת</label>
          <Select value={newExtra.type} onValueChange={(v) => setNewExtra(p => ({ ...p, type: v }))}>
            <SelectTrigger className="h-10 bg-white w-full">
              <SelectValue placeholder="בחר תוספת..." />
            </SelectTrigger>
            <SelectContent>
              {isLoading
                ? <div className="p-2 flex justify-center"><LoaderCircle className="animate-spin h-4 w-4" /></div>
                : types.length > 0
                  ? types.map(t => <SelectItem key={t._id} value={t.name}>{t.name}</SelectItem>)
                  : <div className="p-2 text-sm text-center">אין סוגים מוגדרים</div>
              }
            </SelectContent>
          </Select>
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-gray-600 mb-1.5">מחיר</label>
          <Input type="number" placeholder="0" className="h-10 bg-white" value={newExtra.price} onChange={e => setNewExtra(p => ({ ...p, price: e.target.value }))} />
        </div>
        <Button onClick={handleAdd} disabled={!newExtra.type || !newExtra.price} className="h-10 px-4">
          <Plus className="mr-2 h-4 w-4" /> הוסף
        </Button>
      </div>

      <div className="space-y-2">
        {extras.map((ex, idx) => (
          <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-md shadow-sm">
            <span className="font-medium text-base text-slate-800">{ex.extraType}</span>
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full text-sm">{ex.price.toLocaleString()} ₪</span>
              <Button variant="ghost" size="icon" onClick={() => handleRemove(idx)} className="text-slate-400 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ))}
        {extras.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
            <p className="text-slate-500">לא נבחרו תוספות להזמנה זו.</p>
          </div>
        )}
      </div>
    </div>
  );
}
