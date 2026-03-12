import React, { useState, useMemo, useEffect } from 'react';
import { calculateRoomTotalPrice } from '@/lib/priceCalculator';
import { Button } from '@/components/ui/Button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.jsx";
import { Label } from '@/components/ui/label.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { Moon, StickyNote, Info } from 'lucide-react';

export function AddRoomForm({ priceLists, roomTypes, numberOfNights, onNightsChange, onAddRoom, disabled, isLoading }) {
  const [room, setRoom] = useState({ adults: 2, teens: 0, children: 0, babies: 0 });
  const [roomNotes, setRoomNotes] = useState('');
  const [selectedPL, setSelectedPL] = useState([]);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(null);

  useEffect(() => {
    if (roomTypes && roomTypes.length > 0) {
      const defaultType = roomTypes.find(rt => rt.isDefault) || roomTypes[0];
      setSelectedRoomTypeId(defaultType?._id);
    } else {
      setSelectedRoomTypeId(null);
    }
  }, [roomTypes]);

  useEffect(() => {
    if (selectedPL.length > 0) {
      const lastAddedName = selectedPL[selectedPL.length - 1];
      const pl = priceLists[lastAddedName];
      if (pl && pl.fixedNights > 0) {
        onNightsChange({ target: { value: pl.fixedNights.toString() } });
      }
    }
  }, [selectedPL, priceLists, onNightsChange]);

  const currentPrice = useMemo(() => {
    if (selectedPL.length === 0 || disabled) return 0;
    const selectedType = roomTypes.find(rt => rt._id === selectedRoomTypeId);
    const supplement = selectedType ? selectedType.supplementPerNight : 0;
    return calculateRoomTotalPrice(room, priceLists, selectedPL, numberOfNights, supplement);
  }, [room, priceLists, selectedPL, disabled, numberOfNights, selectedRoomTypeId, roomTypes]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRoom(prev => ({ ...prev, [name]: parseInt(value, 10) || 0 }));
  };

  const handlePriceListToggle = (name) => {
    setSelectedPL(prev =>
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (selectedPL.length === 0) {
      alert('חובה לבחור לפחות מחירון אחד.');
      return;
    }
    const selectedTypeObj = roomTypes.find(rt => rt._id === selectedRoomTypeId);
    const typeName = selectedTypeObj ? selectedTypeObj.name : 'רגיל';
    const supplement = selectedTypeObj ? selectedTypeObj.supplementPerNight : 0;

    onAddRoom({
      ...room,
      price_list_names: selectedPL,
      price: currentPrice,
      roomTypeId: selectedRoomTypeId,
      roomType: typeName,
      roomSupplement: supplement,
      notes: roomNotes
    });

    setRoom({ adults: 2, teens: 0, children: 0, babies: 0 });
    setRoomNotes('');
    setSelectedPL([]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {disabled && isLoading && (
        <div className="text-center p-4 bg-amber-50 text-amber-800 rounded-md">טוען נתונים...</div>
      )}
      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block">סוג חדר</Label>
            <Select value={selectedRoomTypeId || ''} onValueChange={setSelectedRoomTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר סוג" />
              </SelectTrigger>
              <SelectContent>
                {roomTypes.length > 0 ? (
                  roomTypes.map(rt => (
                    <SelectItem key={rt._id} value={rt._id}>
                      {rt.name} {rt.supplementPerNight > 0 ? `(+${rt.supplementPerNight}₪)` : ''}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="default" disabled>אין סוגי חדרים</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">מספר לילות</Label>
            <div className="relative">
              <Moon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number" min="1"
                value={numberOfNights}
                onChange={onNightsChange}
                disabled={disabled}
                className="pl-9 font-bold"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[['adults','מבוגרים'],['teens','נערים'],['children','ילדים'],['babies','תינוקות']].map(([name, label]) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-600">{label}</label>
              <input
                type="number" name={name}
                value={room[name] || ''}
                placeholder="0"
                onChange={handleInputChange}
                className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                min="0"
              />
            </div>
          ))}
        </div>

        <div>
          <Label className="mb-1.5 block">הערות לחדר (אופציונלי)</Label>
          <div className="relative">
            <StickyNote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={roomNotes}
              onChange={(e) => setRoomNotes(e.target.value)}
              placeholder="לדוגמה: מיטה זוגית מופרדת..."
              className="pl-10"
            />
          </div>
        </div>

        <div>
          <label className="font-medium block mb-2">בחר מחירונים:</label>
          <div className="space-y-2 bg-slate-50 p-3 rounded-md max-h-40 overflow-y-auto">
            {Object.keys(priceLists).length > 0 ? (
              Object.keys(priceLists).map(name => {
                const pl = priceLists[name];
                return (
                  <div key={name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id={`pl-${name}`} checked={selectedPL.includes(name)} onChange={() => handlePriceListToggle(name)} className="h-4 w-4 rounded border-gray-300" />
                      <label htmlFor={`pl-${name}`} className="text-sm cursor-pointer select-none">{name}</label>
                    </div>
                    {pl.fixedNights > 0 && (
                      <span className="text-[10px] bg-blue-100 px-1.5 py-0.5 rounded text-blue-700 font-medium">
                        חבילת {pl.fixedNights} לילות
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">{!disabled ? 'לא נמצאו מחירונים עבור מלון זה.' : ''}</p>
            )}
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
          <div className="flex justify-between items-center">
            <span className="text-sm text-blue-800">מחיר סופי לחדר זה:</span>
            <span className="text-xl font-bold text-blue-700">{currentPrice.toLocaleString()} ₪</span>
          </div>
          <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
            <Info size={10} /> מחיר החבילה קבוע. רק תוספת סוג חדר מוכפלת בלילות.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={disabled}>הוסף חדר להזמנה</Button>
      </fieldset>
    </form>
  );
}
