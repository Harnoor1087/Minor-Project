import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CompanyBanner } from './components/CompanyBanner';
import { KpiMetrics } from './components/KpiMetrics';
import { TalentMatrix } from './components/TalentMatrix';
import { CandidateApplications } from './components/CandidateApplications';
import { JobManager } from './components/JobManager';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('matrix');
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');

  const fetchDashboardData = async () => {
    try {
      // 1. Get user profile
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const u = await userRes.json();
        setUser(u.user);
      } else {
        // Fallback to localStorage if cookie-only or token in storage
        const stored = localStorage.getItem('user');
        if (stored) {
          try { setUser(JSON.parse(stored)); } catch (e) {}
        }
      }

      // 2. Get current company
      const compRes = await fetch('/api/companies/current');
      if (compRes.ok) {
        const c = await compRes.json();
        setCompany(c);
      }

      // 3. Get jobs
      const jobsRes = await fetch('/api/jobs');
      if (jobsRes.ok) {
        const jData = await jobsRes.json();
        setJobs(jData.jobs || []);
      }

      // 4. Get applications
      const appsRes = await fetch('/api/applications');
      if (appsRes.ok) {
        const aData = await appsRes.json();
        setApplications(aData.applications || []);
      }

      // 5. Get audit logs
      const auditRes = await fetch('/api/audit-logs?limit=50');
      if (auditRes.ok) {
        const audData = await auditRes.json();
        setAuditLogs(audData.logs || []);
      }
    } catch (err) {
      console.error('[React Admin] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>⚡</div>
          <h3 style={{ margin: 0, fontWeight: 600 }}>Loading React Talent Engine...</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Synchronizing live state from Firebase Firestore
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Header 
        user={user} 
        onLogout={handleLogout} 
        theme={theme} 
        onToggleTheme={toggleTheme} 
      />

      <main className="dashboard-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
        <CompanyBanner company={company} />

        <KpiMetrics jobs={jobs} applications={applications} />

        {/* Navigation Tabs */}
        <div className="tabs" style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap' }}>
          <button 
            className={`tab-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
            style={{ padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 600, fontSize: '0.9rem' }}
          >
            🏆 Talent Matrix & Calibration
          </button>
          <button 
            className={`tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
            style={{ padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 600, fontSize: '0.9rem' }}
          >
            📋 Candidate Applications ({applications.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
            style={{ padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 600, fontSize: '0.9rem' }}
          >
            💼 Job Listings ({jobs.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
            style={{ padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 600, fontSize: '0.9rem' }}
          >
            🛡️ Security Audit Logs
          </button>
        </div>

        {/* Tab Views */}
        {activeTab === 'matrix' && (
          <TalentMatrix 
            applications={applications} 
            jobs={jobs} 
          />
        )}

        {activeTab === 'applications' && (
          <CandidateApplications 
            applications={applications} 
            jobs={jobs} 
            onRefresh={fetchDashboardData} 
          />
        )}

        {activeTab === 'jobs' && (
          <JobManager 
            jobs={jobs} 
            company={company} 
            onRefresh={fetchDashboardData} 
          />
        )}

        {activeTab === 'audit' && (
          <div className="card" style={{ padding: '1.75rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🛡️</span> Immutable Security Audit Logs ({auditLogs.length})
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Enterprise compliance trail synced with Google Cloud Firebase
                </p>
              </div>
              <button onClick={fetchDashboardData} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                Refresh Trail
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 10px' }}>Timestamp</th>
                    <th style={{ padding: '8px 10px' }}>Actor</th>
                    <th style={{ padding: '8px 10px' }}>Action</th>
                    <th style={{ padding: '8px 10px' }}>Target</th>
                    <th style={{ padding: '8px 10px' }}>IP / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                        No audit logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.slice(0, 30).map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <strong>{log.actorEmail}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>{log.actorRole}</span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-secondary)', fontWeight: 600 }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {log.targetType}: {log.targetId || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                          {log.ip ? `${log.ip} • ` : ''} {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
