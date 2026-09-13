import React, { useState } from 'react';

export function JobManager({ jobs = [], company, onRefresh }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [location, setLocation] = useState('Remote');
  const [experienceLevel, setExperienceLevel] = useState('Mid');
  const [description, setDescription] = useState('');
  const [mandatorySkills, setMandatorySkills] = useState('JavaScript, Node.js, React');
  const [proctoringLevel, setProctoringLevel] = useState('medium');
  const [enableSkillGate, setEnableSkillGate] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Please fill in title and description');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title,
        department,
        location,
        experienceLevel,
        description,
        mandatorySkills: mandatorySkills.split(',').map(s => s.trim()).filter(Boolean),
        proctoringLevel,
        enableSkillVerificationGate: enableSkillGate,
        companyId: company?._id || company?.id || 'comp_airis'
      };

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowCreateModal(false);
        setTitle('');
        setDescription('');
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to create job');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ padding: '1.75rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💼</span> Active Job Openings ({jobs.length})
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Configure proctoring strictness, pre-interview verification gates, and candidate criteria
          </p>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)} 
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <span>➕</span> Post New Opening
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {jobs.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', padding: '2rem', textAlign: 'center', gridColumn: '1 / -1' }}>
            No active jobs found for this workspace. Click "Post New Opening" to create one.
          </div>
        ) : (
          jobs.map(job => (
            <div 
              key={job.id} 
              style={{ 
                border: '1px solid var(--border-color)', 
                borderRadius: '12px', 
                padding: '1.25rem', 
                background: 'var(--bg-card)',
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between' 
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{job.title}</h4>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    padding: '2px 8px', 
                    borderRadius: '9999px',
                    background: job.proctoringLevel === 'strict' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: job.proctoringLevel === 'strict' ? '#ef4444' : '#3b82f6'
                  }}>
                    🛡️ {job.proctoringLevel || 'Standard'} Proctoring
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  {job.department || 'Engineering'} • {job.location || 'Remote'} • {job.experienceLevel || 'Mid'}
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {job.description}
                </p>

                {Array.isArray(job.mandatorySkills) && job.mandatorySkills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                    {job.mandatorySkills.map((sk, i) => (
                      <span key={i} style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {job.enableSkillVerificationGate ? '⚡ Pre-gate Active' : 'Direct Apply'}
                </span>
                <a 
                  href={`/applicant?jobId=${job.id}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '4px 10px', textDecoration: 'none' }}
                >
                  Candidate Apply Link ➔
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="card" 
            style={{ 
              maxWidth: '650px', 
              width: '100%', 
              borderRadius: '16px', 
              padding: '2rem', 
              maxHeight: '90vh', 
              overflowY: 'auto' 
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Create New Job Opening</h3>
              <button 
                onClick={() => setShowCreateModal(false)} 
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Job Title *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="e.g. Senior Backend AI Engineer" 
                  required 
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Department</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={department} 
                    onChange={e => setDepartment(e.target.value)} 
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Location</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={location} 
                    onChange={e => setLocation(e.target.value)} 
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Experience</label>
                  <select 
                    className="form-control" 
                    value={experienceLevel} 
                    onChange={e => setExperienceLevel(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px' }}
                  >
                    <option value="Entry">Entry Level</option>
                    <option value="Mid">Mid Level</option>
                    <option value="Senior">Senior Level</option>
                    <option value="Lead">Staff / Lead</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Mandatory Skills (Comma separated)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={mandatorySkills} 
                  onChange={e => setMandatorySkills(e.target.value)} 
                  placeholder="e.g. Python, Docker, PyTorch, SQL" 
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Proctoring Strictness</label>
                  <select 
                    className="form-control" 
                    value={proctoringLevel} 
                    onChange={e => setProctoringLevel(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px' }}
                  >
                    <option value="low">Low (Passive logging)</option>
                    <option value="medium">Medium (Standard AI checks)</option>
                    <option value="strict">Strict (3-strike disqualification)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={enableSkillGate} 
                      onChange={e => setEnableSkillGate(e.target.checked)} 
                    />
                    Enable Pre-Interview Skill Verification Gate
                  </label>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Role Description *</label>
                <textarea 
                  className="form-control" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  rows="4" 
                  placeholder="Provide responsibilities, requirements, and tech stack details..." 
                  required 
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="btn-primary"
                  style={{ padding: '8px 20px' }}
                >
                  {submitting ? 'Publishing...' : 'Publish Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
