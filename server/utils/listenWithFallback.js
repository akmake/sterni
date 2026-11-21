import fs from 'fs';

/**
 * listenWithFallback — מאזין על פורט, ובפיתוח (לא production) עובר לפורט הפנוי הבא אם תפוס.
 *
 * בפרודקשן אין fallback: nginx/PM2 מצפים בדיוק ל-PORT (ברירת מחדל 5000), ושרת שעובר לפורט אחר
 * בשקט היה "עולה" בלי שאף בקשה מגיעה אליו — עדיף ליפול בקול.
 *
 * בפיתוח הפורט שנבחר נכתב ל-portFile (server/.dev-port), וה-proxy של Vite (client/vite.config.js)
 * קורא אותו בכל בקשה — כך הקליינט ממשיך לעבוד גם כשהשרת עבר ל-5001.
 *
 * @param {import('http').Server} server
 * @param {object} opts
 * @param {number} opts.port         פורט מבוקש
 * @param {boolean} opts.allowFallback
 * @param {number} [opts.maxTries=20]
 * @param {string} [opts.portFile]   קובץ שאליו נכתב הפורט בפועל (בפיתוח)
 * @returns {Promise<number>} הפורט שבו השרת מאזין
 */
export default function listenWithFallback(server, { port, allowFallback, maxTries = 20, portFile } = {}) {
    return new Promise((resolve, reject) => {
        const attempt = (p, triesLeft) => {
            // מאזינים מפורשים (ולא callback של listen) — כדי להסיר את 'listening' של ניסיון שנכשל,
            // אחרת הוא נורה גם כשניסיון מאוחר יותר מצליח ומדווח פורט שגוי
            const onListening = () => {
                server.off('error', onError);
                if (portFile) {
                    try { fs.writeFileSync(portFile, String(p)); } catch (_) { /* לא קריטי */ }
                }
                resolve(p);
            };
            const onError = (err) => {
                server.off('listening', onListening);
                if (err.code === 'EADDRINUSE' && allowFallback && triesLeft > 0) {
                    console.warn(`⚠️  פורט ${p} תפוס — מנסה ${p + 1}`);
                    attempt(p + 1, triesLeft - 1);
                } else {
                    reject(err);
                }
            };
            server.once('error', onError);
            server.once('listening', onListening);
            server.listen(p);
        };
        attempt(Number(port), maxTries);
    });
}
