import React from 'react';

export function KpiMetrics({ jobs = [], applications = [] }) {
  const activeJobs = jobs.length;
  const totalApps = applications.length;
  const highMatches = applications.filter(a => (a.scores?.final || 0) >= 70).length;
  const pendingReviews = applications.filter(a => a.status === 'pending' || a.status === 'under_review').length;

  // Calculate pre-interview gate efficiency
  const totalWithGate = applications.filter(a => a.skillVerification && a.skillVerification.status !== 'not_required').length;
  const passedGate = applications.filter(a => a.skillVerification?.passed === true).length;
  const gateEfficiency = totalWithGate > 0 ? Math.round(((totalWithGate - passedGate) / totalWithGate) * 100) : 0;

  return (
    <div className="stats-overview-grid" style={{ marginBottom: '2rem' }}>
      <div className="stat-card">
        <div className="stat-icon stat-icon-indigo">💼</div>
        <div className="stat-info">
          <div className="stat-number">{activeJobs}</div>
          <div className="stat-label">Active Job Openings</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon stat-icon-blue">👥</div>
        <div className="stat-info">
          <div className="stat-number">{totalApps}</div>
          <div className="stat-label">Total Candidate Applications</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon stat-icon-emerald">🎯</div>
        <div className="stat-info">
          <div className="stat-number">{highMatches}</div>
          <div className="stat-label">High Match Candidates (≥70%)</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon stat-icon-amber">⏳</div>
        <div className="stat-info">
          <div className="stat-number">{pendingReviews}</div>
          <div className="stat-label">Pending Reviews</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>🛡️</div>
        <div className="stat-info">
          <div className="stat-number">{gateEfficiency > 0 ? `${gateEfficiency}%` : 'Active'}</div>
          <div className="stat-label">Pre-Interview Screening Filtered</div>
        </div>
      </div>
    </div>
  );
}
