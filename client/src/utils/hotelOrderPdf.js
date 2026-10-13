import api from './api.js';

export async function fetchHotelOrderPdf(orderId, type, includePayment = false) {
  const response = await api.get(`/hotel-orders/public/${orderId}/pdf`, {
    params: { type, includePayment }, responseType: 'blob', timeout: 60000,
  });
  if (!response.data.size || !response.data.type.includes('application/pdf')) throw new Error('Invalid PDF response');
  return response.data;
}

export function saveHotelOrderPdf(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
