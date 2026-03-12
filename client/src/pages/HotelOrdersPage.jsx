import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import api from '@/utils/api.js';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.jsx";
import { Card, CardContent, CardFooter } from '@/components/ui/card.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Label } from "@/components/ui/label.jsx";
import {
  PlusCircle, Trash2, Edit, Eye, Hotel, Phone, Calendar,
  User, Users, CheckCircle2, Clock, XCircle, LoaderCircle, Search, Globe, FileText, ClipboardCheck
} from 'lucide-react';

const fetchMyOrders = async () => (await api.get('/hotel-orders/my-orders')).data;
const fetchAllOrders = async () => (await api.get('/hotel-orders')).data;
const deleteOrder = (id) => api.delete(`/hotel-orders/${id}`);
const updateOrderStatus = ({ orderId, status, optimaNumber }) => api.put(`/hotel-orders/${orderId}`, { status, optimaNumber });

export default function HotelOrdersPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [closingOrderId, setClosingOrderId] = useState(null);
  const [optimaNumberInput, setOptimaNumberInput] = useState('');

  const { data: orders = [], isLoading, isError, error } = useQuery({
    queryKey: ['hotelOrders', viewMode],
    queryFn: viewMode === 'my' ? fetchMyOrders : fetchAllOrders,
  });

  const { mutate: deleteOrderMutation } = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => { toast.success('ההזמנה נמחקה!'); queryClient.invalidateQueries({ queryKey: ['hotelOrders'] }); },
    onError: () => toast.error('שגיאה במחיקת ההזמנה.')
  });

  const { mutate: updateStatusMutation, isPending: isUpdating } = useMutation({
    mutationFn: updateOrderStatus,
    onSuccess: () => {
      toast.success('סטטוס עודכן בהצלחה!');
      queryClient.invalidateQueries({ queryKey: ['hotelOrders'] });
      handleCloseDialog();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'שגיאה בעדכון סטטוס')
  });

  const processedData = useMemo(() => {
    if (!Array.isArray(orders)) return { grouped: {}, stats: { waiting: 0, done: 0, irrelevant: 0 } };
    let filtered = [...orders];

    if (searchQuery) {
      const lq = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        (o.customerName && o.customerName.toLowerCase().includes(lq)) ||
        (o.customerPhone && o.customerPhone.includes(lq)) ||
        (o.orderNumber && o.orderNumber.toString().includes(lq))
      );
    }

    const groups = {};
    const stats = { waiting: 0, done: 0, irrelevant: 0 };
    const statusPriority = { 'בהמתנה': 1, 'בוצע': 2, 'לא רלוונטי': 3 };

    filtered
      .sort((a, b) => {
        const pa = statusPriority[a.status] || 4, pb = statusPriority[b.status] || 4;
        return pa !== pb ? pa - pb : new Date(b.createdAt) - new Date(a.createdAt);
      })
      .forEach(order => {
        const hotelName = order.hotelName || 'הזמנות';
        if (!groups[hotelName]) groups[hotelName] = { 'בהמתנה': [], 'בוצע': [], 'לא רלוונטי': [] };
        const targetStatus = groups[hotelName][order.status] !== undefined ? order.status : 'בהמתנה';
        groups[hotelName][targetStatus].push(order);
        if (order.status === 'בהמתנה') stats.waiting++;
        else if (order.status === 'בוצע') stats.done++;
        else if (order.status === 'לא רלוונטי') stats.irrelevant++;
      });

    return { grouped: groups, stats };
  }, [orders, searchQuery]);

  const handleDelete = (id) => {
    if (window.confirm('האם למחוק את ההזמנה לצמיתות?')) deleteOrderMutation(id);
  };

  const handleStatusChangeRequest = (orderId, newStatus) => {
    if (newStatus === 'בוצע') {
      setClosingOrderId(orderId);
      setOptimaNumberInput('');
      setIsCloseDialogOpen(true);
    } else {
      updateStatusMutation({ orderId, status: newStatus });
    }
  };

  const confirmCloseOrder = () => updateStatusMutation({ orderId: closingOrderId, status: 'בוצע', optimaNumber: optimaNumberInput });

  const handleCloseDialog = () => {
    setIsCloseDialogOpen(false);
    setClosingOrderId(null);
    setOptimaNumberInput('');
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen"><LoaderCircle className="animate-spin text-slate-400" /></div>;
  if (isError) return <div className="text-center p-10 text-red-600">שגיאה: {error?.message || 'לא ניתן לטעון נתונים'}</div>;

  const statusDisplayOrder = ['בהמתנה', 'בוצע', 'לא רלוונטי'];

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8 bg-white min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {viewMode === 'my' ? 'ההזמנות שלי' : 'כל ההזמנות במערכת'}
          </h1>
          <p className="text-slate-500 mt-1">ניהול ומעקב אחר הזמנות מלון.</p>
        </div>
        <Button asChild size="lg" className="shadow-none bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-6">
          <Link to="/hotel-orders/new"><PlusCircle className="ml-2 h-5 w-5" /> הזמנה חדשה</Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          <button onClick={() => setViewMode('my')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'my' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <User size={16} /> שלי
          </button>
          <button onClick={() => setViewMode('all')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Globe size={16} /> הכל
          </button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input placeholder="חיפוש לפי שם, טלפון או הזמנה..." className="pr-9 bg-slate-50 border-slate-200" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex flex-col items-center justify-center border-l border-slate-200">
          <span className="text-3xl font-bold text-amber-600">{processedData.stats.waiting}</span>
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">בהמתנה</span>
        </div>
        <div className="flex flex-col items-center justify-center border-l border-slate-200">
          <span className="text-3xl font-bold text-green-600">{processedData.stats.done}</span>
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">בוצעו</span>
        </div>
        <div className="flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-400">{processedData.stats.irrelevant}</span>
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">לא רלוונטי</span>
        </div>
      </div>

      <div className="space-y-16">
        {Object.keys(processedData.grouped).length > 0 ? (
          Object.entries(processedData.grouped).map(([hotelName, hotelStatuses]) => (
            <section key={hotelName}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-700"><Hotel className="h-6 w-6" /></div>
                <h2 className="text-2xl font-bold text-slate-800">{hotelName}</h2>
              </div>
              <div className="space-y-8">
                {statusDisplayOrder.map(statusKey => {
                  const ordersInStatus = hotelStatuses[statusKey];
                  if (!ordersInStatus || ordersInStatus.length === 0) return null;
                  return (
                    <div key={statusKey}>
                      <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wide">
                        {statusKey === 'בהמתנה' && <Clock size={14} className="text-amber-500" />}
                        {statusKey === 'בוצע' && <CheckCircle2 size={14} className="text-green-500" />}
                        {statusKey === 'לא רלוונטי' && <XCircle size={14} className="text-slate-400" />}
                        {statusKey} ({ordersInStatus.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ordersInStatus.map(order => (
                          <OrderCard key={order._id} order={order} onDelete={handleDelete} onStatusChange={handleStatusChangeRequest} isUpdating={isUpdating} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="text-center p-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <p className="text-slate-500 text-lg font-medium">
              {searchQuery ? 'לא נמצאו תוצאות לחיפוש זה.' : 'אין הזמנות להצגה.'}
            </p>
            {!searchQuery && viewMode === 'my' && (
              <Button asChild variant="link" className="mt-2 text-blue-600">
                <Link to="/hotel-orders/new">צור את ההזמנה הראשונה שלך</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>סגירת הזמנה</DialogTitle>
            <DialogDescription>כדי להעביר לסטטוס "בוצע", יש להזין את מספר ההזמנה מאופטימה.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="optima" className="text-right font-bold">מס' אופטימה</Label>
              <Input id="optima" value={optimaNumberInput} onChange={(e) => setOptimaNumberInput(e.target.value)} className="col-span-3" placeholder="הזן מספר..." autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>ביטול</Button>
            <Button onClick={confirmCloseOrder} disabled={isUpdating} className="bg-green-600 hover:bg-green-700">
              {isUpdating ? <LoaderCircle className="animate-spin h-4 w-4 ml-2" /> : null}
              אישור וסגירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const OrderCard = ({ order, onDelete, onStatusChange, isUpdating }) => {
  const roomsCount = order.rooms?.length || 0;
  const totalPeople = order.rooms?.reduce((sum, r) => sum + (r.adults || 0) + (r.teens || 0) + (r.children || 0) + (r.babies || 0), 0) || 0;
  const isIrrelevant = order.status === 'לא רלוונטי';

  const statusStyles = {
    'בהמתנה': 'bg-amber-100 text-amber-800 border-amber-200',
    'בוצע': 'bg-green-100 text-green-800 border-green-200',
    'לא רלוונטי': 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <Card className={`bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all flex flex-col h-full rounded-t-xl rounded-b-sm ${isIrrelevant ? 'opacity-60 grayscale' : ''}`}>
      <div className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
        <div className="flex justify-between items-start">
          <div>
            <span className="font-mono font-bold text-slate-500 text-sm block tracking-wider">
              #{order.optimaNumber || order.orderNumber}
            </span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
              <Calendar size={10} />
              {format(new Date(order.createdAt), 'dd/MM/yy')}
            </span>
          </div>
          <div className="flex gap-1 -mt-1 -ml-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600" asChild title="ערוך">
              <Link to={`/hotel-orders/edit/${order._id}`}><Edit size={14} /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-amber-600" asChild title="הצעת מחיר">
              <Link to={`/hotel-orders/quote/${order._id}`}><FileText size={14} /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-green-600" asChild title="אישור הזמנה">
              <Link to={`/hotel-orders/confirmation/${order._id}`}><ClipboardCheck size={14} /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => onDelete(order._id)} title="מחק">
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-4 flex-1 space-y-3 bg-white">
        <div>
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <User size={16} className="text-slate-400" />
            <span className="truncate">{order.customerName}</span>
          </div>
          {order.customerPhone && (
            <a
              href={`https://wa.me/972${order.customerPhone.replace(/\D/g, '').replace(/^0/, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-green-600 mt-1 w-fit ml-6"
            >
              <Phone size={12} />
              <span dir="ltr">{order.customerPhone}</span>
            </a>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600 pt-1 border-t border-dashed border-slate-100">
          <div className="flex items-center gap-1.5 mt-2">
            <Hotel size={14} className="text-slate-400" />
            <span className="font-medium">{roomsCount} חדרים</span>
          </div>
          <span className="text-slate-300 mt-2">|</span>
          <div className="flex items-center gap-1.5 mt-2">
            <Users size={14} className="text-slate-400" />
            <span className="font-medium">{totalPeople} אורחים</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-3 px-4 border-t border-slate-100 bg-white rounded-b-sm flex justify-between items-center">
        <div className="text-slate-900 font-bold text-lg">{order.total_price?.toLocaleString()} ₪</div>
        <div className="min-w-[100px]">
          <Select value={order.status} onValueChange={(val) => onStatusChange(order._id, val)} disabled={isUpdating}>
            <SelectTrigger className={`h-8 text-xs font-bold border-0 shadow-none ring-0 focus:ring-0 px-3 rounded-full ${statusStyles[order.status] || 'bg-slate-100'}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="בהמתנה">בהמתנה</SelectItem>
              <SelectItem value="בוצע">בוצע</SelectItem>
              <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardFooter>
    </Card>
  );
};
