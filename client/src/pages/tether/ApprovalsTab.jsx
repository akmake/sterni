import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';
import ApprovalCard from './ApprovalCard';
import { resolveApprovalRequest } from './CommunityDetail';

export default function ApprovalsTab() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/approvals/all', { headers: authHeader() });
      setApprovals(data);
    } catch { toast.error('שגיאה בטעינת בקשות'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (request, body) => {
    setResolving(request.id);
    try {
      await resolveApprovalRequest(request, body);
      setApprovals(a => a.filter(r => r.id !== request.id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה');
    } finally { setResolving(null); }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">בקשות אישור ממתינות ({approvals.length})</h2>
        <button onClick={load} aria-label="רענן" className="text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {approvals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-40 text-green-500" />
          <p>אין בקשות ממתינות</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map(req => (
            <ApprovalCard key={req.id} request={req} onResolve={resolve} busy={resolving === req.id} />
          ))}
        </div>
      )}
    </div>
  );
}
