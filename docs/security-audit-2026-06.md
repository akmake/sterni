# Security & Health Audit — June 2026

> תאריך: 2026-06-09
> היקף: ביקורת מקיפה על כל הפרויקט (Backend, Frontend, Data/Infra, Code Quality) + תיקוני אבטחה קריטיים.
> ריפו-ים שנגעו בהם: `sterni` (שרת + לקוח), `ManagerApk` (אפליקציית Tether), `AppHome` (אפליקציית Shieor).

מסמך זה מרכז: **(1) מה נמצא** · **(2) מה תוקן** · **(3) מצב ה-`.env`** · **(4) מה עוד צריך לעשות**.

---

## 1. רקע

הורצה ביקורת ב-4 צירים במקביל (סוכנים) על פרויקט בגודל ~1165 קבצי JS/JSX: 42 routes, 49 models, 37 controllers, 88 דפים, 9 stores. השרת רץ בפרודקשן בלבד על `https://dahanswebsite.com/`.

**מסקנה כללית:** הבסיס בנוי טוב (JWT ב-httpOnly cookies, CSRF, helmet, תיעוד `docs/` מרשים, real-time מסודר, אינדקסים חכמים), אך נמצאו **חורי אבטחה קריטיים**, **0% כיסוי בדיקות**, ו-**72% מהקומיטים האחרונים הם רעש auto-commit**.

---

## 2. ממצאי הביקורת (מלא)

### 🔴 קריטי
| # | ממצא | מיקום |
|---|------|-------|
| 1 | מפתח הצפנה קשיח כ-fallback (`vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3`) להצפנת סיסמאות מייל | `server/utils/encryption.js:8` |
| 2 | נתיבי Tether של מכשירים ללא אימות כלל (`/devices/:deviceId/*`) — ניחוש deviceId חושף מדיניות, מזייף heartbeat | `server/routes/tetherRoutes.js` |
| 3 | PIN ברירת-מחדל `'0000'` לביטול נעילה + סוד bootstrap קשיח (`tether-init-2025`) | `server/routes/tetherRoutes.js:572,64` |
| 4 | IDOR ב-Shieor — `GET/PUT /:userId` ציבורי, מזהים בני 4 ספרות (brute-force) | `server/routes/shieorUserRoutes.js` |
| 5 | סיסמת מייל מפוענחת זמינה לכל משתמש מאומת (לא רק admin) | `server/controllers/settingsController.js:61` |
| 6 | אין rate-limit על login (מוחל רק על csrf-token) | `server/app.js:158` |
| 7 | סיסמאות admin אמיתיות בקוד (אימייל+טלפון+PIN) | `server/createAdmin.js`, `server/createTetherAdmin.js` |
| 8 | `errorHandler` מרכזי קיים אך לא חובר → דליפת stack traces בפרודקשן | `server/middlewares/errorHandler.js` + `server/app.js:200` |

### 🟠 חשוב (חלקם עדיין פתוחים — ראו סעיף 4)
- **IDOR בהזמנות מלון** — get/update ללא בדיקת בעלות (delete כן בודק) — `server/controllers/hotelOrderController.js:179,73`. **[פתוח]**
- **PII ציבורי** — `/public/:id` מחזיר טלפון/מייל לקוח — `hotelOrderController.js:231`. **[פתוח]**
- **העלאת `.exe/.bat/.ps1` עד 2GB ללא `requireAdmin`** לתיקייה ציבורית — `server/routes/softwareRoutes.js:17`. **[פתוח]**
- **`library.json` נגיש סטטית** (חושף מאגר תוכנות) — `server/app.js:127`. **[פתוח]**
- **`salespersonName`/`createdByName` תמיד `undefined`** (ה-JWT לא מכיל `name`) — `hotelOrderController.js:56`. **[פתוח]**
- **Frontend:** `checkAuth` מתועד אך לא קיים (אין re-validation בריענון) — `client/src/stores/authStore.js`. **[מתועד, פתוח]**
- **Frontend:** צבעי Tailwind דינמיים נמחקים ב-build — `FinanceDashboardPage.jsx:22`, `FinanceAnalyticsPage.jsx:105`. **[פתוח]**
- **Frontend:** אין מצב error באף דף; כמעט אין code-splitting. **[פתוח]**
- **Data:** אין graceful shutdown; אין cascade delete (יתומים במחיקת משפחה/קבוצה); `Dockerfile` חושף פורט 4000 במקום 5000. **[פתוח]**
- **Data:** תשתית גיבוי לוקאלי (`changeStreamReplicator`) מתה (לא נקראת). **[פתוח]**

### 🟡 שיפור (מדגם)
console.* רבים (~158 לקוח / 77 שרת); כאוס שמות (`Paymentstore.js`/`Paymentroutes.js`); `dir-rtl` חסר-משמעות ב-~18 קבצים; צבעי hex קשיחים; ערבוב enum עברית/אנגלית; מודלים עם `createdAt` ידני; סיסמאות תוכנה ב-plaintext; **אפס בדיקות**.

### ✅ מה טוב
JWT ב-httpOnly + sameSite strict + refresh עם tokenVersion; bcrypt cost 12 + account lockout; CSRF+helmet+mongoSanitize; interceptor מתוחכם ב-`api.js`; scoping מצוין למשפחה/פרויקטים; מודל `Log.js` עם TTL+אינדקסים; שירותי WhatsApp/Email עם backoff+reconnect; ErrorBoundary גלובלי.

---

## 3. מה תוקן בסשן הזה ✅

### תיקוני אבטחה — שרת (`sterni`)
| # | תיקון | קבצים |
|---|------|-------|
| 1 | מפתח הצפנה קשיח הוסר → `getKey()` שזורק שגיאה אם `ENCRYPTION_KEY` חסר/לא 32 תווים (lazy — השרת עולה רגיל) | `server/utils/encryption.js` |
| 5 | `requireAdmin` על חשבונות מייל/סיסמאות/config/routing; דף ההגדרות הועבר ל-`AdminOnlyRoute` (תבניות הצעות-מחיר נשארו פתוחות לאנשי מכירות) | `server/routes/settingsRoutes.js`, `client/src/App.jsx` |
| 6 | `authLimiter` חדש (10 כשלונות / 15 דק' / IP, `skipSuccessfulRequests`) על `POST /auth/login` (+ register/login של Shieor) | `server/middlewares/rateLimiter.js`, `server/routes/auth.js`, `server/routes/shieorUserRoutes.js` |
| 7 | סיסמאות admin אמיתיות הוסרו → קריאה מ-`ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` | `server/createAdmin.js`, `server/createTetherAdmin.js` |
| 8 | `errorHandler` מרכזי חובר ב-`app.js`, והוקשח: ב-production מחזיר `"Internal Server Error"` ל-5xx (ללא stack/הודעה פנימית) | `server/middlewares/errorHandler.js`, `server/app.js` |
| 3 | PIN `'0000'` הוסר: default ב-schema → `null`, וה-fallback בקוד הוסר (fail-secure); סוד bootstrap → `TETHER_BOOTSTRAP_SECRET` | `server/models/Community.js`, `server/routes/tetherRoutes.js` |

### אימות מכשירים (#2 Tether, #4 Shieor) — שרת + 2 אפליקציות
מנגנון **טוקן-מכשיר חד-פעמי**: השרת מנפיק טוקן אקראי ב-join/register/login, שומר **רק SHA-256 hash** (`select:false`), והאפליקציה שולחת אותו חזרה בכל קריאה.

**שרת (`sterni`):**
- `tetherRoutes.js`: `generateDeviceToken()`/`hashDeviceToken()`, הנפקה ב-`/devices/join` (מחזיר `deviceToken` פעם אחת), middleware `requireDeviceAuth` מוחל על policy/approval/verify-uninstall-pin/apps/heartbeat/events.
- `models/TetherDevice.js`: שדה `deviceSecretHash` (`select:false`).
- `controllers/shieorUserController.js` + `routes/shieorUserRoutes.js`: `syncToken` ב-register/login, middleware `requireSyncAuth` על get/sync.
- `models/UserData.js`: שדה `syncTokenHash` + `hashToken()`/`generateToken()`.

**ManagerApk (Tether, Kotlin):**
- `data/model/TetherModels.kt`: `JoinCommunityResponse.deviceToken`.
- `admin/TetherPolicyManager.kt`: אחסון `device_token` (save/get + ניקוי ב-uninstall).
- `data/api/RetrofitClient.kt`: OkHttp interceptor שמזריק `X-Device-Token` לנתיבי `/devices/`.
- `ui/screens/join/JoinCommunityViewModel.kt`: persistence של הטוקן ב-join.
- `DailyStudyApp.kt`: חיווט ה-provider.

**AppHome (Shieor, Kotlin):**
- `network/UserService.kt`: שדות `syncToken` + `@Header("Authorization")` ב-get/sync.
- `sync/UserManager.kt`: אחסון `sync_token` + שליחה כ-`Bearer`.

**מנגנון rollout מבוקר-flag (לא שובר מכשירים קיימים):**
כל עוד הדגלים `TETHER_ENFORCE_DEVICE_AUTH`/`SHIEOR_ENFORCE_AUTH` **לא** `'true'` — בקשה ללא טוקן מותרת (מכשיר ישן), אבל טוקן **שגוי** תמיד נדחה.

### תיעוד שעודכן
`docs/auth-flow.md` (rate limiting + תיקון הצהרת `checkAuth` שגויה), `docs/architecture.md` (env vars חדשים + error handling + מודל הטוקן), `docs/sync-map.md` (צימוד בין-ריפו חדש), והמסמך הזה.

### אימות
כל קבצי השרת עברו `node --check`. קוד ה-Kotlin נבדק ידנית מול OkHttp 4.12 / Retrofit 2.9 (האפליקציות לא נבנו כאן — דורש Android SDK + keystore).

---

## 4. מצב ה-`.env` (פרודקשן)

נוסף בלוק ל-`server/.env` (הקובץ ב-`.gitignore` — לא נכנס ל-commit). **ערכים אקראיים מאובטחים נוצרו ואומתו:**

```bash
# --- Added by Claude: device-auth + hardening (2026-06-09) ---
ENCRYPTION_KEY=<32-char>            # ✅ נוצר, אורך 32, נטען תקין
TETHER_BOOTSTRAP_SECRET=<random>    # ✅ נוצר, נטען תקין
# ADMIN_* — set only while running createAdmin.js / createTetherAdmin.js, then remove
# ADMIN_EMAIL=
# ADMIN_PASSWORD=
# ADMIN_NAME=
# Rollout flags — keep UNSET until ManagerApk + AppHome are rolled out, then flip to true
# TETHER_ENFORCE_DEVICE_AUTH=true
# SHIEOR_ENFORCE_AUTH=true
```

| משתנה | מצב | הערה |
|-------|-----|------|
| `ENCRYPTION_KEY` | ✅ הוגדר | חייב להיות **בדיוק 32 תווים**. אין דאטה מוצפנת קיימת, אז אפשר להחליף בחופשיות. |
| `TETHER_BOOTSTRAP_SECRET` | ✅ הוגדר | bootstrap כבר נעול (קיים admin), אבל הוגדר להקשחה. |
| `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` | ⬜ בהערה | לבטל הערה ולמלא רק בעת הרצת סקריפטי יצירת admin, ואז למחוק. |
| `TETHER_ENFORCE_DEVICE_AUTH` | ⬜ לא מוגדר | **להשאיר כך** עד שכל המכשירים עודכנו (מצב rollout). |
| `SHIEOR_ENFORCE_AUTH` | ⬜ לא מוגדר | כנ"ל. |

> ⚠️ **נדרש restart לשרת** כדי לטעון את ה-env החדש.

---

## 5. מה עוד צריך לעשות

### א. פעולות מיידיות של המשתמש (תפעול)
1. **Restart לשרת** בפרודקשן (לטעינת `ENCRYPTION_KEY` + שאר ה-env).
2. **לאפס PIN בקהילות Tether קיימות** — הן מחזיקות `'0000'` מה-default הישן ב-DB. דרך פאנל האדמין → לכל קהילה להגדיר `uninstallPin` אמיתי. (הקוד כבר לא מזריק `'0000'`, אבל הדאטה הישנה נשארת עד שינוי ידני.)
3. (אופציונלי) לשנות את ערכי `ENCRYPTION_KEY`/`TETHER_BOOTSTRAP_SECRET` שנוצרו, אם רוצים ערכים משלך.

### ב. Rollout אימות המכשירים (3 שלבים — לפי הסדר!)
1. **שלב A — ✅ בוצע (שרת):** הנפקת טוקנים פעילה, לא שוברת כלום.
2. **שלב B — נדרש:** לבנות מחדש ולהפיץ את **ManagerApk** ו-**AppHome** (עם ה-keystore שלך) כדי שהמכשירים יתחילו לשמור ולשלוח טוקן.
3. **שלב C — אחרי B:** כשטלמטריה מראה שהמכשירים שולחים טוקן → להגדיר `TETHER_ENFORCE_DEVICE_AUTH=true` ו-`SHIEOR_ENFORCE_AUTH=true` ב-`.env` + restart. רק אז האכיפה מלאה.

> ⚠️ **אסור** להפעיל את דגלי ה-ENFORCE לפני שלב B — זה ינתק/ינעל את כל המכשירים בשטח.

### ג. ממצאים 🟠 שעדיין פתוחים (מומלץ להמשך)
1. IDOR בהזמנות מלון — להוסיף בדיקת בעלות ב-`getHotelOrderById`/`updateHotelOrder`.
2. PII ב-`/public/:id` — להחזיר רק שדות נדרשים + token חד-פעמי לקישור.
3. העלאת קבצים — `requireAdmin` על `softwareRoutes`, הגשה כ-`attachment` ולא static, להקטין תקרת 2GB.
4. `library.json` — להוציא מחוץ ל-dir הסטטי או לחסום.
5. `req.user.name` חסר ב-JWT — להוסיף ל-payload או לשלוף מ-DB (מתקן את שדות ה-*Name הריקים).
6. graceful shutdown (SIGTERM) + cascade delete למשפחה/קבוצה + תיקון `Dockerfile EXPOSE 5000`.

### ד. שיפורי בריאות פרויקט (🟡, ארוך-טווח)
- להוסיף שכבת ולידציה (zod/express-validator) ו-logger מובנה (pino/winston).
- CI בסיסי + ראשית בדיקות (smoke ל-auth, regression ל-IDOR) + ביטול ה-auto-commit cron.
- `checkAuth` בצד לקוח + מצבי error/skeleton בדפים + code-splitting.
- ניקוי: console.*, קוד מת (`server/stores/`, דפים לא-מנותבים), תיקון שמות קבצים, הסרת APK מ-git.

---

## 6. קבצים שנגעו בהם (סשן 2026-06-09)

**sterni/server:** `utils/encryption.js`, `middlewares/errorHandler.js`, `middlewares/rateLimiter.js`, `routes/auth.js`, `routes/settingsRoutes.js`, `routes/tetherRoutes.js`, `routes/shieorUserRoutes.js`, `controllers/shieorUserController.js`, `models/TetherDevice.js`, `models/UserData.js`, `models/Community.js`, `createAdmin.js`, `createTetherAdmin.js`, `app.js`, `.env` (לא ב-git).
**sterni/client:** `src/App.jsx`.
**sterni/docs:** `auth-flow.md`, `architecture.md`, `sync-map.md`, `security-audit-2026-06.md` (חדש).
**ManagerApk:** `data/model/TetherModels.kt`, `admin/TetherPolicyManager.kt`, `data/api/RetrofitClient.kt`, `ui/screens/join/JoinCommunityViewModel.kt`, `DailyStudyApp.kt`.
**AppHome:** `network/UserService.kt`, `sync/UserManager.kt`.

> **לתשומת לב:** נכון לכתיבת מסמך זה, כל השינויים ב-working tree בלבד — **לא בוצע commit באף ריפו**.
