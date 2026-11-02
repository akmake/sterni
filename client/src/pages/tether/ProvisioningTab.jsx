// Web port of the Android admin app's ProvisioningQrScreen: the Android Enterprise QR that
// installs Tether as Device Owner on a freshly reset phone.
import React from 'react';
import QRCode from 'react-qr-code';

// Must match the APK served at /api/tether/app/download — same constants as the Android app's
// ProvisioningQrScreen.kt (APK_CHECKSUM / ADMIN_COMPONENT). Update both when the signing key changes.
const APK_CHECKSUM = 'xycL3kb4-mXnqvRJV43SyQyqIgU1D4Nw9U1UWdJ8urs';
const ADMIN_COMPONENT = 'com.sterni.tether/.admin.TetherDeviceAdminReceiver';

const provisioningJson = () => JSON.stringify({
  'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': ADMIN_COMPONENT,
  'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': `${window.location.origin}/api/tether/app/download`,
  'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': APK_CHECKSUM,
  'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': false,
  'android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED': true,
  'android.app.extra.PROVISIONING_LOCALE': 'he_IL',
  'android.app.extra.PROVISIONING_TIME_ZONE': 'Asia/Jerusalem',
});

const STEPS = [
  'אפס את הטלפון להגדרות יצרן (Factory Reset)',
  'בחלון ההגדרה הראשון — הקש 6 פעמים על המסך',
  'סרוק את ה-QR הבא',
  'המתן — האפליקציה תותקן אוטומטית עם הרשאות מלאות',
  'אחרי ההתקנה — הכנס את קוד הקהילה (לשונית קהילות ← שיתוף)',
];

export default function ProvisioningTab() {
  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h2 className="font-semibold text-gray-800">חיבור מכשיר חדש</h2>
        <p className="text-xs text-gray-500">התקנה כ-Device Owner — הרמה המלאה של הגנה</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 items-start">
        <div className="bg-blue-50 rounded-xl p-4 space-y-2.5">
          <h3 className="font-semibold text-blue-900">הוראות למשתמש חדש</h3>
          {STEPS.map((text, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="bg-blue-900 text-white text-xs font-semibold rounded-md px-2 py-0.5 shrink-0">{i + 1}</span>
              <span className="text-sm text-gray-800">{text}</span>
            </div>
          ))}
          <p className="text-xs text-blue-800/80 pt-1">
            ההתקנה מוחקת את כל המידע בטלפון. מכשיר שכבר בשימוש אפשר לחבר גם בלי איפוס — מתקינים את Tether ומכניסים את קוד הקהילה, אבל אז חלק מההגנות (הסתרת אפליקציות, חסימת איפוס) לא זמינות.
          </p>
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <QRCode value={provisioningJson()} size={260} />
          </div>
          <a href="/api/tether/app/download" className="text-xs text-blue-700 hover:underline mt-3">הורדת קובץ ה-APK ישירות</a>
        </div>
      </div>
    </div>
  );
}
