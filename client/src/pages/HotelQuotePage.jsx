import React, { useRef, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api.js';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input.jsx";
import { Label } from "@/components/ui/label";
import { ArrowRight, Download, Send, User, LoaderCircle, Mail, Zap, Printer, BedDouble, Star, CalendarDays, Moon, Tag, Hash } from 'lucide-react';
import { formatPhoneForWhatsApp } from '@/utils/phone.js';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

const LOGO_URL = `/pop.png`;

const GOLD = '#B8963E';
const GOLD_LIGHT = '#F5E6C4';
const GOLD_DARK = '#8B6914';

const printStyles = `
  @media print {
    @page { size: A4; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #f3f0e8; }
    .no-print { display: none !important; }
    .quote-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
  }
`;

const fetchOrder = async (orderId) => (await api.get(`/hotel-orders/public/${orderId}`)).data;

export default function HotelQuotePage() {
  const { orderId } = useParams();
  const pagesContainerRef = useRef(null);
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

  const pages = useMemo(() => {
    if (!order) return [];

    const roomItems = (order.rooms || []).map((room, idx) => ({
      _type: 'room', _id: `room-${idx}`, serialNumber: idx + 1,
      name: room.roomType || 'חדר רגיל',
      description: room.price_list_names?.join(' + '),
      roomNote: room.notes, details: room, price: room.price
    }));

    const startExtraIndex = roomItems.length + 1;
    const extraItems = (order.extras || []).map((extra, idx) => ({
      _type: 'extra', _id: `extra-${idx}`, serialNumber: startExtraIndex + idx,
      name: extra.extraType, description: 'תוספת להזמנה',
      details: extra, price: extra.price * extra.quantity
    }));

    let allContent = [...roomItems];
    if (extraItems.length > 0) {
      allContent.push({ _type: 'header', name: 'תוספות ושדרוגים' });
      allContent = [...allContent, ...extraItems];
    }

    const ITEMS_PER_FIRST_PAGE = 4;
    const ITEMS_PER_MIDDLE_PAGE = 7;
    const ITEMS_PER_LAST_PAGE = 7;

    const resultPages = [];
    if (allContent.length === 0) {
      resultPages.push({ items: [], isFirst: true, isLast: true, pageIndex: 0 });
      return resultPages;
    }

    const firstPageItems = allContent.slice(0, ITEMS_PER_FIRST_PAGE);
    let remainingItems = allContent.slice(ITEMS_PER_FIRST_PAGE);
    resultPages.push({ items: firstPageItems, isFirst: true, isLast: remainingItems.length === 0, pageIndex: 0 });

    let pIndex = 1;
    while (remainingItems.length > 0) {
      if (remainingItems.length <= ITEMS_PER_MIDDLE_PAGE) {
        if (remainingItems.length > ITEMS_PER_LAST_PAGE) {
          const takeCount = remainingItems.length - ITEMS_PER_LAST_PAGE;
          resultPages.push({ items: remainingItems.slice(0, takeCount), isFirst: false, isLast: false, pageIndex: pIndex });
          remainingItems = remainingItems.slice(takeCount);
          pIndex++;
        } else {
          resultPages.push({ items: remainingItems, isFirst: false, isLast: true, pageIndex: pIndex });
          remainingItems = [];
        }
      } else {
        resultPages.push({ items: remainingItems.slice(0, ITEMS_PER_MIDDLE_PAGE), isFirst: false, isLast: false, pageIndex: pIndex });
        remainingItems = remainingItems.slice(ITEMS_PER_MIDDLE_PAGE);
        pIndex++;
      }
    }
    return resultPages;
  }, [order]);

  const generatePDF = async (action = 'download') => {
    if (!pagesContainerRef.current) return null;
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageElements = pagesContainerRef.current.querySelectorAll('.quote-page');
      for (let i = 0; i < pageElements.length; i++) {
        const canvas = await html2canvas(pageElements[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgHeight = canvas.height * (pdfWidth / canvas.width);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
      }
      if (action === 'download') {
        const cleanName = (order.customerName || 'לקוח').replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_');
        pdf.save(`הצעת_מחיר_${cleanName}_${order.orderNumber}.pdf`);
        return true;
      } else if (action === 'blob') {
        return pdf.output('blob');
      }
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
    await generatePDF('download');
    toast.success('הקובץ ירד!', { id: toastId });
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
    <div className="min-h-screen pb-10 font-sans" style={{ background: 'linear-gradient(135deg, #f3f0e8 0%, #ede8d8 100%)' }}>
      <style>{printStyles}</style>

      {/* Toolbar */}
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm no-print" style={{ borderBottomColor: GOLD_LIGHT }}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="gap-2 text-gray-600">
            <Link to="/hotel-orders"><ArrowRight className="h-4 w-4" /> חזור</Link>
          </Button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: GOLD_LIGHT, color: GOLD_DARK }}>
              {pages.length} {pages.length === 1 ? 'עמוד' : 'עמודים'}
            </span>
            <span className="text-sm font-semibold text-gray-700">הצעה #{order.orderNumber} | {order.customerName}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-1.5 text-gray-600 border-gray-300">
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
      <div className="flex flex-col items-center py-10 gap-10" ref={pagesContainerRef}>
        {pages.map((pageData, index) => (
          <div
            key={index}
            className="quote-page bg-white shadow-2xl mx-auto flex flex-col overflow-hidden"
            style={{ width: '210mm', minHeight: '297mm', position: 'relative' }}
          >
            {/* Gold top bar */}
            <div style={{ height: '6px', background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD}, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})` }} />

            <div style={{ padding: '12mm 14mm', flex: 1, display: 'flex', flexDirection: 'column' }}>

              {pageData.isFirst ? (
                <>
                  {/* Header */}
                  <div className="flex justify-between items-start mb-8">
                    {/* Left: title */}
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div style={{ width: '4px', height: '52px', background: `linear-gradient(180deg, ${GOLD}, ${GOLD_DARK})`, borderRadius: '2px' }} />
                        <div>
                          <h1 className="text-4xl font-black tracking-tight text-gray-900" style={{ letterSpacing: '-0.5px' }}>הצעת מחיר</h1>
                          <p className="text-sm font-medium mt-0.5" style={{ color: GOLD_DARK }}>PRICE QUOTATION</p>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" style={{ color: GOLD }} />
                          מספר: <strong className="text-gray-800 font-mono">{order.orderNumber}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" style={{ color: GOLD }} />
                          הופק: <strong className="text-gray-800">{format(new Date(), 'dd/MM/yyyy')}</strong>
                        </span>
                      </div>
                    </div>
                    {/* Right: logo */}
                    <div className="flex flex-col items-end">
                      <img
                        src={LOGO_URL}
                        alt="Logo"
                        style={{ height: '90px', objectFit: 'contain', maxWidth: '180px' }}
                        crossOrigin="anonymous"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    </div>
                  </div>

                  {/* Hotel banner */}
                  <div className="rounded-xl mb-6 overflow-hidden" style={{ border: `1px solid ${GOLD_LIGHT}` }}>
                    <div className="flex items-center justify-between px-5 py-3" style={{ background: `linear-gradient(135deg, #1a1a1a, #2d2d2d)` }}>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4" style={{ color: GOLD }} fill={GOLD} />
                        <span className="font-bold text-lg" style={{ color: GOLD }}>{hotel.name || order.hotelName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs" style={{ color: GOLD_LIGHT }}>
                        {order.eventDate && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {format(new Date(order.eventDate), 'dd/MM/yyyy')}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Moon className="h-3.5 w-3.5" />
                          {order.numberOfNights || 1} {(order.numberOfNights || 1) === 1 ? 'לילה' : 'לילות'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer details */}
                  <div className="rounded-xl p-5 mb-7" style={{ background: '#fafaf8', border: `1px solid ${GOLD_LIGHT}` }}>
                    <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: `1px solid ${GOLD_LIGHT}` }}>
                      <div className="p-1.5 rounded-lg" style={{ background: GOLD_LIGHT }}>
                        <User className="h-4 w-4" style={{ color: GOLD_DARK }} />
                      </div>
                      <span className="font-bold text-gray-800 text-sm">פרטי המזמין</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">שם לקוח</p>
                        <p className="font-bold text-gray-900 text-base">{order.customerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">טלפון</p>
                        <p className="font-bold text-gray-900 text-base" dir="ltr">{order.customerPhone}</p>
                      </div>
                      {order.customerEmail && (
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">אימייל</p>
                          <p className="font-medium text-gray-800 text-sm">{order.customerEmail}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center pb-4 mb-5" style={{ borderBottom: `1px solid ${GOLD_LIGHT}` }}>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4" style={{ color: GOLD }} fill={GOLD} />
                    <span className="font-bold text-sm text-gray-700">{hotel.name || order.hotelName}</span>
                  </div>
                  <div className="text-xs text-gray-400">דף {index + 1} / {pages.length} · הזמנה #{order.orderNumber}</div>
                </div>
              )}

              {/* Items table */}
              <div style={{ flex: 1 }}>
                {pageData.isFirst && (
                  <div className="flex items-center gap-2 mb-3">
                    <BedDouble className="h-4 w-4" style={{ color: GOLD }} />
                    <span className="font-bold text-sm text-gray-800">פירוט ההזמנה</span>
                  </div>
                )}

                <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${GOLD_LIGHT}` }}>
                  <table className="w-full text-sm text-right" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)' }}>
                        <th className="py-2.5 px-3 font-semibold w-10 text-center" style={{ color: GOLD_LIGHT }}>#</th>
                        <th className="py-2.5 px-4 font-semibold" style={{ color: GOLD_LIGHT }}>תיאור</th>
                        <th className="py-2.5 px-4 font-semibold w-1/3" style={{ color: GOLD_LIGHT }}>הרכב / כמות</th>
                        <th className="py-2.5 px-4 font-semibold text-left w-28" style={{ color: GOLD }}>מחיר</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageData.items.map((item, idx) => {
                        if (item._type === 'header') {
                          return (
                            <tr key={`header-${idx}`}>
                              <td colSpan="4" className="py-2 px-4 font-bold text-sm" style={{ background: GOLD_LIGHT, color: GOLD_DARK, borderTop: `1px solid ${GOLD_LIGHT}`, borderBottom: `1px solid ${GOLD_LIGHT}` }}>
                                <div className="flex items-center gap-1.5">
                                  <Tag className="h-3.5 w-3.5" />
                                  {item.name}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        const isEven = idx % 2 === 0;
                        return (
                          <tr key={idx} style={{ background: isEven ? '#ffffff' : '#fafaf8', borderBottom: `1px solid ${GOLD_LIGHT}` }}>
                            <td className="py-4 px-3 align-top text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: GOLD_LIGHT, color: GOLD_DARK }}>
                                {item.serialNumber}
                              </span>
                            </td>
                            <td className="py-4 px-4 align-top">
                              <p className="font-bold text-gray-900">{item.name}</p>
                              {item._type === 'room' && item.description && (
                                <p className="text-xs mt-1 px-2 py-0.5 rounded inline-block font-medium" style={{ background: GOLD_LIGHT, color: GOLD_DARK }}>{item.description}</p>
                              )}
                              {item._type === 'room' && item.roomNote && (
                                <p className="text-xs mt-1.5 italic text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 inline-block">
                                  הערה: {item.roomNote}
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 align-top text-gray-600 text-sm">
                              {item._type === 'room' ? (
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                  {item.details.adults > 0 && <span>{item.details.adults} מבוגרים</span>}
                                  {item.details.teens > 0 && <span>{item.details.teens} נערים</span>}
                                  {item.details.children > 0 && <span>{item.details.children} ילדים</span>}
                                  {item.details.babies > 0 && <span>{item.details.babies} תינוקות</span>}
                                </div>
                              ) : (
                                <span>כמות: {item.details.quantity}</span>
                              )}
                            </td>
                            <td className="py-4 px-4 align-top text-left">
                              <span className="font-bold text-gray-900">{item.price.toLocaleString()}</span>
                              <span className="text-xs text-gray-400 mr-0.5"> ₪</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer - last page only */}
              {pageData.isLast ? (
                <div className="mt-auto pt-6">
                  {/* Notes */}
                  {order.notes && (
                    <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: '#fffbf0', border: `1px solid ${GOLD_LIGHT}`, whiteSpace: 'pre-wrap', color: '#555' }}>
                      <p className="font-bold text-xs mb-2" style={{ color: GOLD_DARK }}>הערות ודגשים:</p>
                      {order.notes}
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex justify-between items-end" style={{ borderTop: `2px solid ${GOLD_LIGHT}`, paddingTop: '16px' }}>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>* הצעה זו תקפה בכפוף לזמינות החדרים.</p>
                      <p>* ט.ל.ח.</p>
                    </div>
                    <div className="text-left">
                      {order.discountPercent > 0 && (
                        <div className="text-sm text-red-500 mb-1 text-left">
                          הנחה {order.discountPercent}% ·{' '}
                          <span className="font-semibold">
                            -{((order.total_price / (1 - order.discountPercent / 100)) * (order.discountPercent / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })} ₪
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-gray-500">סה"כ לתשלום</span>
                        <span className="text-4xl font-black" style={{ color: GOLD_DARK }}>
                          {order.total_price.toLocaleString()}
                        </span>
                        <span className="text-lg font-bold" style={{ color: GOLD }}>₪</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom branding */}
                  <div className="mt-8 pt-4 flex items-center justify-center gap-3" style={{ borderTop: `1px solid ${GOLD_LIGHT}` }}>
                    <div style={{ width: '40px', height: '1px', background: GOLD_LIGHT }} />
                    <p className="text-xs text-gray-300">הופק ע"י מערכת ניהול הזמנות</p>
                    <div style={{ width: '40px', height: '1px', background: GOLD_LIGHT }} />
                  </div>
                </div>
              ) : (
                <div className="mt-auto text-center pt-6">
                  <p className="text-xs" style={{ color: GOLD_LIGHT }}>המשך בעמוד הבא ›</p>
                </div>
              )}
            </div>

            {/* Gold bottom bar */}
            <div style={{ height: '4px', background: `linear-gradient(90deg, ${GOLD_DARK}, ${GOLD}, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
