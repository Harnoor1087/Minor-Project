import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { CandidatePortal } from './components/CandidatePortal';
import { InterviewRoom } from './components/InterviewRoom';
import { 
  Briefcase, UserCheck, Video, Moon, Sun, Database, 
  ExternalLink, Layers, Sparkles, User, RefreshCw
} from 'lucide-react';

export function App() {
  const [activeView, setActiveView] = useState('recruiter'); // 'recruiter' | 'applicant' | 'interview'
  const [activeTheme, setActiveTheme] = useState('dark');
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [currentRole, setCurrentRole] = useState('recruiter'); // 'recruiter' | 'applicant'

  // Initialize view from URL
  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const appIdParam = params.get('appId') || params.get('id');

    if (appIdParam) {
      setSelectedAppId(appIdParam);
    }

    if (viewParam === 'applicant' || path.includes('/applicant')) {
      setActiveView('applicant');
      setCurrentRole('applicant');
    } else if (viewParam === 'interview' || path.includes('/interview')) {
      setActiveView('interview');
    } else {
      setActiveView('recruiter');
      setCurrentRole('recruiter');
    }

    // Initialize theme from document or localStorage
    const savedTheme = localStorage.getItem('airis_theme') || 
      (document.documentElement.getAttribute('data-theme') || 'dark');
    setActiveTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Sync tab change to URL
  function handleNavigate(view, appId = null) {
    setActiveView(view);
    if (appId) {
      setSelectedAppId(appId);
    }
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('view', view);
    if (appId) {
      newUrl.searchParams.set('appId', appId);
    } else {
      newUrl.searchParams.delete('appId');
    }
    window.history.pushState({}, '', newUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Toggle theme
  function toggleTheme() {
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setActiveTheme(nextTheme);
    localStorage.setItem('airis_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  }

  // Quick switch role
  function toggleRole() {
    if (currentRole === 'recruiter') {
      setCurrentRole('applicant');
      handleNavigate('applicant');
    } else {
      setCurrentRole('recruiter');
      handleNavigate('recruiter');
    }
  }

  return (
    <div className="airis-app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Global Navigation Bar */}
      <header style={{
        background: 'var(--navbar-bg)',
        borderBottom: '1px solid var(--navbar-border)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backdropFilter: 'blur(10px)'
      }}>
        <div className="container" style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          
          {/* Brand Logo & Cloud Database Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <a 
              href="/react" 
              onClick={(e) => { e.preventDefault(); handleNavigate('recruiter'); }}
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '800',
                fontSize: '1.2rem',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}>
                🤖
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navbar-text)', letterSpacing: '-0.02em' }}>
                AIRIS <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(79, 70, 229, 0.25)', color: '#818cf8', border: '1px solid rgba(129, 140, 248, 0.3)' }}>React v3</span>
              </span>
            </a>

            {/* Cloud Firestore Live Status Badge */}
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#10b981',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
              title="Persistent Google Cloud Firestore connected with real-time sync"
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span>Cloud Firestore Active</span>
            </div>
          </div>

          {/* Primary View Switcher Navigation */}
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '4px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              onClick={() => handleNavigate('recruiter')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: activeView === 'recruiter' ? 'var(--primary)' : 'transparent',
                color: activeView === 'recruiter' ? 'white' : 'var(--navbar-text)',
                transition: 'all 0.2s ease'
              }}
            >
              <Briefcase size={15} />
              <span>Recruiter Matrix</span>
            </button>

            <button
              onClick={() => handleNavigate('applicant')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: activeView === 'applicant' ? 'var(--primary)' : 'transparent',
                color: activeView === 'applicant' ? 'white' : 'var(--navbar-text)',
                transition: 'all 0.2s ease'
              }}
            >
              <UserCheck size={15} />
              <span>Candidate Hub</span>
            </button>

            <button
              onClick={() => handleNavigate('interview')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: activeView === 'interview' ? 'var(--primary)' : 'transparent',
                color: activeView === 'interview' ? 'white' : 'var(--navbar-text)',
                transition: 'all 0.2s ease'
              }}
            >
              <Video size={15} />
              <span>AI Interview Room</span>
            </button>
          </nav>

          {/* Right Action Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            
            {/* Quick Role Switcher Button */}
            <button
              onClick={toggleRole}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--navbar-text)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Quickly test recruiter vs candidate perspective"
            >
              <User size={13} />
              <span>Role: {currentRole === 'recruiter' ? 'Recruiter' : 'Candidate'}</span>
            </button>

            {/* Classic Portal Switcher Link */}
            <a
              href={activeView === 'applicant' ? '/applicant' : (activeView === 'interview' ? '/interview' : '/admin')}
              style={{
                fontSize: '0.78rem',
                color: '#94a3b8',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
              title="Jump to the Classic Vanilla JS View"
            >
              <span>Classic UI</span>
              <ExternalLink size={12} />
            </a>

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="theme-toggle-btn"
              aria-label="Toggle Theme"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--navbar-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {activeTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main App Body */}
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <div className="container" style={{ maxWidth: '1360px', margin: '0 auto' }}>
          
          {/* RECRUITER VIEW */}
          {activeView === 'recruiter' && (
            <AdminDashboard 
              onNavigateToCandidateHub={() => handleNavigate('applicant')}
              onLaunchInterview={(appId) => handleNavigate('interview', appId)}
            />
          )}

          {/* CANDIDATE VIEW */}
          {activeView === 'applicant' && (
            <CandidatePortal 
              onNavigateToInterview={(appId) => handleNavigate('interview', appId)}
              activeTheme={activeTheme}
            />
          )}

          {/* AI INTERVIEW ROOM VIEW */}
          {activeView === 'interview' && (
            <InterviewRoom 
              initialAppId={selectedAppId}
              onBackToPortal={() => handleNavigate('applicant')}
              onNavigateToRecruiter={() => handleNavigate('recruiter')}
            />
          )}

        </div>
      </main>

      {/* Minimal Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '1.25rem 1.5rem',
        background: 'var(--bg-surface)',
        fontSize: '0.82rem',
        color: 'var(--text-muted)'
      }}>
        <div className="container" style={{
          maxWidth: '1360px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            <strong>AIRIS</strong> Enterprise Talent & AI Assessment Suite • Powered by Google Cloud Firestore & React 19
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <a href="/admin" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Classic Admin</a>
            <a href="/applicant" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Classic Applicant</a>
            <a href="/interview" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Classic Interview</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
