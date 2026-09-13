import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminDashboard } from './AdminDashboard';

function initReact() {
  const adminRoot = document.getElementById('react-admin-root');
  if (adminRoot) {
    const root = createRoot(adminRoot);
    root.render(<AdminDashboard />);
    console.log('[AIRIS] React Admin Dashboard mounted successfully.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReact);
} else {
  initReact();
}
