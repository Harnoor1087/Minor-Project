import React, { useState, useMemo } from 'react';

export function CandidateApplications({ applications = [], jobs = [], onRefresh, onPurge }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processingId, setProcessingId] = useState(null);

  const filtered = useMemo(() => {
    return applications.filter(app => {
      if (roleFilter !== 'all' && String(app.jobId) !== String(roleFilter)) return false;
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const name = (app.applicantName || '').toLowerCase();
        const email = (app.applicantEmail || '').toLowerCase();
        const job = (app.jobTitle || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !job.includes(q)) return false;
      }
      return true;
    });
  }, [applications, roleFilter, statusFilter, searchTerm]);

  const handleStatusChange = async (appId, newStatus) => {
    setProcessingId(appId);
    try {
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        alert(data.message || 'Status update failed');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleGdprPurge = async (appId, candidateName) => {
    if (!confirm(`Are you sure you want to completely erase and shred all records for candidate "${candidateName}" under GDPR Right-to-be-Forgotten? This action is permanent and syncs to Firestore.`)) {
      return;
    }
    setProcessingId(appId);
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        alert(data.message || 'Purge failed');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="card" style={{ padding: '1.75rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📋</span> Candidate Applications
            <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '9999px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              {filtered.length} total
            </span>
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Review candidate semantic analysis, verified skill scores, and proctoring integrity
          </p>
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Search candidate name or email..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="form-control"
            style={{ padding: '6px 12px', fontSize: '0.85rem', width: '220px', borderRadius: '8px' }}
          />

          <select 
            value={roleFilter} 
            onChange={e => setRoleFilter(e.target.value)}
            className="form-control"
            style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
          >
            <option value="all">All Roles</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>

          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            className="form-control"
            style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="reviewed">Reviewed</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>

          <button 
            onClick={onRefresh} 
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {/* Applications Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px 12px' }}>Candidate</th>
              <th style={{ padding: '10px 12px' }}>Role</th>
              <th style={{ padding: '10px 12px' }}>AI Match Score</th>
              <th style={{ padding: '10px 12px' }}>Pre-Gate</th>
              <th style={{ padding: '10px 12px' }}>Proctoring</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                  No candidate applications found matching current criteria.
                </td>
              </tr>
            ) : (
              filtered.map(app => {
                const finalScore = app.scores?.final || 0;
                const integrityStatus = app.interview?.proctoringReport?.integrityStatus || 'CLEAN';
                const gatePassed = app.skillVerification?.passed;

                return (
                  <tr 
                    key={app._id} 
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{app.applicantName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{app.applicantEmail}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div>{app.jobTitle}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Applied {new Date(app.appliedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontWeight: 800, 
                          color: finalScore >= 70 ? '#10b981' : (finalScore >= 50 ? '#f59e0b' : '#ef4444') 
                        }}>
                          {finalScore}%
                        </span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          (Sem: {app.scores?.semantic || 0}% | Sk: {app.scores?.skill || 0}%)
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {app.skillVerification ? (
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          padding: '2px 8px', 
                          borderRadius: '9999px',
                          background: gatePassed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: gatePassed ? '#10b981' : '#ef4444'
                        }}>
                          {gatePassed ? '✓ Passed' : '✕ Failed'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: '9999px',
                        background: integrityStatus === 'DISQUALIFIED' ? 'rgba(239, 68, 68, 0.2)' : (integrityStatus === 'FLAGGED' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)'),
                        color: integrityStatus === 'DISQUALIFIED' ? '#ef4444' : (integrityStatus === 'FLAGGED' ? '#f59e0b' : '#10b981')
                      }}>
                        {integrityStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <select 
                        value={app.status || 'pending'} 
                        onChange={e => handleStatusChange(app._id, e.target.value)}
                        disabled={processingId === app._id}
                        className="form-control"
                        style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="under_review">Under Review</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <a 
                          href={`/api/applications/${app._id}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.78rem', textDecoration: 'none' }}
                          title="View application JSON record"
                        >
                          Details
                        </a>
                        <button 
                          onClick={() => handleGdprPurge(app._id, app.applicantName)}
                          disabled={processingId === app._id}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.78rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', cursor: 'pointer' }}
                          title="GDPR Right to Be Forgotten Purge"
                        >
                          Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
