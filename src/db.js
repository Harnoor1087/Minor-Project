import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

// Authoritative Firebase Configuration from firebase-applet-config.json
export const firebaseConfig = {
  apiKey: "AIzaSyA5lNJuzYlmywBmPlRIoTXMKoZV8QOZQ24",
  authDomain: "my-project-496502.firebaseapp.com",
  projectId: "my-project-496502",
  storageBucket: "my-project-496502.firebasestorage.app",
  messagingSenderId: "1017843763599",
  appId: "1:1017843763599:web:56ec6e2c4274d4d8d863fa",
  firestoreDatabaseId: "ai-studio-minorproject-6165e1e9-cd80-457b-a50e-c2f905d304f2"
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Cloud Firestore with target database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Stores or updates candidate application data in Firebase Firestore.
 * Adheres directly to the Application schema in firebase-blueprint.json:
 * { id, jobId, applicantId, applicantName, applicantEmail, companyId, status, appliedAt, ... }
 *
 * @param {Object} applicationData - The candidate application data to store
 * @returns {Promise<Object>} The saved application document with its unique ID
 */
export async function storeCandidateApplication(applicationData = {}) {
  if (!applicationData) {
    throw new Error('Candidate application data is required');
  }

  // Ensure a robust unique ID
  const applicationId = String(
    applicationData.id || 
    applicationData._id || 
    ('app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8))
  ).replace(/[\/\s]/g, '_');

  // Build clean application document adhering to Application schema
  const applicationDoc = {
    id: applicationId,
    _id: applicationId,
    jobId: applicationData.jobId !== undefined ? applicationData.jobId : (applicationData.job_id || 1),
    jobTitle: applicationData.jobTitle || applicationData.title || 'Software Engineer',
    applicantId: applicationData.applicantId || applicationData.userId || ('candidate_' + Date.now()),
    applicantName: applicationData.applicantName || applicationData.name || 'Candidate',
    applicantEmail: applicationData.applicantEmail || applicationData.email || 'candidate@example.com',
    companyId: applicationData.companyId || 'comp_airis',
    companyName: applicationData.companyName || 'AIRIS Talent Global',
    companySlug: applicationData.companySlug || 'airis',
    status: applicationData.status || 'pending',
    appliedAt: applicationData.appliedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // AI Screening & Matching scores
    scores: applicationData.scores || {
      final: applicationData.matchScore || applicationData.score || 85,
      semantic: applicationData.semanticScore || 85,
      skill: applicationData.skillScore || 85,
      experience: 80,
      certification: 75
    },
    category: applicationData.category || 'High Match',
    eligibility: applicationData.eligibility || 'Eligible',
    proctoringLevel: applicationData.proctoringLevel || 'medium',

    // Skills & resume metadata
    skills: Array.isArray(applicationData.skills) ? applicationData.skills : (applicationData.matchedSkills || []),
    resumeFileName: applicationData.resumeFileName || applicationData.resumeName || 'Resume.pdf',
    
    // Skill verification & interview stages
    skillVerification: applicationData.skillVerification || {
      status: 'pending',
      score: null,
      passed: false
    },
    interview: applicationData.interview || {
      status: 'not_started',
      overallScore: null
    },

    firestoreSynced: true,
    firestoreSyncedAt: new Date().toISOString()
  };

  // Clean undefined / circular fields
  const cleanDoc = JSON.parse(JSON.stringify(applicationDoc));

  try {
    const docRef = doc(db, 'applications', applicationId);
    await setDoc(docRef, cleanDoc, { merge: true });
    console.log(`[Firestore] Successfully stored candidate application ${applicationId} in cloud database.`);
    return cleanDoc;
  } catch (err) {
    console.error(`[Firestore] Error storing candidate application ${applicationId}:`, err);
    throw err;
  }
}

/**
 * Fetches candidate applications from Firestore with optional filtering by applicant or company.
 *
 * @param {Object} [filter={}] - Optional filters: { applicantEmail, applicantId, companyId, jobId }
 * @returns {Promise<Array>} List of application documents
 */
export async function getCandidateApplications(filter = {}) {
  try {
    const colRef = collection(db, 'applications');
    const snapshot = await getDocs(colRef);
    let apps = [];
    
    snapshot.forEach(d => {
      const data = d.data();
      apps.push({ id: d.id, ...data });
    });

    if (filter.applicantEmail) {
      apps = apps.filter(a => (a.applicantEmail || '').toLowerCase() === filter.applicantEmail.toLowerCase());
    }
    if (filter.applicantId) {
      apps = apps.filter(a => String(a.applicantId) === String(filter.applicantId));
    }
    if (filter.companyId) {
      apps = apps.filter(a => a.companyId === filter.companyId);
    }
    if (filter.jobId) {
      apps = apps.filter(a => String(a.jobId) === String(filter.jobId));
    }

    // Sort newest first
    apps.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
    return apps;
  } catch (err) {
    console.error('[Firestore] Error fetching candidate applications:', err);
    return [];
  }
}

/**
 * Retrieves a single candidate application document by ID.
 *
 * @param {string} applicationId - Unique ID of the application
 * @returns {Promise<Object|null>} The application document or null if not found
 */
export async function getCandidateApplicationById(applicationId) {
  try {
    if (!applicationId) return null;
    const cleanId = String(applicationId).replace(/[\/\s]/g, '_');
    const docRef = doc(db, 'applications', cleanId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (err) {
    console.error(`[Firestore] Error fetching application ${applicationId}:`, err);
    return null;
  }
}

/**
 * Updates application status or details in Firestore.
 *
 * @param {string} applicationId - Unique ID of the application
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated application document
 */
export async function updateCandidateApplication(applicationId, updates = {}) {
  try {
    if (!applicationId) throw new Error('Application ID is required');
    const cleanId = String(applicationId).replace(/[\/\s]/g, '_');
    const docRef = doc(db, 'applications', cleanId);
    const cleanUpdates = JSON.parse(JSON.stringify({
      ...updates,
      updatedAt: new Date().toISOString(),
      firestoreSyncedAt: new Date().toISOString()
    }));
    await updateDoc(docRef, cleanUpdates);
    return { id: cleanId, ...cleanUpdates };
  } catch (err) {
    console.error(`[Firestore] Error updating application ${applicationId}:`, err);
    throw err;
  }
}

// Global browser bridge
if (typeof window !== 'undefined') {
  window.AIRIS_DB = {
    app,
    db,
    storeCandidateApplication,
    getCandidateApplications,
    getCandidateApplicationById,
    updateCandidateApplication
  };
  window.storeCandidateApplication = storeCandidateApplication;
  window.getCandidateApplications = getCandidateApplications;
  window.getCandidateApplicationById = getCandidateApplicationById;
  window.updateCandidateApplication = updateCandidateApplication;
}
