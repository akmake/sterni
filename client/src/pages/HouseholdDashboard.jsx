import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Plus, Users, ArrowLeft, Loader2 } from 'lucide-react';
import useHouseholdStore from '@/stores/householdStore';
import toast from 'react-hot-toast';

/**
 * HouseholdDashboard now serves only as a gateway:
 *  - If the user already has a family  → redirect to /household/shopping
 *  - If not                            → show onboarding (create / join)
 */
export default function HouseholdDashboard() {
  const { family, familyLoading, fetchFamily, createFamily, joinFamily } = useHouseholdStore();

  const [mode, setMode] = useState(null); // 'create' | 'join' | null
  const [familyName, setFamilyName] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchFamily();
  }, []);

  const handleCreateFamily = async (e) => {
    e.preventDefault();
    if (!familyName.trim()) return;
    setSubmitting(true);
    try {
      await createFamily(familyName.trim());
      toast.success('המשפחה נוצרה בהצלחה!');
      setMode(null);
    } catch (err) {
      toast.error(err.error || 'שגיאה ביצירת המשפחה');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinFamily = async (e) => {
    e.preventDefault();
    if (!familyCode.trim()) return;
    setSubmitting(true);
    try {
      await joinFamily(familyCode.trim());
      toast.success('הצטרפת למשפחה בהצלחה!');
      setMode(null);
    } catch (err) {
      toast.error(err.error || 'קוד לא תקין');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading
  if (familyLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  // Already has a family → go straight to shopping
  if (family) {
    return <Navigate to="/household/shopping" replace />;
  }

  // ===== NO FAMILY - ONBOARDING =====
  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 font-sans text-[#1D1D1F]">
      <div className="max-w-lg mx-auto pt-8">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Home size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">ניהול משק בית</h1>
          <p className="text-gray-500">צור משפחה חדשה או הצטרף למשפחה קיימת</p>
        </div>

        <AnimatePresence mode="wait">
          {!mode ? (
            <motion.div
              key="options"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <button
                onClick={() => setMode('create')}
                className="w-full bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all text-right flex items-center gap-4"
              >
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <Plus size={24} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">צור משפחה חדשה</h3>
                  <p className="text-gray-500 text-sm">תקבל קוד ייחודי לשיתוף עם המשפחה</p>
                </div>
              </button>

              <button
                onClick={() => setMode('join')}
                className="w-full bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-green-200 transition-all text-right flex items-center gap-4"
              >
                <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center">
                  <Users size={24} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">הצטרף למשפחה</h3>
                  <p className="text-gray-500 text-sm">יש לך קוד? הכנס אותו כאן</p>
                </div>
              </button>
            </motion.div>
          ) : mode === 'create' ? (
            <motion.form
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={handleCreateFamily}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
            >
              <button type="button" onClick={() => setMode(null)} className="flex items-center gap-1 text-sm text-gray-400 mb-4 hover:text-gray-600">
                <ArrowLeft size={16} /> חזרה
              </button>
              <h3 className="font-bold text-xl mb-4">צור משפחה חדשה</h3>
              <input
                type="text"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                placeholder="שם המשפחה (למשל: משפחת כהן)"
                className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-500 outline-none text-lg mb-4"
                autoFocus
              />
              <button
                type="submit"
                disabled={submitting || !familyName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'צור משפחה'}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="join"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={handleJoinFamily}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
            >
              <button type="button" onClick={() => setMode(null)} className="flex items-center gap-1 text-sm text-gray-400 mb-4 hover:text-gray-600">
                <ArrowLeft size={16} /> חזרה
              </button>
              <h3 className="font-bold text-xl mb-4">הצטרף למשפחה</h3>
              <input
                type="text"
                value={familyCode}
                onChange={e => setFamilyCode(e.target.value.toUpperCase())}
                placeholder="הכנס קוד משפחה (6 תווים)"
                className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-green-500 outline-none text-lg text-center tracking-[0.3em] font-mono mb-4 uppercase"
                maxLength={6}
                autoFocus
              />
              <button
                type="submit"
                disabled={submitting || familyCode.length < 6}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'הצטרף'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
