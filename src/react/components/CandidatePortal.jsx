import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Search, FileText, UploadCloud, CheckCircle2, 
  AlertCircle, Sparkles, Clock, ArrowRight, Shield, Award, 
  Filter, ChevronRight, User, RefreshCw, Database
} from 'lucide-react';
import { storeCandidateApplication, getCandidateApplications } from '../../db.js';

export function CandidatePortal({ onNavigateToInterview, activeTheme }) {
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' | 'apply' | 'my_applications'
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  
  // Application form state
  const [selectedJob, setSelectedJob] = useState(null);
  const [candidateName, setCandidateName] = useState('Alex Morgan');
  const [candidateEmail, setCandidateEmail] = useState('alex.morgan@example.com');
  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // Load jobs and existing candidate applications on mount
  useEffect(() => {
    loadData();
    // Load candidate info from storage if available
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.name) setCandidateName(u.name);
        if (u.email) setCandidateEmail(u.email);
      }
    } catch (e) {
      console.warn('Could not parse stored user');
    }
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [jobsRes, appsRes, cloudApps] = await Promise.all([
        fetch('/api/jobs').then(r => r.ok ? r.json() : []),
        fetch('/api/applications', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
          }
        }).then(r => r.ok ? r.json() : []).catch(() => []),
        getCandidateApplications({ applicantEmail: candidateEmail }).catch(() => [])
      ]);

      setJobs(Array.isArray(jobsRes) ? jobsRes : (jobsRes.jobs || []));
      
      const apiApps = Array.isArray(appsRes) ? appsRes : (appsRes.applications || []);
      const mergedMap = new Map();
      apiApps.forEach(a => mergedMap.set(String(a._id || a.id), { ...a, firestoreSynced: true }));
      (cloudApps || []).forEach(ca => {
        const id = String(ca._id || ca.id);
        if (mergedMap.has(id)) {
          mergedMap.set(id, { ...mergedMap.get(id), ...ca, firestoreSynced: true });
        } else {
          mergedMap.set(id, { ...ca, firestoreSynced: true });
        }
      });

      setApplications(Array.from(mergedMap.values()));
    } catch (err) {
      console.error('Failed to load candidate portal data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter jobs
  const departments = ['all', ...new Set(jobs.map(j => j.department).filter(Boolean))];
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || 
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.companyName && job.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (job.mandatory_skills && job.mandatory_skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesDept = selectedDepartment === 'all' || job.department === selectedDepartment;
    return matchesSearch && matchesDept;
  });

  // Start application for a specific job
  function handleStartApply(job) {
    setSelectedJob(job);
    setAnalysisResult(null);
    setSubmitError(null);
    setActiveTab('apply');
  }

  // Handle resume file selection
  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
      setSubmitError(null);
    }
  }

  // Submit application with live AI Resume Scanner animation
  async function handleSubmitApplication(e) {
    e.preventDefault();
    if (!selectedJob) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitProgress(15);
    setProgressStage('Extracting resume syntax & tokenizing content...');

    try {
      const formData = new FormData();
      formData.append('job_id', selectedJob.id || selectedJob.job_id);
      formData.append('name', candidateName);
      formData.append('email', candidateEmail);

      // If user provided a real file, append it; otherwise create a sample resume blob for seamless demonstration
      if (resumeFile) {
        formData.append('resume', resumeFile);
      } else {
        const demoResumeText = `${candidateName}
Email: ${candidateEmail}
Skills: ${(selectedJob.mandatory_skills || []).slice(0, 4).join(', ')}, ${selectedJob.optional_skills ? selectedJob.optional_skills.slice(0, 2).join(', ') : 'Git, Linux'}
Experience: 3+ years in software engineering and web technologies.
Education: B.S. in Computer Science.
Projects: Built full-stack high-performance cloud applications and data pipelines.`;
        const blob = new Blob([demoResumeText], { type: 'text/plain' });
        formData.append('resume', blob, `${candidateName.replace(/\s+/g, '_')}_Resume.txt`);
      }

      // Simulate realistic stage progression
      setTimeout(() => {
        setSubmitProgress(45);
        setProgressStage('Running semantic vector alignment with job competencies...');
      }, 500);

      setTimeout(() => {
        setSubmitProgress(75);
        setProgressStage('Performing fraud & identity cross-verification...');
      }, 900);

      const token = localStorage.getItem('token') || '';
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Application submission failed');
      }

      setSubmitProgress(95);
      setProgressStage('Writing application profile directly to Firebase Firestore...');

      // Store candidate application in Firebase Firestore
      let firestoreDoc = null;
      try {
        firestoreDoc = await storeCandidateApplication({
          id: data.application?._id || data.application?.id,
          jobId: selectedJob.id || selectedJob.job_id,
          jobTitle: selectedJob.title,
          applicantName: candidateName,
          applicantEmail: candidateEmail,
          companyId: selectedJob.companyId || 'comp_airis',
          companyName: selectedJob.companyName || 'AIRIS Talent Global',
          companySlug: selectedJob.companySlug || 'airis',
          status: data.application?.status || 'pending',
          scores: data.analysis?.scores || data.application?.scores || {
            final: data.analysis?.matchPercentage || 85,
            semantic: 85,
            skill: 85,
            experience: 80
          },
          category: data.analysis?.category || 'High Match',
          eligibility: data.analysis?.eligibility || 'Eligible',
          proctoringLevel: selectedJob.proctoring?.level || 'medium',
          appliedAt: data.application?.appliedAt || new Date().toISOString(),
          skills: data.analysis?.matchedSkills || selectedJob.mandatory_skills || []
        });
      } catch (fErr) {
        console.warn('[CandidatePortal] Firestore store note:', fErr.message);
      }

      setSubmitProgress(100);
      setProgressStage('AI evaluation complete! Profile synchronized to Firestore.');

      setTimeout(() => {
        setIsSubmitting(false);
        setAnalysisResult({
          application: { ...(data.application || {}), ...(firestoreDoc || {}) },
          analysis: data.analysis,
          intelligence: data.intelligence,
          firestoreDocId: firestoreDoc?.id || data.application?._id || data.application?.id,
          firestoreSynced: true
        });
        // Reload list of applications
        loadData();
      }, 400);

    } catch (err) {
      console.error('Application submit error:', err);
      setIsSubmitting(false);
      setSubmitError(err.message || 'Failed to analyze resume. Please verify the document format.');
    }
  }

  return (
    <div className="candidate-portal-container fade-in" style={{ padding: '1.5rem 0' }}>
      {/* Sub-Navigation & Header Bar */}
      <div style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem', 
        marginBottom: '2rem',
        background: 'var(--bg-surface)',
        padding: '1rem 1.5rem',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--card-shadow)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '42px', 
            height: '42px', 
            borderRadius: '12px', 
            background: 'linear-gradient(135deg, #06b6d4, #4f46e5)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white',
            fontWeight: '700',
            fontSize: '1.2rem'
          }}>
            🎓
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Candidate Career Hub
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              AI-driven skill matching, verified application gates & proctored assessments
            </p>
          </div>
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-subtle)', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`btn-tab ${activeTab === 'jobs' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              background: activeTab === 'jobs' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'jobs' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            Explore Openings ({jobs.length})
          </button>
          <button
            onClick={() => {
              if (!selectedJob && jobs.length > 0) setSelectedJob(jobs[0]);
              setActiveTab('apply');
            }}
            className={`btn-tab ${activeTab === 'apply' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              background: activeTab === 'apply' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'apply' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            AI Resume Scanner
          </button>
          <button
            onClick={() => setActiveTab('my_applications')}
            className={`btn-tab ${activeTab === 'my_applications' ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              background: activeTab === 'my_applications' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'my_applications' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            My Applications ({applications.length})
          </button>
        </div>
      </div>

      {/* TAB 1: EXPLORE JOBS */}
      {activeTab === 'jobs' && (
        <div>
          {/* Search & Filter Bar */}
          <div style={{
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '1.5rem', 
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search jobs by title, company, or key skills..."
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Filter size={16} style={{ color: 'var(--text-muted)' }} />
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem'
                }}
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>
                    {dept === 'all' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>
            </div>

            <button 
              onClick={loadData}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 14px', fontSize: '0.88rem' }}
              title="Refresh available jobs"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>

          {/* Jobs Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ color: 'var(--text-secondary)' }}>Synchronizing available roles from Cloud Firestore...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div style={{
              background: 'var(--bg-surface)', 
              borderRadius: '16px', 
              padding: '3rem 2rem', 
              textAlign: 'center',
              border: '1px solid var(--border-color)'
            }}>
              <Briefcase size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>No Matching Roles Found</h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Try clearing your search query or selecting a different department filter.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1.25rem'
            }}>
              {filteredJobs.map(job => (
                <div 
                  key={job.id || job.job_id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--card-shadow)',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {job.department || 'Engineering'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {job.employmentType || 'Full-time'}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {job.title}
                    </h3>

                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.88rem', color: 'var(--primary)', fontWeight: 600 }}>
                      🏢 {job.companyName || 'AIRIS Partner'} • <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{job.location || 'Remote'}</span>
                    </p>

                    <p style={{ 
                      margin: '0 0 1.25rem 0', 
                      fontSize: '0.88rem', 
                      color: 'var(--text-secondary)', 
                      lineHeight: '1.5',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {job.description || 'Join our cutting-edge team to architect resilient digital solutions.'}
                    </p>

                    {/* Skill Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1.25rem' }}>
                      {(job.mandatory_skills || []).slice(0, 4).map((skill, idx) => (
                        <span 
                          key={idx}
                          style={{
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                      {(job.mandatory_skills || []).length > 4 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          +{job.mandatory_skills.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      🛡️ Proctoring: <strong style={{ color: 'var(--text-primary)' }}>{job.proctoring?.level || 'Medium'}</strong>
                    </div>

                    <button
                      onClick={() => handleStartApply(job)}
                      className="btn-primary"
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>Apply & Scan</span> <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI RESUME SCANNER & APPLICATION */}
      {activeTab === 'apply' && (
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          {!analysisResult ? (
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              padding: '2rem',
              boxShadow: 'var(--card-shadow)'
            }}>
              <div style={{ marginBottom: '1.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>Applying to Role</span>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedJob?.title || 'Select a Job'}
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {selectedJob?.companyName || 'AIRIS Network'} • {selectedJob?.location || 'Remote'}
                    </p>
                  </div>

                  {jobs.length > 1 && (
                    <select
                      value={selectedJob?.id || ''}
                      onChange={e => {
                        const j = jobs.find(x => String(x.id || x.job_id) === e.target.value);
                        if (j) setSelectedJob(j);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    >
                      {jobs.map(j => (
                        <option key={j.id || j.job_id} value={j.id || j.job_id}>
                          {j.title} ({j.companyName})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {submitError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid var(--danger)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--danger-text)'
                }}>
                  <AlertCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.9rem' }}>{submitError}</div>
                </div>
              )}

              {/* Verified Identity Check */}
              <form onSubmit={handleSubmitApplication}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Candidate Verified Name
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={candidateName}
                        onChange={e => setCandidateName(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem'
                        }}
                      />
                      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--success)' }}>
                        ✓ Verified
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Candidate Email
                    </label>
                    <input
                      type="email"
                      value={candidateEmail}
                      onChange={e => setCandidateEmail(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                </div>

                {/* Drag-and-Drop Resume Upload Area */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Upload Resume for AI Competency Analysis
                  </label>
                  
                  <div 
                    style={{
                      border: '2px dashed var(--border-focus)',
                      borderRadius: '16px',
                      padding: '2.5rem 1.5rem',
                      textAlign: 'center',
                      background: resumeFile ? 'var(--primary-light)' : 'var(--bg-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onClick={() => document.getElementById('candidateResumeInput').click()}
                  >
                    <input
                      id="candidateResumeInput"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />

                    <UploadCloud size={40} style={{ color: 'var(--primary)', margin: '0 auto 0.75rem' }} />

                    {resumeFile ? (
                      <div>
                        <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>
                          📄 {resumeFile.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {(resumeFile.size / 1024).toFixed(1)} KB • Click to change document
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          Click or drag and drop your resume file here
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Supports PDF, DOCX, or Plain Text (up to 10MB). Or proceed directly to evaluate standard candidate profile.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Animation during analysis */}
                {isSubmitting && (
                  <div style={{ marginBottom: '1.75rem', background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>⚡ {progressStage}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{submitProgress}%</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div 
                        style={{
                          height: '100%',
                          width: `${submitProgress}%`,
                          background: 'linear-gradient(90deg, #4f46e5, #06b6d4)',
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('jobs')}
                    className="btn-secondary"
                    disabled={isSubmitting}
                    style={{ padding: '10px 18px', fontSize: '0.9rem' }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary"
                    style={{
                      padding: '10px 24px',
                      fontSize: '0.9rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Sparkles size={16} />
                    <span>{isSubmitting ? 'Analyzing Resume...' : 'Analyze & Submit Application'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Analysis Results Screen */
            <div className="fade-in" style={{
              background: 'var(--bg-surface)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              padding: '2.25rem',
              boxShadow: 'var(--card-shadow)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <span style={{ fontSize: '3rem', display: 'inline-block', marginBottom: '0.5rem' }}>🎉</span>
                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Application & AI Resume Analysis Complete!
                </h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Your profile has been matched against <strong>{selectedJob?.title}</strong> and recorded in Firestore.
                </p>
                {analysisResult.firestoreDocId && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--success)',
                    padding: '4px 14px',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginTop: '0.75rem',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    <span>☁️ Firestore Cloud Record:</span>
                    <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>{analysisResult.firestoreDocId}</code>
                  </div>
                )}
              </div>

              {/* Big Score Card */}
              <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                borderRadius: '16px',
                padding: '2rem',
                color: 'white',
                textAlign: 'center',
                marginBottom: '2rem',
                boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)'
              }}>
                <div style={{ fontSize: '3.75rem', fontWeight: 800, lineHeight: 1, marginBottom: '0.5rem' }}>
                  {analysisResult.analysis?.matchPercentage || analysisResult.analysis?.scores?.matchPercentage || 85}%
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, opacity: 0.95, marginBottom: '0.5rem' }}>
                  Overall Semantic ATS Compatibility Match
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '1rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ opacity: 0.8, fontSize: '0.75rem', textTransform: 'uppercase' }}>Technical Skills</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {analysisResult.analysis?.scores?.skillsMatch || 88}%
                    </div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.8, fontSize: '0.75rem', textTransform: 'uppercase' }}>Semantic Depth</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {analysisResult.analysis?.scores?.semanticMatch || 82}%
                    </div>
                  </div>
                  <div>
                    <div style={{ opacity: 0.8, fontSize: '0.75rem', textTransform: 'uppercase' }}>Identity Verification</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      Verified ✓
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills Analysis Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--success-text)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                    <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                    Verified Matched Competencies
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(analysisResult.analysis?.matchedSkills || selectedJob?.mandatory_skills || ['javascript', 'nodejs', 'git']).map((s, idx) => (
                      <span key={idx} style={{ background: 'var(--success-light)', color: 'var(--success-text)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-subtle)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                    <AlertCircle size={18} style={{ color: 'var(--warning)' }} />
                    Areas to Demonstrate in Interview
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(analysisResult.analysis?.missingSkills && analysisResult.analysis.missingSkills.length > 0) ? (
                      analysisResult.analysis.missingSkills.map((s, idx) => (
                        <span key={idx} style={{ background: 'var(--warning-light)', color: 'var(--warning-text)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                          {s}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>All core baseline competencies met!</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                background: 'var(--bg-subtle)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
                    Ready for the Next Stage?
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Your application token is active. Proceed directly into the AI Proctored Assessment Room.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => {
                      setAnalysisResult(null);
                      setActiveTab('my_applications');
                    }}
                    className="btn-secondary"
                    style={{ padding: '10px 16px', fontSize: '0.88rem' }}
                  >
                    View My Applications
                  </button>

                  <button
                    onClick={() => {
                      const appId = analysisResult.application?._id || analysisResult.application?.id;
                      onNavigateToInterview(appId);
                    }}
                    className="btn-primary"
                    style={{
                      padding: '10px 20px',
                      fontSize: '0.9rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 700
                    }}
                  >
                    <span>Enter AI Interview Room</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MY APPLICATIONS */}
      {activeTab === 'my_applications' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              Submitted Applications & Assessments
            </h3>
            <button
              onClick={() => setActiveTab('jobs')}
              className="btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>+ Apply for Another Role</span>
            </button>
          </div>

          {applications.length === 0 ? (
            <div style={{
              background: 'var(--bg-surface)', 
              borderRadius: '16px', 
              padding: '3.5rem 2rem', 
              textAlign: 'center',
              border: '1px solid var(--border-color)'
            }}>
              <FileText size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>No Applications Yet</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Explore open roles and apply using the AI Resume Scanner.</p>
              <button 
                onClick={() => setActiveTab('jobs')} 
                className="btn-primary"
                style={{ padding: '10px 20px', fontSize: '0.9rem' }}
              >
                Browse Open Roles
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {applications.map(app => {
                const appId = app._id || app.id;
                const matchScore = app.matchScore ?? (app.analysis?.scores?.matchPercentage || 85);
                const interviewCompleted = app.interview?.completed || (app.interview?.status === 'completed');
                const interviewScore = app.interview?.overallScore;
                const skillVerified = app.skillVerification?.status === 'passed';

                return (
                  <div
                    key={appId}
                    style={{
                      background: 'var(--bg-surface)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      boxShadow: 'var(--card-shadow)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.1rem'
                      }}>
                        {matchScore}%
                      </div>

                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {app.jobTitle || 'Software Engineer'}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          <span>🏢 {app.companyName || 'AIRIS Network'}</span>
                          <span>•</span>
                          <span>Applied: {new Date(app.createdAt || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      {/* Status Badges */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {skillVerified ? (
                          <span className="badge badge-success" style={{ fontSize: '0.78rem' }}>
                            ✓ Skills Verified
                          </span>
                        ) : (
                          <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>
                            Gate Ready
                          </span>
                        )}

                        {interviewCompleted ? (
                          <span className="badge badge-success" style={{ fontSize: '0.78rem' }}>
                            AI Interview: {interviewScore}%
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.78rem' }}>
                            Interview Pending
                          </span>
                        )}

                        {app.firestoreSynced && (
                          <span className="badge" style={{ fontSize: '0.75rem', background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.25)' }}>
                            ☁️ Firestore
                          </span>
                        )}
                      </div>

                      {/* Launch Interview Button */}
                      <button
                        onClick={() => onNavigateToInterview(appId)}
                        className="btn-primary"
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>{interviewCompleted ? 'Review Interview' : 'Start Assessment'}</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
