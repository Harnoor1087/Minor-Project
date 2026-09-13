import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { db, storeCandidateApplication, getCandidateApplications, updateCandidateApplication } from '../db';

export { db, storeCandidateApplication, getCandidateApplications, updateCandidateApplication };

function initReact() {
  const mountPoint = document.getElementById('react-admin-root') || document.getElementById('react-root');
  if (mountPoint) {
    const root = createRoot(mountPoint);
    root.render(<App />);
    console.log('[AIRIS] Unified React Application mounted successfully with Firestore initialized.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReact);
} else {
  initReact();
}

