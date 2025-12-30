import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowRight, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";

// שים לב: אנחנו מייבאים את ה-api ואת ה-store
import api from "@/utils/api";
import { useAuthStore } from "@/stores/authStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // ניהול שגיאות וטעינה מקומי (כמו בקוד התקין ששלחת)
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  // 1. קבלת CSRF Token בטעינה (מהלוגיקה התקינה)
  useEffect(() => {
    api.get('/csrf-token').catch((err) => {
      console.error("Failed to fetch CSRF token", err);
      // לא חובה להציג שגיאה למשתמש בשלב הזה, אבל אפשר
    });
  }, []);

  // 2. פונקציית ההתחברות המתוקנת
  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      // ביצוע קריאת API לשרת
      const { data } = await api.post('/auth/login', { email, password });

      // בדיקה שהתקבל יוזר
      if (data && data.user) {
        // עדכון ה-Store עם האובייקט המלא
        login(data.user);
        // מעבר לדף הפרויקטים
        navigate("/projects");
      } else {
        throw new Error("תגובת השרת אינה תקינה");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "שגיאה בהתחברות. נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC] overflow-hidden relative font-sans text-slate-800">
      
      {/* --- רקע 3D בהיר ועדין (מהעיצוב שביקשת) --- */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
        {/* צורה 1 - כחול עדין */}
        <motion.div
            animate={{
                x: [0, 50, 0],
                y: [0, -30, 0],
                rotate: [0, 10, 0]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-[80px] mix-blend-multiply"
        />
        {/* צורה 2 - סגול עדין */}
        <motion.div
            animate={{
                x: [0, -40, 0],
                y: [0, 40, 0],
                scale: [1, 1.1, 1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-200/40 rounded-full blur-[100px] mix-blend-multiply"
        />
        {/* צורה 3 - כתום עדין במרכז */}
        <motion.div
             animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
             transition={{ duration: 10, repeat: Infinity }}
             className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-orange-100/60 rounded-full blur-[60px]"
        />
        {/* רשת עדינה */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      </div>

      {/* --- הכרטיס המרכזי --- */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
        className="relative z-10 w-full max-w-[420px] p-6"
      >
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] p-8 md:p-10 relative overflow-hidden group">
            
            {/* ברק עליון בכרטיס */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 opacity-80" />

            {/* כותרת ולוגו */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 mb-4 shadow-sm border border-indigo-100">
                     <User className="w-8 h-8 text-indigo-600" strokeWidth={1.5} />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">ברוכים השבים</h2>
                <p className="text-slate-500 mt-2 text-sm font-medium">הזן פרטים כדי להיכנס לאזור האישי</p>
            </div>

            {/* טופס */}
            <form onSubmit={handleLogin} className="space-y-5">
                
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1 uppercase tracking-wider">אימייל</label>
                    <div className="relative group">
                        <Mail className="absolute right-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl py-3 pr-12 pl-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-300 font-medium"
                            placeholder="your@email.com"
                            required
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1 uppercase tracking-wider">סיסמה</label>
                    <div className="relative group">
                        <Lock className="absolute right-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl py-3 pr-12 pl-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-300 font-medium"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-50 text-red-600 text-sm text-center py-2.5 rounded-lg border border-red-100 font-medium"
                    >
                        {error}
                    </motion.div>
                )}

                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 transition-all duration-300 active:scale-[0.98] text-base mt-2"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <span className="flex items-center gap-2">
                             התחברות <ArrowRight className="w-4 h-4" />
                        </span>
                    )}
                </Button>
            </form>

            {/* פוטר */}
            <div className="mt-8 text-center">
                <p className="text-slate-500 text-sm">
                    אין לך חשבון?{" "}
                    <Link to="/register" className="text-blue-600 font-bold hover:text-blue-700 transition-colors">
                        הרשמה מהירה
                    </Link>
                </p>
            </div>
        </div>
      </motion.div>
    </div>
  );
}