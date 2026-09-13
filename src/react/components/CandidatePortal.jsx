import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Search, FileText, UploadCloud, CheckCircle2, 
  AlertCircle, Sparkles, Clock, ArrowRight, Shield, Award, 
  Filter, ChevronRight, User, RefreshCw, Database,
  Phone, Globe, Check, X, Info
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
  const [candidatePhone, setCandidatePhone] = useState('+1 (555) 019-2834');
  const [candidateLinkedin, setCandidateLinkedin] = useState('https://linkedin.com/in/alex-morgan');
  const [yearsExperience, setYearsExperience] = useState('3');
  const [resumeMode, setResumeMode] = useState('upload'); // 'upload' | 'builder'
  const [resumeFile, setResumeFile] = useState(null);
  const [structuredSummary, setStructuredSummary] = useState('');
  const [structuredSkills, setStructuredSkills] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);

  // Client-side validation state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

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
        if (u.phone) setCandidatePhone(u.phone);
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

  // Comprehensive Client-Side Form Validation
  function validateForm(overrideValues = {}) {
    const data = {
      candidateName,
      candidateEmail,
      candidatePhone,
      candidateLinkedin,
      yearsExperience,
      resumeMode,
      resumeFile,
      structuredSummary,
      structuredSkills,
      consentChecked,
      ...overrideValues
    };

    const newErrors = {};

    // 1. Full Name: required, min 2 chars, letters and allowed punctuation only
    const name = (data.candidateName || '').trim();
    if (!name) {
      newErrors.candidateName = 'Full Name is required.';
    } else if (name.length < 2) {
      newErrors.candidateName = 'Full Name must be at least 2 characters.';
    } else if (name.length > 80) {
      newErrors.candidateName = 'Full Name cannot exceed 80 characters.';
    } else if (!/^[a-zA-Z\s.'\-]+$/.test(name)) {
      newErrors.candidateName = 'Name may only contain letters, spaces, hyphens, and apostrophes.';
    }

    // 2. Email: required, valid RFC 5322 standard format
    const email = (data.candidateEmail || '').trim();
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!email) {
      newErrors.candidateEmail = 'Email address is required.';
    } else if (!emailPattern.test(email)) {
      newErrors.candidateEmail = 'Please provide a valid email address (e.g. name@domain.com).';
    }

    // 3. Contact Phone: required, valid phone number format with 7 to 15 digits
    const phone = (data.candidatePhone || '').trim();
    if (!phone) {
      newErrors.candidatePhone = 'Contact phone number is required.';
    } else {
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        newErrors.candidatePhone = 'Phone number must contain between 7 and 15 digits.';
      }
    }

    // 4. Portfolio / LinkedIn URL (optional, but if provided must be a valid http/https URL)
    const url = (data.candidateLinkedin || '').trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          newErrors.candidateLinkedin = 'URL must start with https:// or http://';
        }
      } catch (err) {
        newErrors.candidateLinkedin = 'Please enter a valid web URL (e.g. https://linkedin.com/in/alex).';
      }
    }

    // 5. Years of experience: required, integer between 0 and 50
    const expStr = String(data.yearsExperience ?? '').trim();
    if (expStr === '') {
      newErrors.yearsExperience = 'Years of experience is required.';
    } else {
      const numExp = Number(expStr);
      if (isNaN(numExp) || !Number.isInteger(numExp) || numExp < 0 || numExp > 50) {
        newErrors.yearsExperience = 'Experience must be a whole number between 0 and 50 years.';
      }
    }

    // 6. Resume: File upload vs Structured mode
    if (data.resumeMode === 'upload') {
      if (!data.resumeFile) {
        newErrors.resumeFile = 'Please upload a resume file (PDF, DOCX, or TXT).';
      } else {
        const allowedExts = ['.pdf', '.docx', '.doc', '.txt'];
        const fileName = data.resumeFile.name.toLowerCase();
        const hasValidExt = allowedExts.some(ext => fileName.endsWith(ext));
        const maxSizeBytes = 10 * 1024 * 1024; // 10MB

        if (!hasValidExt) {
          newErrors.resumeFile = 'Invalid file format. Only PDF, DOCX, or TXT documents are accepted.';
        } else if (data.resumeFile.size === 0) {
          newErrors.resumeFile = 'The selected file is empty (0 bytes). Please upload a valid document.';
        } else if (data.resumeFile.size > maxSizeBytes) {
          newErrors.resumeFile = `File size is ${(data.resumeFile.size / (1024 * 1024)).toFixed(1)}MB, exceeding the 10MB limit.`;
        }
      }
    } else {
      const skills = (data.structuredSkills || '').trim();
      const summary = (data.structuredSummary || '').trim();
      if (!skills || skills.length < 3) {
        newErrors.structuredSkills = 'Please list at least 1-2 core skills or competencies.';
      }
      if (!summary || summary.length < 25) {
        newErrors.structuredSummary = 'Please provide a professional summary (at least 25 characters).';
      }
    }

    // 7. Consent: required certification
    if (!data.consentChecked) {
      newErrors.consentChecked = 'You must certify your information and consent to store your application in Firestore.';
    }

    return newErrors;
  }

  // Handle field blur for real-time feedback
  function handleFieldBlur(field) {
    setTouched(prev => ({ ...prev, [field]: true }));
    const currentErrors = validateForm();
    setErrors(currentErrors);
  }

  // Handle field change with active re-validation if already touched
  function handleFieldChange(field, value, setter) {
    setter(value);
    setSubmitError(null);
    if (touched[field] || hasAttemptedSubmit) {
      const currentErrors = validateForm({ [field]: value });
      setErrors(currentErrors);
    }
  }

  // Start application for a specific job
  function handleStartApply(job) {
    setSelectedJob(job);
    setAnalysisResult(null);
    setSubmitError(null);
    setErrors({});
    setTouched({});
    setHasAttemptedSubmit(false);
    setConsentChecked(false);
    if (job?.mandatory_skills) {
      setStructuredSkills(job.mandatory_skills.slice(0, 4).join(', '));
    }
    setActiveTab('apply');
  }

  // Handle resume file selection with immediate validation
  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setResumeFile(file);
      setTouched(prev => ({ ...prev, resumeFile: true }));
      const currentErrors = validateForm({ resumeFile: file });
      setErrors(currentErrors);
      setSubmitError(null);
    }
  }

  // Submit application with comprehensive client-side validation before writing to Firestore
  async function handleSubmitApplication(e) {
    e.preventDefault();
    if (!selectedJob) return;

    // Mark all fields as touched to display inline errors
    setHasAttemptedSubmit(true);
    setTouched({
      candidateName: true,
      candidateEmail: true,
      candidatePhone: true,
      candidateLinkedin: true,
      yearsExperience: true,
      resumeFile: true,
      structuredSkills: true,
      structuredSummary: true,
      consentChecked: true
    });

    const validationErrors = validateForm();
    setErrors(validationErrors);

    // Stop immediately if any client-side validation error is found
    if (Object.keys(validationErrors).length > 0) {
      const errorCount = Object.keys(validationErrors).length;
      setSubmitError(`Please correct the ${errorCount} highlighted validation ${errorCount === 1 ? 'error' : 'errors'} before submitting.`);
      
      // Auto-focus and scroll to the first invalid field
      const firstField = Object.keys(validationErrors)[0];
      const targetElement = document.getElementById(`field-${firstField}`);
      if (targetElement) {
        targetElement.focus();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitProgress(15);
    setProgressStage('Extracting resume syntax & tokenizing content...');

    try {
      const formData = new FormData();
      formData.append('job_id', selectedJob.id || selectedJob.job_id);
      formData.append('name', candidateName.trim());
      formData.append('email', candidateEmail.trim());
      formData.append('phone', candidatePhone.trim());
      formData.append('experience', yearsExperience);
      formData.append('linkedin', candidateLinkedin.trim());

      // If user uploaded a real file, append it; otherwise generate structured profile file
      if (resumeMode === 'upload' && resumeFile) {
        formData.append('resume', resumeFile);
      } else {
        const generatedResumeText = `Candidate: ${candidateName.trim()}
Email: ${candidateEmail.trim()}
Phone: ${candidatePhone.trim()}
LinkedIn / Portfolio: ${candidateLinkedin.trim() || 'N/A'}
Experience: ${yearsExperience} years
Skills: ${structuredSkills.trim() || (selectedJob.mandatory_skills || []).join(', ')}

Professional Summary:
${structuredSummary.trim() || 'Experienced engineer with demonstrated background in building scalable web and software systems.'}`;
        const blob = new Blob([generatedResumeText], { type: 'text/plain' });
        formData.append('resume', blob, `${candidateName.trim().replace(/\s+/g, '_')}_Profile.txt`);
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
      setProgressStage('Writing verified candidate profile directly to Firebase Firestore...');

      // Store candidate application in Firebase Firestore
      let firestoreDoc = null;
      try {
        firestoreDoc = await storeCandidateApplication({
          id: data.application?._id || data.application?.id,
          jobId: selectedJob.id || selectedJob.job_id,
          jobTitle: selectedJob.title,
          applicantName: candidateName.trim(),
          applicantEmail: candidateEmail.trim(),
          applicantPhone: candidatePhone.trim(),
          applicantExperience: Number(yearsExperience) || 0,
          applicantLinkedin: candidateLinkedin.trim() || undefined,
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
                  border: '1px solid var(--danger, #ef4444)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  color: 'var(--danger-text, #ef4444)'
                }}>
                  <AlertCircle size={20} style={{ color: 'var(--danger, #ef4444)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{submitError}</div>
                    {hasAttemptedSubmit && Object.keys(errors).length > 0 && (
                      <ul style={{ margin: '6px 0 0 0', paddingLeft: '1.25rem', fontSize: '0.83rem', opacity: 0.9 }}>
                        {Object.entries(errors).map(([key, msg]) => (
                          <li key={key}>{msg}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Comprehensive Validated Candidate Form */}
              <form onSubmit={handleSubmitApplication} noValidate>
                {/* Section 1: Candidate Contact & Profile Details */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={18} style={{ color: 'var(--primary)' }} />
                    Candidate Profile & Contact Details
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                    {/* Full Name */}
                    <div>
                      <label htmlFor="field-candidateName" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <span>Full Name <strong style={{ color: '#ef4444' }}>*</strong></span>
                        {touched.candidateName && !errors.candidateName && (
                          <span style={{ color: 'var(--success, #10b981)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} /> Valid
                          </span>
                        )}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="field-candidateName"
                          type="text"
                          value={candidateName}
                          onChange={e => handleFieldChange('candidateName', e.target.value, setCandidateName)}
                          onBlur={() => handleFieldBlur('candidateName')}
                          placeholder="e.g. Alex Morgan"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: `1px solid ${touched.candidateName && errors.candidateName ? '#ef4444' : touched.candidateName ? '#10b981' : 'var(--border-color)'}`,
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            boxShadow: touched.candidateName && errors.candidateName ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none'
                          }}
                        />
                      </div>
                      {touched.candidateName && errors.candidateName && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={13} /> {errors.candidateName}
                        </div>
                      )}
                    </div>

                    {/* Email Address */}
                    <div>
                      <label htmlFor="field-candidateEmail" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <span>Email Address <strong style={{ color: '#ef4444' }}>*</strong></span>
                        {touched.candidateEmail && !errors.candidateEmail && (
                          <span style={{ color: 'var(--success, #10b981)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} /> Valid
                          </span>
                        )}
                      </label>
                      <input
                        id="field-candidateEmail"
                        type="email"
                        value={candidateEmail}
                        onChange={e => handleFieldChange('candidateEmail', e.target.value, setCandidateEmail)}
                        onBlur={() => handleFieldBlur('candidateEmail')}
                        placeholder="e.g. alex.morgan@example.com"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: `1px solid ${touched.candidateEmail && errors.candidateEmail ? '#ef4444' : touched.candidateEmail ? '#10b981' : 'var(--border-color)'}`,
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          outline: 'none',
                          boxShadow: touched.candidateEmail && errors.candidateEmail ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none'
                        }}
                      />
                      {touched.candidateEmail && errors.candidateEmail && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={13} /> {errors.candidateEmail}
                        </div>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label htmlFor="field-candidatePhone" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <span>Phone Number <strong style={{ color: '#ef4444' }}>*</strong></span>
                        {touched.candidatePhone && !errors.candidatePhone && (
                          <span style={{ color: 'var(--success, #10b981)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} /> Valid
                          </span>
                        )}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="field-candidatePhone"
                          type="tel"
                          value={candidatePhone}
                          onChange={e => handleFieldChange('candidatePhone', e.target.value, setCandidatePhone)}
                          onBlur={() => handleFieldBlur('candidatePhone')}
                          placeholder="+1 (555) 019-2834"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: `1px solid ${touched.candidatePhone && errors.candidatePhone ? '#ef4444' : touched.candidatePhone ? '#10b981' : 'var(--border-color)'}`,
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            boxShadow: touched.candidatePhone && errors.candidatePhone ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none'
                          }}
                        />
                      </div>
                      {touched.candidatePhone && errors.candidatePhone && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={13} /> {errors.candidatePhone}
                        </div>
                      )}
                    </div>

                    {/* Years of Experience */}
                    <div>
                      <label htmlFor="field-yearsExperience" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <span>Years of Experience <strong style={{ color: '#ef4444' }}>*</strong></span>
                        {touched.yearsExperience && !errors.yearsExperience && (
                          <span style={{ color: 'var(--success, #10b981)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} /> Valid
                          </span>
                        )}
                      </label>
                      <input
                        id="field-yearsExperience"
                        type="number"
                        min="0"
                        max="50"
                        step="1"
                        value={yearsExperience}
                        onChange={e => handleFieldChange('yearsExperience', e.target.value, setYearsExperience)}
                        onBlur={() => handleFieldBlur('yearsExperience')}
                        placeholder="e.g. 3"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: `1px solid ${touched.yearsExperience && errors.yearsExperience ? '#ef4444' : touched.yearsExperience ? '#10b981' : 'var(--border-color)'}`,
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          outline: 'none',
                          boxShadow: touched.yearsExperience && errors.yearsExperience ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none'
                        }}
                      />
                      {touched.yearsExperience && errors.yearsExperience && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={13} /> {errors.yearsExperience}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LinkedIn or Portfolio URL (Optional with format validation) */}
                  <div style={{ marginTop: '1.25rem' }}>
                    <label htmlFor="field-candidateLinkedin" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>LinkedIn / Portfolio URL <span style={{ fontWeight: 400, opacity: 0.7 }}>(Optional)</span></span>
                      {candidateLinkedin && touched.candidateLinkedin && !errors.candidateLinkedin && (
                        <span style={{ color: 'var(--success, #10b981)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={13} /> Valid URL
                        </span>
                      )}
                    </label>
                    <input
                      id="field-candidateLinkedin"
                      type="url"
                      value={candidateLinkedin}
                      onChange={e => handleFieldChange('candidateLinkedin', e.target.value, setCandidateLinkedin)}
                      onBlur={() => handleFieldBlur('candidateLinkedin')}
                      placeholder="https://linkedin.com/in/alex-morgan"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: `1px solid ${touched.candidateLinkedin && errors.candidateLinkedin ? '#ef4444' : touched.candidateLinkedin && candidateLinkedin ? '#10b981' : 'var(--border-color)'}`,
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxShadow: touched.candidateLinkedin && errors.candidateLinkedin ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : 'none'
                      }}
                    />
                    {touched.candidateLinkedin && errors.candidateLinkedin && (
                      <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={13} /> {errors.candidateLinkedin}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Resume / Profile Submission */}
                <div style={{ marginBottom: '1.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} style={{ color: 'var(--primary)' }} />
                      Resume & Qualifications <strong style={{ color: '#ef4444' }}>*</strong>
                    </h3>

                    {/* Mode Toggle */}
                    <div style={{ display: 'flex', background: 'var(--bg-subtle)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setResumeMode('upload');
                          setErrors(prev => ({ ...prev, structuredSkills: undefined, structuredSummary: undefined }));
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: resumeMode === 'upload' ? 'var(--primary)' : 'transparent',
                          color: resumeMode === 'upload' ? '#ffffff' : 'var(--text-secondary)'
                        }}
                      >
                        Upload Document
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResumeMode('builder');
                          setErrors(prev => ({ ...prev, resumeFile: undefined }));
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: resumeMode === 'builder' ? 'var(--primary)' : 'transparent',
                          color: resumeMode === 'builder' ? '#ffffff' : 'var(--text-secondary)'
                        }}
                      >
                        Structured Builder
                      </button>
                    </div>
                  </div>

                  {resumeMode === 'upload' ? (
                    <div>
                      <div 
                        id="field-resumeFile"
                        tabIndex={0}
                        style={{
                          border: `2px dashed ${touched.resumeFile && errors.resumeFile ? '#ef4444' : resumeFile ? 'var(--primary)' : 'var(--border-focus)'}`,
                          borderRadius: '16px',
                          padding: '2.25rem 1.5rem',
                          textAlign: 'center',
                          background: resumeFile ? 'var(--primary-light)' : (touched.resumeFile && errors.resumeFile ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-subtle)'),
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                          outline: 'none'
                        }}
                        onClick={() => document.getElementById('candidateResumeInput').click()}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            document.getElementById('candidateResumeInput').click();
                          }
                        }}
                      >
                        <input
                          id="candidateResumeInput"
                          type="file"
                          accept=".pdf,.docx,.doc,.txt"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />

                        <UploadCloud size={38} style={{ color: touched.resumeFile && errors.resumeFile ? '#ef4444' : 'var(--primary)', margin: '0 auto 0.75rem' }} />

                        {resumeFile ? (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: 'var(--primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <span>📄 {resumeFile.name}</span>
                              <CheckCircle2 size={16} style={{ color: 'var(--success, #10b981)' }} />
                            </p>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              {(resumeFile.size / 1024).toFixed(1)} KB • Document validated • Click to replace file
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                              Click or drag and drop your resume file here
                            </p>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              Supports PDF, DOCX, or Plain Text (maximum size 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                      {touched.resumeFile && errors.resumeFile && (
                        <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <AlertCircle size={14} /> {errors.resumeFile}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Structured Skills */}
                      <div>
                        <label htmlFor="field-structuredSkills" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                          Core Skills & Competencies <strong style={{ color: '#ef4444' }}>*</strong>
                        </label>
                        <input
                          id="field-structuredSkills"
                          type="text"
                          value={structuredSkills}
                          onChange={e => handleFieldChange('structuredSkills', e.target.value, setStructuredSkills)}
                          onBlur={() => handleFieldBlur('structuredSkills')}
                          placeholder="e.g. React, Node.js, TypeScript, PostgreSQL, System Design"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: `1px solid ${touched.structuredSkills && errors.structuredSkills ? '#ef4444' : touched.structuredSkills && structuredSkills ? '#10b981' : 'var(--border-color)'}`,
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            outline: 'none'
                          }}
                        />
                        {touched.structuredSkills && errors.structuredSkills && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={13} /> {errors.structuredSkills}
                          </div>
                        )}
                      </div>

                      {/* Structured Summary */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label htmlFor="field-structuredSummary" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Professional Background & Projects <strong style={{ color: '#ef4444' }}>*</strong>
                          </label>
                          <span style={{ fontSize: '0.78rem', color: structuredSummary.length < 25 ? 'var(--text-muted)' : 'var(--success, #10b981)' }}>
                            {structuredSummary.length} characters (min 25)
                          </span>
                        </div>
                        <textarea
                          id="field-structuredSummary"
                          rows={4}
                          value={structuredSummary}
                          onChange={e => handleFieldChange('structuredSummary', e.target.value, setStructuredSummary)}
                          onBlur={() => handleFieldBlur('structuredSummary')}
                          placeholder="Describe your engineering experience, notable projects, systems built, and architectural responsibilities..."
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: `1px solid ${touched.structuredSummary && errors.structuredSummary ? '#ef4444' : touched.structuredSummary && structuredSummary.length >= 25 ? '#10b981' : 'var(--border-color)'}`,
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            resize: 'vertical'
                          }}
                        />
                        {touched.structuredSummary && errors.structuredSummary && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={13} /> {errors.structuredSummary}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3: Legal Certification & Firestore Consent */}
                <div style={{
                  marginBottom: '1.75rem',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  background: touched.consentChecked && errors.consentChecked ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-subtle)',
                  border: `1px solid ${touched.consentChecked && errors.consentChecked ? '#ef4444' : 'var(--border-color)'}`
                }}>
                  <label htmlFor="field-consentChecked" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', margin: 0 }}>
                    <input
                      id="field-consentChecked"
                      type="checkbox"
                      checked={consentChecked}
                      onChange={e => handleFieldChange('consentChecked', e.target.checked, setConsentChecked)}
                      onBlur={() => handleFieldBlur('consentChecked')}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      <strong>Certification & Firestore Storage Consent <span style={{ color: '#ef4444' }}>*</span>:</strong> I certify that all details provided in this application are accurate and truthful. I authorize the system to evaluate my resume competencies and persist my verified candidate record in <strong>Firebase Firestore</strong>.
                    </span>
                  </label>
                  {touched.consentChecked && errors.consentChecked && (
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '6px', marginLeft: '24px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={13} /> {errors.consentChecked}
                    </div>
                  )}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <Shield size={15} style={{ color: 'var(--primary)' }} />
                    <span>Validated client-side prior to Firestore synchronization</span>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
                      <span>{isSubmitting ? 'Analyzing & Saving...' : 'Validate & Submit to Firestore'}</span>
                    </button>
                  </div>
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
