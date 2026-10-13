import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { fetchHotelOrderPdf } from '@/utils/hotelOrderPdf.js';
import { Button } from '@/components/ui/Button.jsx';
import { LoaderCircle } from 'lucide-react';

GlobalWorkerOptions.workerSrc = workerUrl;

function PdfPage({ document, number, width }) {
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let rendering;
    let textLayer;
    setError(false);
    async function render() {
      const page = await document.getPage(number);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const container = textRef.current;
      container.replaceChildren();
      container.style.setProperty('--scale-factor', viewport.scale);
      container.style.setProperty('--total-scale-factor', viewport.scale);
      rendering = page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport,
        transform: [ratio, 0, 0, ratio, 0, 0], background: '#ffffff' });
      await rendering.promise;
      if (cancelled) return;
      textLayer = new TextLayer({ textContentSource: page.streamTextContent(), container, viewport });
      await textLayer.render();
    }
    render().catch(error => { if (!cancelled && error.name !== 'RenderingCancelledException') setError(true); });
    return () => { cancelled = true; rendering?.cancel(); textLayer?.cancel(); };
  }, [document, number, width]);
  return <article aria-label={`עמוד ${number}`} className="mx-auto mb-8" style={{ width, maxWidth: '100%' }}>
    <p className="mb-2 text-center text-xs text-gray-500">עמוד {number} מתוך {document.numPages}</p>
    <div className="relative overflow-hidden border border-gray-200 bg-white shadow-sm" style={{ minHeight: width * 1.414 }}>
      <canvas ref={canvasRef} aria-label={`מסמך - עמוד ${number}`} className="block" />
      <div ref={textRef} className="textLayer" />
      {error && <p className="p-4 text-center text-red-600" role="alert">לא ניתן להציג עמוד זה. אפשר לפתוח את הקובץ בחלון נפרד.</p>}
    </div>
  </article>;
}

export default function HotelPdfPreview({ orderId, type }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(794);
  const [pdf, setPdf] = useState(null);
  const [url, setUrl] = useState(null);
  const [renderError, setRenderError] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['hotelOrderPdf', orderId, type],
    queryFn: () => fetchHotelOrderPdf(orderId, type, type === 'confirmation'),
    staleTime: 0, retry: false,
  });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, Math.min(794, Math.floor(entry.contentRect.width)))));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    let loading;
    const nextUrl = URL.createObjectURL(data);
    setUrl(nextUrl);
    setPdf(null);
    setRenderError(false);
    data.arrayBuffer().then(buffer => {
      if (cancelled) return;
      loading = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true });
      return loading.promise;
    }).then(document => { if (!cancelled && document) setPdf(document); })
      .catch(() => { if (!cancelled) setRenderError(true); });
    return () => { cancelled = true; loading?.destroy(); URL.revokeObjectURL(nextUrl); };
  }, [data]);
  return <section className="mx-auto max-w-5xl bg-white px-3 py-6 sm:px-6" aria-label="תצוגת מסמך PDF">
    <div ref={containerRef}>
      {(isPending || (data && !pdf && !renderError)) && <div className="flex items-center justify-center gap-3 p-12" role="status"><LoaderCircle className="h-5 w-5 animate-spin" />מכין תצוגת מסמך...</div>}
      {(isError || renderError) && <div className="p-8 text-center" role="alert"><p className="mb-4">לא ניתן לטעון את המסמך כרגע.</p><Button type="button" onClick={() => refetch()}>נסה שוב</Button></div>}
      {pdf && Array.from({ length: pdf.numPages }, (_, index) => <PdfPage key={`${orderId}-${type}-${index}`} document={pdf} number={index + 1} width={width} />)}
    </div>
    {url && <a href={url} target="_blank" rel="noreferrer" className="mx-auto block w-fit text-sm underline">פתח את המסמך בחלון נפרד</a>}
  </section>;
}
