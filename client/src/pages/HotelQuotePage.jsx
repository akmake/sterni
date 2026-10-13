import React, { useState } from 'react';
import HotelPdfPreview from '@/components/orders/HotelPdfPreview.jsx';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { Button } from '@/components/ui/Button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input.jsx";
import { Label } from "@/components/ui/label";
import { ArrowRight, Download, Send, User, LoaderCircle, Mail, Zap, Printer } from 'lucide-react';
import { formatPhoneForWhatsApp } from '@/utils/phone.js';
import { fetchHotelOrderPdf, saveHotelOrderPdf } from '@/utils/hotelOrderPdf.js';
import toast from 'react-hot-toast';

const GOLD = '#B8963E';
const GOLD_LIGHT = '#F5E6C4';
const GOLD_DARK = '#8B6914';

const fetchOrder = async (orderId) => (await api.get(`/hotel-orders/public/${orderId}`)).data;

export default function HotelQuotePage() {
  const { orderId } = useParams();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['publicHotelOrder', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: !!orderId,
  });

  const whatsappNumber = order?.customerPhone ? formatPhoneForWhatsApp(order.customerPhone) : null;
  const hotel = order?.hotel || {};

  const generatePDF = async (action = 'download') => {
    try {
      const pdfBlob = await fetchHotelOrderPdf(orderId, 'quote', false);
      if (action === 'download') {
        const cleanName = (order.customerName || 'לקוח').replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_');
        saveHotelOrderPdf(pdfBlob, `הצעת_מחיר_${cleanName}_${order.orderNumber}.pdf`);
        return true;
      }
      return pdfBlob;
    } catch (err) {
      console.error('PDF Gen Error:', err);
      toast.error('שגיאה ביצירת הקובץ');
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const toastId = toast.loading('מכין קובץ PDF...');
    const result = await generatePDF('download');
    if (result) toast.success('הקובץ ירד!', { id: toastId });
    else toast.error('שגיאה ביצירת הקובץ', { id: toastId });
    setIsDownloading(false);
  };

  const sendEmailWithPDF = async (email, pdfBlob, filename) => {
    const formData = new FormData();
    formData.append('file', pdfBlob, filename);
    formData.append('email', email);
    formData.append('subject', `הצעת מחיר #${order.orderNumber} - ${hotel.name || ''}`);
    formData.append('body', `שלום ${order.customerName},\n\nמצורפת הצעת המחיר שלך.\n\nבברכה`);
    formData.append('displayFilename', filename);
    await api.post('/emails/send-attachment', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  };

  const handleSendEmail = async () => {
    if (!targetEmail) return toast.error('נא להזין כתובת אימייל');
    setIsSendingEmail(true);
    const toastId = toast.loading('מייצר ושולח מייל...');
    try {
      const pdfBlob = await generatePDF('blob');
      if (!pdfBlob) throw new Error('Failed to generate PDF');
      await sendEmailWithPDF(targetEmail, pdfBlob, `הצעת_מחיר_${order.orderNumber}.pdf`);
      toast.success(`המייל נשלח בהצלחה ל-${targetEmail}`, { id: toastId });
      setIsEmailDialogOpen(false);
      setTargetEmail('');
    } catch (error) {
      console.error(error);
      toast.error('שגיאה בשליחת המייל', { id: toastId });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleQuickSend = async () => {
    if (!order.customerEmail) return toast.error('לא קיים כתובת מייל בהזמנה זו.');
    if (!window.confirm(`לשלוח את ההצעה כעת ל-${order.customerEmail}?`)) return;
    setIsSendingEmail(true);
    const toastId = toast.loading(`שולח ל-${order.customerEmail}...`);
    try {
      const pdfBlob = await generatePDF('blob');
      if (!pdfBlob) throw new Error('Failed to generate PDF');
      await sendEmailWithPDF(order.customerEmail, pdfBlob, `הצעת_מחיר_${order.orderNumber}.pdf`);
      toast.success('המייל נשלח ללקוח בהצלחה!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('שגיאה בשליחת המייל', { id: toastId });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#f3f0e8' }}>
      <LoaderCircle className="animate-spin h-12 w-12" style={{ color: GOLD }} />
      <p className="text-sm" style={{ color: GOLD_DARK }}>טוען הצעת מחיר...</p>
    </div>
  );
  if (isError) return <div className="text-center p-10 text-red-500">שגיאה בטעינת ההזמנה.</div>;

  return (
    <div className="min-h-screen bg-white pb-10 font-sans">

      {/* Toolbar */}
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm no-print" style={{ borderBottomColor: GOLD_LIGHT }}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="gap-2 text-gray-600">
            <Link to="/hotel-orders"><ArrowRight className="h-4 w-4" /> חזור</Link>
          </Button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">הצעה #{order.orderNumber} | {order.customerName}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button onClick={() => window.open(`/api/hotel-orders/public/${orderId}/pdf?type=quote&includePayment=false`, '_blank', 'noopener,noreferrer')} variant="outline" size="sm" className="gap-1.5 text-gray-600 border-gray-300">
            <Printer className="h-3.5 w-3.5" /><span className="hidden sm:inline text-xs">הדפס</span>
          </Button>
          <Button onClick={handleDownloadPDF} disabled={isDownloading} size="sm" className="gap-1.5 text-white"
            style={{ background: GOLD, borderColor: GOLD }}>
            {isDownloading ? <LoaderCircle className="animate-spin h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline text-xs">הורד PDF</span>
          </Button>
          {order.customerEmail && (
            <Button onClick={handleQuickSend} disabled={isSendingEmail || isDownloading} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSendingEmail ? <LoaderCircle className="animate-spin h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline text-xs">שלח ללקוח</span>
            </Button>
          )}
          <Button onClick={() => { setTargetEmail(order.customerEmail || ''); setIsEmailDialogOpen(true); }} variant="outline" size="sm" className="gap-1.5" style={{ borderColor: GOLD, color: GOLD_DARK }}>
            <Mail className="h-3.5 w-3.5" /><span className="hidden sm:inline text-xs">מייל</span>
          </Button>
          {whatsappNumber && (
            <Button onClick={() => {
              handleDownloadPDF().then(() => {
                setTimeout(() => {
                  const text = `היי ${order.customerName}, מצורפת הצעת המחיר שלך.`;
                  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank');
                }, 1500);
              });
            }} variant="outline" size="sm" className="gap-1.5 border-green-500 text-green-700 hover:bg-green-50">
              <Send className="h-3.5 w-3.5" /><span className="hidden sm:inline text-xs">וואטסאפ</span>
            </Button>
          )}
        </div>
      </header>

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>שליחת הצעה במייל</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">מייל</Label>
              <Input id="email" type="email" placeholder="כתובת מייל" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSendEmail} disabled={isSendingEmail} style={{ background: GOLD }}>
              {isSendingEmail && <LoaderCircle className="ml-2 h-4 w-4 animate-spin" />} שלח הצעה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pages */}
      <HotelPdfPreview orderId={orderId} type="quote" />
    </div>
  );
}
