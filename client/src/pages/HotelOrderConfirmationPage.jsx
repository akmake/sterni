import React, { useState } from 'react';
import HotelPdfPreview from '@/components/orders/HotelPdfPreview.jsx';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { Button } from '@/components/ui/Button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input.jsx";
import { Label } from "@/components/ui/label";
import { ArrowRight, Download, Send, User, LoaderCircle, Mail, Printer, CheckCircle, Zap } from 'lucide-react';
import { formatPhoneForWhatsApp } from '@/utils/phone.js';
import { fetchHotelOrderPdf, saveHotelOrderPdf } from '@/utils/hotelOrderPdf.js';
import toast from 'react-hot-toast';

const fetchOrder = async (orderId) => (await api.get(`/hotel-orders/public/${orderId}`)).data;

export default function HotelOrderConfirmationPage() {
  const { orderId } = useParams();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['publicHotelOrderConfirm', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: !!orderId,
  });

  const whatsappNumber = order?.customerPhone ? formatPhoneForWhatsApp(order.customerPhone) : null;
  const hotel = order?.hotel || {};
  const displayOrderId = order?.optimaNumber || order?.orderNumber;

  const generatePDF = async (action = 'download', skipPaymentPage = false) => {
    setIsDownloading(true);
    const toastId = toast.loading('מכין קובץ אישור...');
    try {
      const pdfBlob = await fetchHotelOrderPdf(orderId, 'confirmation', !skipPaymentPage);
      if (action === 'download') {
        const cleanName = (order.customerName || 'לקוח').replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_');
        saveHotelOrderPdf(pdfBlob, `אישור_הזמנה_${cleanName}_${displayOrderId}.pdf`);
        toast.success('הקובץ ירד!', { id: toastId });
        return true;
      }
      toast.dismiss(toastId);
      return pdfBlob;
    } catch (err) {
      console.error(err);
      toast.error('שגיאה ביצירת הקובץ', { id: toastId });
      return null;
    } finally {
      setIsDownloading(false);
    }
  };

  const sendEmailWithPDF = async (email, pdfBlob, filename) => {
    const formData = new FormData();
    formData.append('file', pdfBlob, filename);
    formData.append('email', email);
    formData.append('subject', `אישור הזמנה #${displayOrderId} - ${hotel.name || ''}`);
    formData.append('body', `שלום ${order.customerName},\n\nמצורף אישור ההזמנה שלך.\n\nבברכה`);
    formData.append('displayFilename', filename);
    await api.post('/emails/send-attachment', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  };

  const handleSendEmail = async () => {
    if (!targetEmail) return toast.error('נא להזין כתובת אימייל');
    setIsSendingEmail(true);
    const toastId = toast.loading('מייצר ושולח מייל...');
    try {
      const pdfBlob = await generatePDF('blob', true);
      if (!pdfBlob) throw new Error('Failed to generate PDF');
      await sendEmailWithPDF(targetEmail, pdfBlob, `אישור_הזמנה_${displayOrderId}.pdf`);
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
    if (!window.confirm(`לשלוח את האישור כעת ל-${order.customerEmail}?`)) return;
    setIsSendingEmail(true);
    const toastId = toast.loading(`שולח ל-${order.customerEmail}...`);
    try {
      const pdfBlob = await generatePDF('blob', true);
      if (!pdfBlob) throw new Error('Failed to generate PDF');
      await sendEmailWithPDF(order.customerEmail, pdfBlob, `אישור_הזמנה_${displayOrderId}.pdf`);
      toast.success('המייל נשלח ללקוח בהצלחה!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('שגיאה בשליחת המייל', { id: toastId });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><LoaderCircle className="animate-spin h-10 w-10 text-green-600" /></div>;
  if (isError) return <div className="text-center p-10">שגיאה בטעינת ההזמנה.</div>;

  return (
    <div className="min-h-screen bg-white pb-10 font-sans">

      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link to="/hotel-orders"><ArrowRight className="ml-2 h-4 w-4" /> חזור</Link>
          </Button>
          <span className="font-bold text-green-700 hidden sm:inline flex items-center gap-2">
            <CheckCircle className="h-5 w-5" /> אישור הזמנה (#{displayOrderId})
          </span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.open(`/api/hotel-orders/public/${orderId}/pdf?type=confirmation&includePayment=true`, '_blank', 'noopener,noreferrer')} variant="outline" className="gap-2"><Printer className="h-4 w-4" /> הדפס</Button>
          <Button onClick={() => generatePDF('download', false)} disabled={isDownloading} className="bg-green-600 hover:bg-green-700 text-white gap-2">
            {isDownloading ? <LoaderCircle className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
            <span className="hidden sm:inline">הורד אישור</span>
          </Button>
          {order.customerEmail && (
            <Button onClick={handleQuickSend} disabled={isSendingEmail || isDownloading} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {isSendingEmail ? <LoaderCircle className="animate-spin h-4 w-4" /> : <Zap className="h-4 w-4" />}
              <span className="hidden sm:inline">שלח ללקוח</span>
            </Button>
          )}
          <Button onClick={() => setIsEmailDialogOpen(true)} variant="outline" className="gap-2 border-blue-600 text-blue-700 hover:bg-blue-50">
            <Mail className="h-4 w-4" /><span className="hidden sm:inline">שלח למייל אחר</span>
          </Button>
          {whatsappNumber && (
            <Button onClick={() => {
              generatePDF('download', true).then(() => {
                setTimeout(() => {
                  const text = `היי ${order.customerName}, מצורף אישור ההזמנה שלך.`;
                  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank');
                }, 1500);
              });
            }} variant="outline" className="gap-2 border-green-600 text-green-700 hover:bg-green-50">
              <Send className="h-4 w-4" /><span className="hidden sm:inline">וואטסאפ</span>
            </Button>
          )}
        </div>
      </header>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>שליחת אישור במייל</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">מייל</Label>
              <Input id="email" type="email" placeholder="כתובת מייל הלקוח" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSendEmail} disabled={isSendingEmail}>
              {isSendingEmail && <LoaderCircle className="ml-2 h-4 w-4 animate-spin" />} שלח
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HotelPdfPreview orderId={orderId} type="confirmation" />
    </div>
  );
}
