# Company OS

מערכת עבודה פנימית לחברה. קוד השרת ב-`server/companyos/`, אזור הדפדפן ב-`client/src/companyos/` (נתיב `/company`), ואפליקציית Android בריפו `ApgMan`. שני הלקוחות משתמשים באותו API.

הטכנולוגיה היא של sterni (Express, MongoDB, העוגיות של `/api/auth`, csurf). האפיון `company_os_spec_v2_he.md` ב-`ApgMan` קובע מוצר והרשאות בלבד.

## מודל נתונים

| Collection | תפקיד |
|---|---|
| `company_organizations` | ארגון. כרגע אחד בלבד |
| `company_members` | חברות משתמש בארגון: `role`, `status`. ייחודי לפי ארגון ומשתמש |
| `company_invites` | הזמנות. נשמר רק hash של הטוקן |
| `company_audit_logs` | יומן פעולות. הוספה בלבד |

## תפקידים

| תפקיד | ניהול ארגון וחברים | יומן פעולות | צפייה בצוות | מי מנוהל על ידו |
|---|---|---|---|---|
| `owner` | כן | כן | כן | כולם |
| `admin` | כן | כן | כן | `manager`, `member`, `guest` |
| `manager` | לא | לא | כן | אף אחד |
| `member` | לא | לא | כן | אף אחד |
| `guest` | לא | לא | לא | אף אחד |

המדיניות מרוכזת ב-`server/companyos/access.js`. החברות נבדקת במסד הנתונים בכל בקשה, ולכן השעיה חלה מיד גם על סשן פתוח.

## API

בסיס: `/api/v1`. פעולות כתיבה דורשות `X-CSRF-Token`.

הצלחה: `{ data, meta: { request_id } }`. שגיאה: `{ error: { code, message, details }, request_id }`.

| Method | נתיב | הרשאה |
|---|---|---|
| GET | `/invites/:token` | ציבורי |
| POST | `/invites/:token/accept` | ציבורי. לחשבון קיים נדרש סשן של אותו חשבון |
| GET | `/me` | מחובר |
| POST | `/orgs` | מנהל אתר, רק כשאין עדיין ארגון |
| PATCH | `/orgs/:orgId` | `manage_organization` |
| GET | `/orgs/:orgId/members` | `view_members` |
| PATCH | `/orgs/:orgId/members/:memberId` | `manage_members` |
| GET, POST | `/orgs/:orgId/invites` | `manage_members` |
| DELETE | `/orgs/:orgId/invites/:inviteId` | `manage_members` |
| GET | `/orgs/:orgId/audit` | `view_audit`. עם `cursor` ו-`limit` |

משתמש שאינו חבר בארגון מקבל 404 ולא 403, כדי לא לחשוף קיום של ארגונים.

### עבודה: פרויקטים, משימות, דרישות ובדיקות

תוכן פרויקט נפתח לפי חברות בפרויקט: `manager`, `contributor` או `viewer`. רק `owner` של הארגון רואה את כל הפרויקטים, ו-`admin` עובד לפי חברות. אורח יכול להיות בפרויקט רק כ-`viewer`. בלי גישה מתקבל 404.

| Method | נתיב תחת `/orgs/:orgId` | הרשאה |
|---|---|---|
| GET, POST | `/projects` | יצירה: `create_projects` |
| GET, PATCH | `/projects/:id` | עריכה: מנהל פרויקט |
| GET, POST | `/projects/:id/members` | הוספה: מנהל פרויקט |
| PATCH, DELETE | `/projects/:id/members/:memberId` | מנהל פרויקט |
| GET, POST | `/tasks` | עם `project_id`, `assignee=me`, `status`, `open`, `cursor`, `limit` |
| GET, PATCH | `/tasks/:id` | כתיבה: לא `viewer`. ‏PATCH דורש `version` |
| GET, POST | `/projects/:id/requirements` | כתיבה: לא `viewer` |
| PATCH | `/projects/:id/requirements/:requirementId` | כתיבה: לא `viewer` |
| GET, POST | `/projects/:id/tests` | כתיבה: לא `viewer` |
| PATCH | `/projects/:id/tests/:testId` | כתיבה: לא `viewer` |

כללים שהשרת אוכף:

- עריכה עם `version` ישן מחזירה 409 `VERSION_CONFLICT` עם המצב העדכני.
- משימה לא נסגרת כשיש לה חוסמת פתוחה. תלויות מעגליות נחסמות.
- באג בחומרה `high` או `critical` לא נסגר בלי `resolution`.
- פרויקט לא עובר ל-`completed` כשיש בו משימה דחופה פתוחה.
- בדיקה שנכשלת מחזירה משימה מקושרת שהושלמה ל-`in_review`.
- הסרת חבר מפרויקט משחררת את המשימות הפתוחות שלו.
- לפחות מנהל אחד נשאר בכל פרויקט.

### שיחות וזמן אמת

ערוץ ציבורי פתוח לכל חברי הארגון מלבד אורחים. ערוץ פרטי ושיחה אישית נפתחים רק לחברים בהם, וגם בעלי הארגון לא נכנס אליהם בלי חברות.

| Method | נתיב תחת `/orgs/:orgId` | הערה |
|---|---|---|
| GET | `/home` | נתוני מסך הבית |
| GET, POST | `/conversations` | יצירה: לא אורח |
| POST | `/conversations/dm` | פותח או מחזיר שיחה קיימת |
| GET, POST | `/conversations/:id/members` | הוספה לערוץ פרטי בלבד |
| GET, POST | `/conversations/:id/messages` | `before_seq`, `after_seq`, `limit`. שליחה עם `client_id` בטוחה לניסיון חוזר |
| PATCH, DELETE | `/conversations/:id/messages/:messageId` | כותב ההודעה בלבד |
| POST | `/conversations/:id/read` | המיקום נע רק קדימה |

socket.io ב-namespace ‏`/company`, בהזדהות עוגיית `jwt`. אירועים: `message_new`, `message_updated`, `conversations_changed`, `work_changed`. האירוע `work_changed` לא נושא תוכן: הלקוח טוען מחדש דרך ה-API. שינוי תפקיד או השעיה מנתקים מיד את החיבור הפתוח.

### צוותים, אימות דו-שלבי, הרשאות זמניות

- `/orgs/:orgId/teams` וחבריהם. `member` עם צוות רואה רק את חבריו ואת ההנהלה.
- `/mfa`, `/mfa/setup`, `/mfa/enable`, `/mfa/verify`, `/mfa/disable`: קוד TOTP וקודי שחזור. אימות תקף ל-12 שעות בעוגיית `company_mfa`, ומסתיים גם בהחלפת סיסמה.
- מי שהפעיל אימות דו-שלבי נחסם עם `403 MFA_REQUIRED` עד שיאמת. `require_mfa` בארגון מחייב `owner` ו-`admin`, ומחזיר `MFA_SETUP_REQUIRED` למי שלא הגדיר.
- `PATCH /members/:id` עם `role` ו-`expires_at`: תפקיד זמני שחוזר לתפקיד הקודם בפקיעה. גם `expires_at` בחבר פרויקט.
- `auth.login` ו-`auth.login_failed` נרשמים ביומן דרך `loginAudit.js`, שנקרא מ-`authController`.

### התראות Push

`/push`, `/push/subscribe`, `/push/unsubscribe`. פעיל רק כשמוגדרים במשתני הסביבה `COMPANY_VAPID_PUBLIC_KEY` ו-`COMPANY_VAPID_PRIVATE_KEY` (יצירה: `npx web-push generate-vapid-keys`). `client/public/company-push.js` נטען ל-service worker.

### קבצים

נשמרים ב-`server/data/company-files` (או `COMPANY_FILES_DIR`), מחוץ ל-`/uploads` הציבורי. **בפריסה בקונטיינר התיקייה חייבת להיות על volume קבוע.**

### בדיקות

`npm run test:companyos` בתיקיית `server`. משתמש ב-`MONGO_URL` אם הוגדר, אחרת מרים `mongod` זמני.

## התקנה כאפליקציה

`CompanyApp.jsx` מחליף בזמן ריצה את ה-manifest ואת האייקון של הדף ל-`company-manifest.webmanifest`, עם scope נפרד ב-`/company/`.

הקבצים נמצאים ישירות ב-`client/public` ולא בתיקייה `public/company/`. תיקייה בשם הזה הייתה גורמת ל-nginx להחזיר 403 על `/company/`.

## הפעלה ראשונה

מנהל אתר נכנס ל-`/company` ומקים את הארגון, ומוגדר בו כ-`owner`. שאר העובדים מצטרפים בקישור הזמנה.

## עדיין לא נבנה בשלב 1

תבניות Onboarding ו-Offboarding, שליחת ההזמנה במייל (היום מעתיקים קישור).

## עדיין לא נבנה בעבודה

תהליך סטטוסים מותאם לכל צוות.

## עדיין לא נבנה בשיחות

Push לאנדרואיד (דורש פרויקט Firebase), סריקת קבצים לנוזקות, תצוגה מקדימה לקישורים, העדפות התראה לפי סוג.
