import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HotelPdfPreview from '../../src/components/orders/HotelPdfPreview.jsx';
import '../../src/index.css';
const blob = await (await fetch('/tmp/pdf-preview-check/sample.pdf')).blob();
const client = new QueryClient({ defaultOptions: { queries: { refetchOnMount:false,refetchOnWindowFocus:false } } });
client.setQueryData(['hotelOrderPdf','sample','quote'], blob);
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><HotelPdfPreview orderId="sample" type="quote" /></QueryClientProvider>);
