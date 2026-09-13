const { getDb } = require('./firestoreClient');
const { 
  doc, 
  setDoc, 
  getDocs, 
  collection, 
  deleteDoc 
} = require('firebase/firestore');

const SYNCED_COLLECTIONS = ['users', 'companies', 'jobs', 'applications', 'auditLogs'];

let isHydrating = false;

/**
 * Persists a single entity document to Firestore.
 */
async function syncDocument(collectionName, docId, docData) {
  try {
    const db = getDb();
    if (!db || !docId) return;

    const cleanId = String(docId).replace(/[\/\s]/g, '_');
    const docRef = doc(db, collectionName, cleanId);

    // Deep clone and clean undefined values
    const cleanData = JSON.parse(JSON.stringify(docData));
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.warn(`[FirestoreBridge] Sync warning on ${collectionName}/${docId}:`, err.message);
  }
}

/**
 * Removes a document from Firestore (e.g. GDPR Right to Be Forgotten).
 */
async function deleteDocument(collectionName, docId) {
  try {
    const db = getDb();
    if (!db || !docId) return;

    const cleanId = String(docId).replace(/[\/\s]/g, '_');
    const docRef = doc(db, collectionName, cleanId);
    await deleteDoc(docRef);
    console.log(`[FirestoreBridge] Cloud document deleted: ${collectionName}/${cleanId}`);
  } catch (err) {
    console.warn(`[FirestoreBridge] Delete warning on ${collectionName}/${docId}:`, err.message);
  }
}

/**
 * Hydrates local in-memory store from Firestore and seeds any missing records to the cloud.
 */
async function hydrateStore(state) {
  if (isHydrating) return;
  isHydrating = true;

  try {
    const db = getDb();
    if (!db) {
      isHydrating = false;
      return;
    }

    console.log('[FirestoreBridge] Checking cloud persistence in Firebase Firestore...');

    for (const collName of SYNCED_COLLECTIONS) {
      try {
        const collRef = collection(db, collName);
        const snapshot = await getDocs(collRef);

        const cloudMap = new Map();
        snapshot.forEach(d => {
          const item = d.data();
          const key = String(item._id || item.id || d.id);
          if (!item.id && !item._id) item.id = d.id;
          cloudMap.set(key, item);
        });

        // If cloud has documents, merge or hydrate
        if (cloudMap.size > 0) {
          // Merge local items into cloud if any are missing in cloud
          const localItems = Array.isArray(state[collName]) ? state[collName] : [];
          const missingInCloud = [];

          for (const locItem of localItems) {
            const locKey = String(locItem._id || locItem.id);
            if (!cloudMap.has(locKey)) {
              missingInCloud.push(locItem);
            }
          }

          if (missingInCloud.length > 0) {
            console.log(`[FirestoreBridge] Syncing ${missingInCloud.length} pending local ${collName} to cloud...`);
            for (const item of missingInCloud) {
              const itemId = item._id || item.id || ('doc_' + Date.now());
              await syncDocument(collName, itemId, item);
              const key = String(item._id || item.id);
              cloudMap.set(key, item);
            }
          }

          // Update local state with the complete unified dataset
          state[collName] = Array.from(cloudMap.values());
          console.log(`[FirestoreBridge] Hydrated ${state[collName].length} ${collName} from Firestore.`);
        } else {
          // Cloud collection is empty: seed all local records to Firestore
          const localItems = Array.isArray(state[collName]) ? state[collName] : [];
          if (localItems.length > 0) {
            console.log(`[FirestoreBridge] Seeding ${localItems.length} initial ${collName} to cloud...`);
            for (const item of localItems) {
              const itemId = item._id || item.id || ('doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
              await syncDocument(collName, itemId, item);
            }
            console.log(`[FirestoreBridge] Finished seeding ${collName}.`);
          }
        }
      } catch (collErr) {
        console.warn(`[FirestoreBridge] Notice syncing ${collName}:`, collErr.message);
      }
    }

    console.log('[FirestoreBridge] Firestore cloud persistence active and synchronized.');
  } catch (err) {
    console.warn('[FirestoreBridge] Hydration skipped:', err.message);
  } finally {
    isHydrating = false;
  }
}

module.exports = {
  syncDocument,
  deleteDocument,
  hydrateStore
};
