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

## התקנה כאפליקציה

`CompanyApp.jsx` מחליף בזמן ריצה את ה-manifest ואת האייקון של הדף ל-`company-manifest.webmanifest`, עם scope נפרד ב-`/company/`.

הקבצים נמצאים ישירות ב-`client/public` ולא בתיקייה `public/company/`. תיקייה בשם הזה הייתה גורמת ל-nginx להחזיר 403 על `/company/`.

## הפעלה ראשונה

מנהל אתר נכנס ל-`/company` ומקים את הארגון, ומוגדר בו כ-`owner`. שאר העובדים מצטרפים בקישור הזמנה.

## עדיין לא נבנה בשלב 1

צוותים, הרשאות מוגבלות בזמן, MFA, רישום כניסות ביומן, שליחת ההזמנה במייל (היום מעתיקים קישור).

## עדיין לא נבנה בעבודה

אבני דרך, תגובות למשימות, תבניות פרויקט, משימות חוזרות, Sprint, תצוגות לוח שנה ו-timeline, מעקב זמנים, גרירה בלוח, ועדכון בזמן אמת.
