import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';
import { useNavigate, useParams } from 'react-router-dom';
import PaymentRequestGenerator from '@/components/PaymentRequestGenerator';

export default function PaymentRequestEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (id) {
      fetchPaymentRequest();
    }
  }, [id]);

  const fetchPaymentRequest = async () => {
    try {
      const response = await api.get(`/payment-requests/${id}`);
      // רק להעמיס לך נוודא שה-payment request קיים
      return response.data.data?.paymentRequest;
    } catch (error) {
      toast.error('שגיאה בטעינת דרישת התשלום');
      navigate('/payment-requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaymentRequest = (paymentRequest) => {
    // אחרי שמירה חדשה, נווט לתצוגה של הדרישה שנוצרה
    if (paymentRequest && paymentRequest._id) {
      navigate(`/payment-request/${paymentRequest._id}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">טוען...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate('/payment-requests')}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          >
            <ArrowRight size={20} />
            חזור
          </button>
          <h1 className="text-2xl font-bold">
            {id ? 'עריכת דרישת תשלום' : 'דרישת תשלום חדשה'}
          </h1>
        </div>

        <PaymentRequestGenerator 
          paymentRequestId={id || null}
          onSave={handleSavePaymentRequest}
        />
      </div>
    </div>
  );
}
