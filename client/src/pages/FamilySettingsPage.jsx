import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Copy, Check, Users, Crown, Trash2,
  LogOut, Loader2, Share2, UserMinus
} from 'lucide-react';
import useHouseholdStore from '@/stores/householdStore';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

export default function FamilySettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { family, familyLoading, fetchFamily, leaveFamily, removeMember } = useHouseholdStore();
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    fetchFamily();
  }, []);

  const isOwner = family?.owner?.toString() === user?._id || 
                  family?.members?.find(m => m.user?._id === user?._id)?.role === 'owner';

  const copyCode = () => {
    navigator.clipboard.writeText(family.code);
    setCodeCopied(true);
    toast.success('הקוד הועתק!');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const shareCode = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `הצטרף ל${family.name}`,
          text: `הצטרף למשפחה שלי באפליקציה!\nקוד המשפחה: ${family.code}`,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyCode();
        }
      }
    } else {
      copyCode();
    }
  };

  const handleLeave = async () => {
    const msg = isOwner 
      ? 'אתה הבעלים! עזיבה תמחק את המשפחה לכל החברים. בטוח?' 
      : 'בטוח שאתה רוצה לעזוב את המשפחה?';
    if (!window.confirm(msg)) return;
    try {
      await leaveFamily();
      toast.success('עזבת את המשפחה');
      navigate('/household');
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`להסיר את ${memberName} מהמשפחה?`)) return;
    try {
      await removeMember(memberId);
      toast.success('החבר הוסר');
    } catch (err) {
      toast.error(err.error || 'שגיאה');
    }
  };

  if (familyLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  useEffect(() => {
    if (!familyLoading && !family) {
      navigate('/household');
    }
  }, [familyLoading, family, navigate]);

  if (!family) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#F5F5F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/household')} className="p-2 -mr-2 hover:bg-white/60 rounded-xl transition-colors">
              <ArrowRight size={20} className="text-gray-500" />
            </button>
            <h1 className="text-xl font-bold">המשפחה שלי</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-4">
        
        {/* Family Info Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold mb-1">{family.name}</h2>
          <p className="text-sm text-gray-400 mb-5">נוצרה ב-{new Date(family.createdAt).toLocaleDateString('he-IL')}</p>

          {/* Family Code */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-400 font-medium mb-2">קוד המשפחה (שתף עם בני המשפחה)</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-mono font-bold tracking-[0.3em] text-gray-800 flex-1">
                {family.code}
              </span>
              <button
                onClick={copyCode}
                className="p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors shadow-sm"
              >
                {codeCopied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-400" />}
              </button>
              <button
                onClick={shareCode}
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Share2 size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-gray-400" />
            <h3 className="font-bold">חברי המשפחה ({family.members?.length})</h3>
          </div>

          <div className="space-y-3">
            {family.members?.map(member => {
              const isMe = member.user?._id === user?._id;
              const isMemberOwner = member.role === 'owner';
              return (
                <motion.div
                  key={member.user?._id || member._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md ${
                    isMemberOwner
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                      : 'bg-gradient-to-br from-blue-400 to-indigo-500'
                  }`}>
                    {member.user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {member.user?.name || 'חבר'}
                        {isMe && <span className="text-xs text-gray-400 mr-1">(אני)</span>}
                      </span>
                      {isMemberOwner && <Crown size={14} className="text-amber-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{member.user?.email}</p>
                    <p className="text-[10px] text-gray-300">
                      הצטרף ב-{new Date(member.joinedAt).toLocaleDateString('he-IL')}
                    </p>
                  </div>

                  {/* Remove button - only for owner, and not self */}
                  {isOwner && !isMe && (
                    <button
                      onClick={() => handleRemoveMember(member.user?._id, member.user?.name)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-red-50 rounded-lg"
                      title="הסר חבר"
                    >
                      <UserMinus size={16} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Leave Family */}
        <button
          onClick={handleLeave}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-red-100 hover:border-red-300 transition-colors flex items-center justify-center gap-2 text-red-500 font-medium hover:bg-red-50"
        >
          <LogOut size={18} />
          {isOwner ? 'מחק את המשפחה' : 'עזוב את המשפחה'}
        </button>
      </div>
    </div>
  );
}
