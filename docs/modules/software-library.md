# Software Library Module

> Last updated: 2026-04-09

## Overview

ספריית תוכנות אישית — מאפשרת העלאת קבצי התקנה עם תיאור, גרסה, קטגוריה והערות התקנה.
מיועד לשימוש אישי לניהול תוכנות שמותקנות על מחשבים של לקוחות.

## Files

| Layer | Path |
|---|---|
| Model | `server/models/Software.js` |
| Controller | `server/controllers/softwareController.js` |
| Routes | `server/routes/softwareRoutes.js` |
| Page | `client/src/pages/SoftwareLibraryPage.jsx` |
| Route | `/software-library` |
| Navbar | `client/src/components/Navbar.jsx` → `getManagementNav()` |
| Upload dir | `uploads/software/` |

## API Endpoints

All routes are under `/api/software` and require auth (JWT + CSRF).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/software` | רשימת כל התוכנות (query: `category`, `search`) |
| GET | `/api/software/:id` | פרטי תוכנה בודדת |
| GET | `/api/software/:id/download` | הורדת קובץ (מוסיף +1 ל-downloadCount) |
| POST | `/api/software` | העלאת תוכנה חדשה (`multipart/form-data`) |
| PATCH | `/api/software/:id` | עדכון פרטים (ללא החלפת קובץ) |
| DELETE | `/api/software/:id` | מחיקת תוכנה + קובץ מהדיסק |

## Model Fields

```js
{
  title: String,           // שם התוכנה (חובה)
  description: String,     // תיאור כללי
  version: String,         // גרסה (למשל "24.1.0")
  category: enum,          // ראה קטגוריות למטה
  notes: String,           // הערות התקנה / מפתחות רישיון
  filename: String,        // שם הקובץ בדיסק (ייחודי)
  originalFilename: String,// שם מקורי להורדה
  url: String,             // /uploads/software/<filename>
  size: Number,            // גודל בבייטים
  mimetype: String,
  uploadedBy: ObjectId,    // ref User
  downloadCount: Number,   // מונה הורדות
  isPublic: Boolean,       // ברירת מחדל: true
  createdAt, updatedAt
}
```

## Categories

`כלים` | `אופיס` | `אנטי-וירוס` | `גיבוי` | `רשת` | `שרת` | `מולטימדיה` | `כלליות`

## Upload Constraints

- גודל מקסימלי: **2GB**
- סוגי קבצים: `exe, msi, msix, appx, dmg, pkg, deb, rpm, zip, 7z, rar, tar, gz, bz2, xz, iso, img, apk, jar, bat, sh, ps1, inf, cab`
- אחסון: `uploads/software/` (ב-root הפרויקט)

## Permissions

- כל משתמש מחובר יכול לראות, להעלות ולהוריד
- מחיקה/עריכה: רק המעלה עצמו או מנהל (role === 'admin')
