import mongoose from 'mongoose';
import localConnection from './localDb.js';

/**
 * Change Stream Replicator
 * ─────────────────────────────────────────────────────────────────
 * עוקב אחרי כל שינוי בענן (Atlas) ומשכפל אותו למונגו הלוקאלי.
 * תומך ב: insert, update, replace, delete.
 * כשלון בכתיבה לוקאלית לא קורס את האפליקציה — רק log.
 * ─────────────────────────────────────────────────────────────────
 */

let changeStream = null;
let resumeToken = null;

async function waitForLocalConnection(timeoutMs = 8000) {
  if (localConnection.readyState === 1) return;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Local MongoDB did not connect in time')),
      timeoutMs
    );
    localConnection.once('open', () => { clearTimeout(timer); resolve(); });
    localConnection.once('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

export async function startReplication() {
  try {
    await waitForLocalConnection();

    const mainConn = mongoose.connection;
    if (!mainConn.db) {
      throw new Error('Main MongoDB connection has no db object yet');
    }

    const streamOptions = {
      fullDocument: 'updateLookup',
    };
    if (resumeToken) {
      streamOptions.resumeAfter = resumeToken;
    }

    changeStream = mainConn.db.watch([], streamOptions);

    changeStream.on('change', async (change) => {
      // שמור resume token כדי לאפשר המשך אחרי ניתוק
      resumeToken = change._id;

      try {
        const collName = change.ns?.coll;
        if (!collName) return;

        const localDb = localConnection.db;
        const localColl = localDb.collection(collName);

        switch (change.operationType) {
          case 'insert':
            await localColl.replaceOne(
              { _id: change.fullDocument._id },
              change.fullDocument,
              { upsert: true }
            );
            break;

          case 'update':
          case 'replace':
            if (change.fullDocument) {
              await localColl.replaceOne(
                { _id: change.documentKey._id },
                change.fullDocument,
                { upsert: true }
              );
            }
            break;

          case 'delete':
            await localColl.deleteOne({ _id: change.documentKey._id });
            break;

          default:
            // drop, rename וכו׳ — מתעלמים
            break;
        }
      } catch (writeErr) {
        console.error(
          `[REPLICATION] Write error on ${change.operationType} in ${change.ns?.coll}:`,
          writeErr.message
        );
      }
    });

    changeStream.on('error', (err) => {
      console.error('[REPLICATION] Change stream error:', err.message);
      changeStream = null;
      // ממתין ומנסה שוב — לא קורס
      setTimeout(() => {
        console.log('[REPLICATION] Attempting to restart...');
        startReplication().catch((e) =>
          console.error('[REPLICATION] Restart failed:', e.message)
        );
      }, 15_000);
    });

    changeStream.on('close', () => {
      console.warn('[REPLICATION] Change stream closed');
    });

    console.log('✔ Change stream replication active → local MongoDB backup');
  } catch (err) {
    console.error('[REPLICATION] Could not start:', err.message);
    // ממתין ומנסה שוב בלי לקרוס
    setTimeout(() => {
      startReplication().catch((e) =>
        console.error('[REPLICATION] Delayed restart failed:', e.message)
      );
    }, 20_000);
  }
}

export async function stopReplication() {
  if (changeStream) {
    await changeStream.close();
    changeStream = null;
    console.log('[REPLICATION] Stopped');
  }
}
