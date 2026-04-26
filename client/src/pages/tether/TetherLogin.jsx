import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Shield, KeyRound, QrCode, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, saveTetherSession } from './tetherApi';

function QrScanner({ onResult }) {
  const scannerRef = useRef(null);
  const divId = 'tether-qr-reader';

  useEffect(() => {
    const scanner = new Html5Qrcode(divId);
    scannerRef.current = scanner;
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (text) => { scanner.stop().catch(() => {}); onResult(text); },
      () => {}
    ).catch(() => toast.error('לא ניתן לגשת למצלמה'));
    return () => { scanner.isScanning && scanner.stop().catch(() => {}); };
  }, [onResult]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div id={divId} className="w-full rounded-xl overflow-hidden" />
      <p className="text-xs text-gray-400">כוון את המצלמה לברקוד / QR</p>
    </div>
  );
}

export default function TetherLogin({ onLogin }) {
  const [mode, setMode] = useState('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const doLogin = async (credentials) => {
    setLoading(true);
    try {
      const { data } = await tetherApi.post('/auth/login', credentials);
      saveTetherSession(data.token, data.user);
      onLogin(data.user);
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה בהתחברות');
      setMode('password');
    } finally {
      setLoading(false);
    }
  };

  const handleQrResult = (text) => {
    try {
      const parsed = text.startsWith('{') ? JSON.parse(text) : (() => {
        const i = text.indexOf(':');
        return { email: text.slice(0, i), password: text.slice(i + 1) };
      })();
      if (!parsed.email || !parsed.password) throw new Error();
      doLogin(parsed);
    } catch {
      toast.error('ברקוד לא תקין');
      setMode('password');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-900 text-white rounded-full p-4 mb-4">
            <Shield size={36} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tether — כניסת מנהל</h1>
          <p className="text-gray-500 text-sm mt-1">פאנל ניהול מכשירים</p>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {[
            { id: 'password', label: 'סיסמה', icon: <KeyRound size={14} /> },
            { id: 'qr',       label: 'סרוק ברקוד', icon: <QrCode size={14} /> },
          ].map(t => (
            <button key={t.id} onClick={() => setMode(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition ${mode === t.id ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {mode === 'password' ? (
          <form onSubmit={e => { e.preventDefault(); doLogin({ email, password }); }} className="space-y-4" dir="rtl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="admin@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60">
              {loading ? 'מתחבר...' : 'כניסה'}
            </button>
          </form>
        ) : (
          <div dir="rtl">
            {loading ? <div className="text-center py-8 text-gray-400">מתחבר...</div> : <QrScanner onResult={handleQrResult} />}
          </div>
        )}
      </div>
    </div>
  );
}
