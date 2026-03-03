import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';
import { Link, useNavigate } from 'react-router-dom';

export default function PaymentRequestsPage() {
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchPaymentRequests();
  }, []);

  const fetchPaymentRequests = async () => {
    try {
      const response = await api.get('/payment-requests');
      setPaymentRequests(response.data.data?.paymentRequests || []);
    } catch (error) {
      toast.error('שגיאה בטעינת דרישות התשלום');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק?')) return;
    
    try {
      await api.delete(`/payment-requests/${id}`);
      setPaymentRequests(paymentRequests.filter(p => p._id !== id));
      toast.success('דרישה נמחקה בהצלחה');
    } catch (error) {
      toast.error('שגיאה במחיקה');
      console.error(error);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const response = await api.patch(`/payment-requests/${id}/status`, {
        status: newStatus
      });
      setPaymentRequests(paymentRequests.map(p => 
        p._id === id ? response.data.data?.paymentRequest : p
      ));
      toast.success('סטטוס עודכן');
    } catch (error) {
      toast.error('שגיאה בעדכון סטטוס');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100';
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'טיוטה',
      sent: 'נשלח',
      paid: 'שולם',
      cancelled: 'בוטל'
    };
    return labels[status] || status;
  };

  if (loading) {
    return <div className="p-8 text-center">טוען...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-800">דרישות תשלום</h1>
        <Link
          to="/payment-request/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          דרישה חדשה
        </Link>
      </div>

      {paymentRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">אין דרישות תשלום עדיין</p>
          <Link
            to="/payment-request/new"
            className="text-blue-600 hover:underline"
          >
            צור דרישה חדשה
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-right font-bold">שם</th>
                <th className="px-4 py-3 text-right font-bold">לקוח</th>
                <th className="px-4 py-3 text-right font-bold">סכום</th>
                <th className="px-4 py-3 text-right font-bold">תאריך יעד</th>
                <th className="px-4 py-3 text-right font-bold">סטטוס</th>
                <th className="px-4 py-3 text-right font-bold">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {paymentRequests.map((request) => (
                <tr
                  key={request._id}
                  className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/payment-request/${request._id}`)}
                >
                  <td className="px-4 py-3 font-semibold text-blue-700">{request.name}</td>
                  <td className="px-4 py-3">{request.clientName || '-'}</td>
                  <td className="px-4 py-3 font-bold">₪{request.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {request.dueDate 
                      ? new Date(request.dueDate).toLocaleDateString('he-IL')
                      : '-'
                    }
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={request.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(request._id, e.target.value);
                      }}
                      className={`px-3 py-1 rounded text-sm font-semibold cursor-pointer border-0 ${getStatusColor(request.status)}`}
                    >
                      <option value="draft">טיוטה</option>
                      <option value="sent">נשלח</option>
                      <option value="paid">שולם</option>
                      <option value="cancelled">בוטל</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(request._id)}
                        className="flex items-center gap-1 text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm"
                      >
                        <Trash2 size={16} />
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
