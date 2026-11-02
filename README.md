# sterni

Project repository for **sterni**.

## Repository layout

- `client` — frontend.
- `server` — backend.
- `android` — Android integration.
- `docs` — documentation.

## Package scripts

- `npm run install-all`: `npm install --prefix client && npm install --prefix server`
- `npm run dev`: `concurrently -n client,server -c 'bgBlue.bold,bgMagenta.bold' "npm run dev --prefix client" "npm run dev --prefix server"`
- `npm run build`: `npm run build --prefix client`
- `npm run start`: `npm run start --prefix server`
- `npm run docker:up`: `docker-compose up -d --build`
- `npm run docker:down`: `docker-compose down`

## Existing documentation

# פרויקט קייטרינג - Full Stack

פרויקט Full-Stack מודרני המדגים מערכת הזמנות לקייטרינג.
הפרויקט בנוי בארכיטקטורת Monorepo ומכיל:
- **Client**: אפליקציית React עם Vite, TailwindCSS, Zustand ו-React Query.
- **Server**: שרת Express עם Node.js, MongoDB, אימות JWT מאובטח והגנות מתקדמות.
- **Containerization**: הגדרות Docker ו-Docker Compose להרצה קלה בסביבות פיתוח וייצור.

## 🚀 הרצה מקומית (פיתוח)

1.  **התקנת תלויות בכל הפרויקטים:**
    ```bash
    npm run install-all
    ```

2.  **יצירת קובץ סביבה בשרת:**
    - העתק את `server/.env.example` לקובץ חדש בשם `server/.env`.
    - מלא את הערכים הסודיים בקובץ.

3.  **הרצת שרת ולקוח במקביל:**
    ```bash
    npm run dev
    ```
    - הלקוח ירוץ ב-`http://localhost:5173`.
    - השרת ירוץ ב-`http://localhost:4000`.

## 🐳 הרצה עם Docker

ודא ש-Docker ו-Docker Compose מותקנים במערכת.

```bash
npm run docker:up
