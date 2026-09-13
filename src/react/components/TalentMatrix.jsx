import React, { useState, useMemo } from 'react';

export function TalentMatrix({ applications = [], jobs = [], onSelectCandidate, onGenerateOffer }) {
  const [selectedJobId, setSelectedJobId] = useState('all');
  const [minSemantic, setMinSemantic] = useState(50);
  const [minSkill, setMinSkill] = useState(50);
  const [selectedApp, setSelectedApp] = useState(null);

  const filteredApps = useMemo(() => {
    return applications.filter(app => {
      if (selectedJobId !== 'all' && String(app.jobId) !== String(selectedJobId)) {
        return false;
      }
      const semScore = app.scores?.semantic || 0;
      const skScore = app.scores?.skill || 0;
      return semScore >= minSemantic && skScore >= minSkill;
    });
  }, [applications, selectedJobId, minSemantic, minSkill]);

  // Partition into 4 quadrants
  const quadrants = useMemo(() => {
    const q1 = []; // High Skill (>=75), High Semantic/Fit (>=75) -> Elite Tier
    const q2 = []; // High Skill (>=75), Moderate Fit (<75) -> Technical Specialists
    const q3 = []; // Moderate Skill (<75), High Fit (>=75) -> High Potential / Fast Learners
    const q4 = []; // Moderate Skill, Moderate Fit -> Developing Pipeline

    filteredApps.forEach(app => {
      const sk = app.scores?.skill || 0;
      const sem = app.scores?.semantic || 0;
      if (sk >= 75 && sem >= 75) q1.push(app);
      else if (sk >= 75 && sem < 75) q2.push(app);
      else if (sk < 75 && sem >= 75) q3.push(app);
      else q4.push(app);
    });

    return { q1, q2, q3, q4 };
  }, [filteredApps]);

  return (
    <div className="card" style={{ padding: '1.75rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏆</span> 4-Quadrant Talent Calibration Matrix
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Calibrate candidates across Semantic Alignment (X-Axis) and Verified Technical Aptitude (Y-Axis)
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
              Filter by Role:
            </label>
            <select 
              value={selectedJobId} 
              onChange={e => setSelectedJobId(e.target.value)}
              className="form-control"
              style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
            >
              <option value="all">All Active Roles ({applications.length})</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
              Min Semantic: {minSemantic}%
            </label>
            <input 
              type="range" 
              min="0" 
              max="90" 
              value={minSemantic} 
              onChange={e => setMinSemantic(Number(e.target.value))}
              style={{ cursor: 'pointer', width: '100px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
              Min Skill: {minSkill}%
            </label>
            <input 
              type="range" 
              min="0" 
              max="90" 
              value={minSkill} 
              onChange={e => setMinSkill(Number(e.target.value))}
              style={{ cursor: 'pointer', width: '100px' }}
            />
          </div>
        </div>
      </div>

      {/* 2x2 Matrix Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Quadrant 1: Elite / Star Hires */}
        <div 
          style={{ 
            background: 'rgba(16, 185, 129, 0.05)', 
            border: '1px solid rgba(16, 185, 129, 0.3)', 
            borderRadius: '12px', 
            padding: '1.25rem' 
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🌟 Elite Matches (High Fit & High Skill)
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#10b981', color: '#fff' }}>
              {quadrants.q1.length}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
            Ideal top-tier matches with deep domain competency and role alignment.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {quadrants.q1.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px' }}>
                No candidates in this quadrant
              </div>
            ) : (
              quadrants.q1.map(app => (
                <CandidateMatrixCard 
                  key={app._id} 
                  app={app} 
                  onClick={() => setSelectedApp(app)} 
                  accent="#10b981"
                />
              ))
            )}
          </div>
        </div>

        {/* Quadrant 2: Technical Specialists */}
        <div 
          style={{ 
            background: 'rgba(59, 130, 246, 0.05)', 
            border: '1px solid rgba(59, 130, 246, 0.3)', 
            borderRadius: '12px', 
            padding: '1.25rem' 
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚡ Technical Specialists (High Skill)
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#3b82f6', color: '#fff' }}>
              {quadrants.q2.length}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
            Strong technical firepower; may need tailored onboarding or scoped responsibilities.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {quadrants.q2.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px' }}>
                No candidates in this quadrant
              </div>
            ) : (
              quadrants.q2.map(app => (
                <CandidateMatrixCard 
                  key={app._id} 
                  app={app} 
                  onClick={() => setSelectedApp(app)} 
                  accent="#3b82f6"
                />
              ))
            )}
          </div>
        </div>

        {/* Quadrant 3: High Potential / Growth */}
        <div 
          style={{ 
            background: 'rgba(139, 92, 246, 0.05)', 
            border: '1px solid rgba(139, 92, 246, 0.3)', 
            borderRadius: '12px', 
            padding: '1.25rem' 
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 700, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🌱 High Potential (High Semantic Alignment)
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#8b5cf6', color: '#fff' }}>
              {quadrants.q3.length}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
            Exceptional contextual and cultural trajectory; strong candidates for mentorship.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {quadrants.q3.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px' }}>
                No candidates in this quadrant
              </div>
            ) : (
              quadrants.q3.map(app => (
                <CandidateMatrixCard 
                  key={app._id} 
                  app={app} 
                  onClick={() => setSelectedApp(app)} 
                  accent="#8b5cf6"
                />
              ))
            )}
          </div>
        </div>

        {/* Quadrant 4: Secondary Pipeline */}
        <div 
          style={{ 
            background: 'rgba(245, 158, 11, 0.05)', 
            border: '1px solid rgba(245, 158, 11, 0.3)', 
            borderRadius: '12px', 
            padding: '1.25rem' 
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📋 Nurture Pipeline (Developing)
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#f59e0b', color: '#fff' }}>
              {quadrants.q4.length}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
            Candidates that meet baseline criteria; retain in talent community for future openings.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {quadrants.q4.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px' }}>
                No candidates in this quadrant
              </div>
            ) : (
              quadrants.q4.map(app => (
                <CandidateMatrixCard 
                  key={app._id} 
                  app={app} 
                  onClick={() => setSelectedApp(app)} 
                  accent="#f59e0b"
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Candidate Detail Modal */}
      {selectedApp && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.65)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000, 
            backdropFilter: 'blur(4px)',
            padding: '1rem' 
          }}
          onClick={() => setSelectedApp(null)}
        >
          <div 
            className="card" 
            style={{ 
              maxWidth: '600px', 
              width: '100%', 
              borderRadius: '16px', 
              padding: '2rem', 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' 
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.35rem' }}>{selectedApp.applicantName}</h3>
                <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {selectedApp.jobTitle} • {selectedApp.applicantEmail}
                </p>
              </div>
              <button 
                onClick={() => setSelectedApp(null)} 
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Final Score</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                  {selectedApp.scores?.final || 0}%
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Semantic Match</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#3b82f6' }}>
                  {selectedApp.scores?.semantic || 0}%
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Verified Skill</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>
                  {selectedApp.scores?.skill || 0}%
                </div>
              </div>
            </div>

            {/* Proctoring & Integrity */}
            <div style={{ marginBottom: '1.25rem', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Proctoring Integrity:</span>
                <span style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: 700, 
                  padding: '2px 8px', 
                  borderRadius: '9999px',
                  background: selectedApp.interview?.proctoringReport?.integrityStatus === 'DISQUALIFIED' ? '#ef4444' : (selectedApp.interview?.proctoringReport?.integrityStatus === 'FLAGGED' ? '#f59e0b' : '#10b981'),
                  color: '#fff'
                }}>
                  {selectedApp.interview?.proctoringReport?.integrityStatus || 'CLEAN'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => {
                  window.location.href = `/api/applications/${selectedApp._id}`;
                }} 
                className="btn-secondary"
                style={{ fontSize: '0.85rem', padding: '8px 14px' }}
              >
                View Full JSON Profile
              </button>
              <button 
                onClick={() => setSelectedApp(null)} 
                className="btn-primary"
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateMatrixCard({ app, onClick, accent }) {
  const finalScore = app.scores?.final || 0;
  const semScore = app.scores?.semantic || 0;
  const skScore = app.scores?.skill || 0;

  return (
    <div 
      onClick={onClick}
      style={{ 
        padding: '8px 12px', 
        background: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '8px', 
        cursor: 'pointer',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease' 
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{app.applicantName}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Fit: {semScore}% • Tech: {skScore}%
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: accent }}>
        {finalScore}%
      </div>
    </div>
  );
}
