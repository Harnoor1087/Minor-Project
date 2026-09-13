const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  deleteDoc, 
  query, 
  where 
} = require('firebase/firestore');
const path = require('path');
const fs = require('fs');

let db = null;
let isConnected = false;

function initFirestore() {
  if (db) return db;

  const configPath = path.join(__dirname, '../firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.warn('[Firestore] firebase-applet-config.json not found, using local fallback.');
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const firebaseApp = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    });

    db = getFirestore(firebaseApp, config.firestoreDatabaseId || undefined);
    console.log(`[Firestore] Initialized Firestore connected to project: ${config.projectId}, database: ${config.firestoreDatabaseId || '(default)'}`);
    return db;
  } catch (err) {
    console.error('[Firestore] Initialization error:', err.message);
    return null;
  }
}

module.exports = {
  initFirestore,
  getDb: () => db || initFirestore()
};
