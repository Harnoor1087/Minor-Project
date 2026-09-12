const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { applications, jobs, users } = require('../db/store');
const { verifyToken, requireAdmin, requireTenant, assertTenantAccess } = require('../middleware/tenantIsolation');
const { analyzeResume, generateCandidateIntelligence, extractTextFromFile } = require('../services/analyzer');
const { generateScreeningRecommendations, generateOptimizedResume } = require('../services/resumeOptimizer');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Submit application
router.post(
  '/submit',
  verifyToken,
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'certificates', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const { jobId } = req.body;

      if (!jobId) {
        return res.status(400).json({ message: 'Job ID is required' });
      }

      if (!req.files || !req.files.resume || req.files.resume.length === 0) {
        return res.status(400).json({ message: 'Resume file is required' });
      }

      const job = jobs.getById(jobId);
      if (!job) {
        return res.status(404).json({ message: `Job with ID ${jobId} not found` });
      }

      const resumeFile = req.files.resume[0];
      const certFiles = req.files.certificates || [];
      const certificatePaths = certFiles.map(c => c.path);

      // Retrieve authoritative registered account identity for authenticated applicant
      const authenticatedUser = (req.user && req.user.id) ? users.findById(req.user.id) : null;
      const verifiedAccountName = authenticatedUser?.name || req.user?.name || 'Candidate';
      const verifiedAccountEmail = authenticatedUser?.email || req.user?.email || 'candidate@example.com';

      // Anti-Tampering Check: Prevent user from modifying name or email to bypass resume identity verification
      if (req.body.name && req.body.name.trim() !== '') {
        const submittedName = req.body.name.trim();
        if (submittedName.toLowerCase() !== verifiedAccountName.toLowerCase()) {
          return res.status(400).json({
            message: `Account Identity Tampering Prevented: You are authenticated as "${verifiedAccountName}". You cannot change your application name to "${submittedName}". Application fields are locked to your verified account credentials.`,
            identityTampered: true,
            expectedName: verifiedAccountName,
            submittedName
          });
        }
      }

      if (req.body.email && req.body.email.trim() !== '') {
        const submittedEmail = req.body.email.trim();
        if (submittedEmail.toLowerCase() !== verifiedAccountEmail.toLowerCase()) {
          return res.status(400).json({
            message: `Account Identity Tampering Prevented: You are authenticated with email "${verifiedAccountEmail}". You cannot change your application email to "${submittedEmail}". Application fields are locked to your verified account credentials.`,
            identityTampered: true,
            expectedEmail: verifiedAccountEmail,
            submittedEmail
          });
        }
      }

      // Always bind applicant identity strictly to authenticated account
      const applicantName = verifiedAccountName;
      const applicantEmail = verifiedAccountEmail;

      // Perform NLP, AI Resume Analysis, and Integrity & Identity Verification
      const analysis = await analyzeResume({
        resumePath: resumeFile.path,
        certificatePaths,
        job,
        candidateName: applicantName,
        candidateEmail: applicantEmail
      });

      // Strict Identity Verification: Disallow cross-candidate resume uploads (e.g. Kamaljeet uploading Harnoor's resume)
      if (analysis.identityVerification && analysis.identityVerification.status === 'MISMATCH') {
        return res.status(400).json({
          message: `Identity Verification Failed: The uploaded resume belongs to "${analysis.identityVerification.resumeName}", but your registered account name is "${applicantName}". Cross-candidate resume submissions are strictly prohibited for assessment integrity. Please upload your own resume.`,
          identityMismatch: true,
          claimedName: applicantName,
          resumeName: analysis.identityVerification.resumeName
        });
      }

      // Extract resume text and generate candidate intelligence
      let resumeText = '';
      try {
        resumeText = await extractTextFromFile(resumeFile.path);
      } catch (err) {
        console.warn('[Applications] Could not extract resume text:', err.message);
      }

      const intelligence = await generateCandidateIntelligence({
        resumeText,
        candidateName: applicantName,
        job,
        scores: analysis.scores,
        skills: analysis.skills,
        eligibility: analysis.eligibility,
        category: analysis.category
      });

      // Determine Pre-Interview Gate evaluation & status
      const preGate = job.preInterviewGate || { enabled: true, cutoffScore: 70, durationMinutes: 5, allowRetakes: true, maxRetakes: 2, passportBypassEnabled: true };
      const user = users.findById(req.user.id);
      let initialStatus = 'pending';
      let initialSkillVerification = {
        status: 'pending',
        score: null,
        passed: false,
        cutoff: preGate.cutoffScore || 70,
        durationMinutes: preGate.durationMinutes || 5,
        maxAttempts: (preGate.allowRetakes ? (preGate.maxRetakes || 2) + 1 : 1),
        attemptsCount: 0,
        completedAt: null
      };

      if (analysis.eligibility && analysis.eligibility.includes('Rejected')) {
        initialStatus = 'rejected';
      } else if (!preGate.enabled) {
        initialStatus = 'skill_verified';
        initialSkillVerification.status = 'passed';
        initialSkillVerification.passed = true;
        initialSkillVerification.score = 100;
        initialSkillVerification.completedAt = new Date().toISOString();
        initialSkillVerification.summary = 'Pre-Interview Gate is disabled for this position; direct interview access granted.';
      } else if (preGate.passportBypassEnabled && user && Array.isArray(user.verifiedSkills) && user.verifiedSkills.length > 0) {
        const now = new Date();
        const validBadges = user.verifiedSkills.filter(s => new Date(s.expiresAt) > now && (s.score || 0) >= (preGate.cutoffScore || 70));
        const validSkillNames = validBadges.map(s => (s.skill || '').toLowerCase().trim());
        const mandatorySkills = (job.mandatory_skills || []).map(s => s.toLowerCase().trim());
        
        const matched = mandatorySkills.filter(m => validSkillNames.some(vs => vs.includes(m) || m.includes(vs)));
        const matchRatio = mandatorySkills.length > 0 ? (matched.length / mandatorySkills.length) : 1;

        if (matchRatio >= 0.7) {
          const avgScore = Math.round(validBadges.reduce((acc, b) => acc + (b.score || 80), 0) / validBadges.length);
          initialStatus = 'skill_verified';
          initialSkillVerification = {
            status: 'passed',
            score: avgScore,
            passed: true,
            cutoff: preGate.cutoffScore || 70,
            bypassedViaPassport: true,
            attemptsCount: 0,
            completedAt: now.toISOString(),
            summary: `Fast-track approved: Pre-verified competencies in ${matched.join(', ')} via Skill Passport satisfied Pre-Interview Gate.`
          };
        } else {
          initialStatus = 'skill_test_pending';
        }
      } else {
        initialStatus = 'skill_test_pending';
      }

      // Save application to store with intelligence and company scope
      const application = applications.create({
        applicantId: req.user.id,
        applicantName,
        applicantEmail,
        jobId: job.id,
        jobTitle: job.title,
        companyId: job.companyId || 'comp_airis',
        companyName: job.companyName || 'AIRIS Talent Global',
        companySlug: job.companySlug || 'airis',
        proctoringLevel: job.proctoring?.level || 'medium',
        resumePath: resumeFile.path,
        resumeText: (resumeText || '').slice(0, 15000),
        certificates: certificatePaths,
        scores: analysis.scores,
        category: analysis.category,
        eligibility: analysis.eligibility,
        identityVerification: analysis.identityVerification,
        certifications: analysis.certifications,
        status: initialStatus,
        skillVerification: initialSkillVerification
      });

      // Attach intelligence to application
      applications.updateIntelligence(application._id, intelligence);
      application.intelligence = intelligence;

      res.json({
        message: 'Application submitted successfully',
        application,
        analysis,
        intelligence
      });
    } catch (error) {
      console.error('[Applications] Submit error:', error);
      res.status(500).json({
        message: 'Error submitting application',
        error: error.message
      });
    }
  }
);

// Get user's applications
router.get('/my-applications', verifyToken, (req, res) => {
  try {
    const userApps = applications.getByApplicant(req.user.id);
    res.json(userApps);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications', error: error.message });
  }
});

// Get all applications (Admin only, strictly tenant isolated)
router.get('/all', verifyToken, requireAdmin, requireTenant, (req, res) => {
  try {
    const filter = {};
    if (req.isSuperAdmin && req.query.companyId && req.query.companyId !== 'all') {
      filter.companyId = req.query.companyId;
    } else if (!req.isSuperAdmin) {
      // Non-super-admins are strictly isolated to their own tenant
      filter.companyId = req.tenantId;
    }

    const allApps = applications.getAll(filter);
    res.json(allApps);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications', error: error.message });
  }
});

// Update application status (Admin only, strictly tenant isolated)
router.patch('/:id/status', verifyToken, requireAdmin, requireTenant, (req, res) => {
  try {
    const app = applications.getById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Cross-tenant access protection
    if (!assertTenantAccess(req, res, app.companyId, 'Candidate application')) {
      return;
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const updated = applications.updateStatus(req.params.id, status);

    res.json({
      message: 'Status updated',
      application: updated
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
});

// Get candidate intelligence report
router.get('/:id/intelligence', verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Tenant boundary & identity validation
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      let authorized = false;
      await new Promise(resolve => {
        requireTenant(req, res, () => {
          authorized = assertTenantAccess(req, res, app.companyId, 'Candidate application intelligence');
          resolve();
        });
      });
      if (!authorized) return;
    } else if (app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const forceRefresh = req.query.refresh === 'true';

    if (app.intelligence && !forceRefresh) {
      return res.json({
        applicationId: app._id,
        candidateName: app.applicantName,
        jobTitle: app.jobTitle,
        scores: app.scores,
        identityVerification: app.identityVerification,
        certifications: app.certifications,
        intelligence: app.intelligence
      });
    }

    // Generate or refresh intelligence
    const job = jobs.getById(app.jobId) || {
      title: app.jobTitle,
      description: 'Role requirements and competencies',
      mandatory_skills: [],
      optional_skills: []
    };

    let resumeText = '';
    if (app.resumePath && fs.existsSync(app.resumePath)) {
      resumeText = await extractTextFromFile(app.resumePath);
    }

    const intelligence = await generateCandidateIntelligence({
      resumeText,
      candidateName: app.applicantName,
      job,
      scores: app.scores || {},
      skills: app.skills || { matched: [], missing: [] },
      eligibility: app.eligibility,
      category: app.category
    });

    applications.updateIntelligence(app._id, intelligence);

    res.json({
      applicationId: app._id,
      candidateName: app.applicantName,
      jobTitle: app.jobTitle,
      scores: app.scores,
      identityVerification: app.identityVerification,
      certifications: app.certifications,
      intelligence
    });
  } catch (error) {
    console.error('[Applications] Intelligence error:', error);
    res.status(500).json({ message: 'Error retrieving candidate intelligence', error: error.message });
  }
});

// Recruiter AI Assistant: Ask questions about candidate and job
router.post('/:id/ask-candidate-ai', verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Tenant boundary & identity validation
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      let authorized = false;
      await new Promise(resolve => {
        requireTenant(req, res, () => {
          authorized = assertTenantAccess(req, res, app.companyId, 'Candidate application intelligence');
          resolve();
        });
      });
      if (!authorized) return;
    } else if (app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Question prompt is required' });
    }

    const job = jobs.getById(app.jobId) || { title: app.jobTitle, description: '' };
    let resumeText = '';
    if (app.resumePath && fs.existsSync(app.resumePath)) {
      resumeText = await extractTextFromFile(app.resumePath);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const prompt = `You are AIRIS AI Candidate Intelligence Assistant.
Context:
Candidate: ${app.applicantName}
Role Applied: ${app.jobTitle}
Match Score: ${Math.round((app.scores?.final || 0.6) * 100)}%
Candidate Category: ${app.category || 'N/A'}
Resume Text (excerpt):
${resumeText.slice(0, 3000)}

Recruiter Question: "${question}"

Provide a concise, highly objective, professional talent intelligence response (2 paragraphs max). Focus on verified technical background, evidence, potential risks, and concrete interview guidance.`;

        const response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI ask timed out')), 6000))
        ]);

        return res.json({
          answer: response.text ? response.text.trim() : 'AI intelligence response generated.',
          generatedBy: 'AIRIS Gemini Intelligence'
        });
      } catch (err) {
        console.warn('[Applications] AI ask fallback:', err.message);
      }
    }

    res.json({
      answer: `Based on ${app.applicantName}'s profile for ${app.jobTitle} with an overall compatibility score of ${Math.round((app.scores?.final || 0.6) * 100)}%: The candidate demonstrates foundational proficiency aligned with role criteria. Regarding your inquiry ("${question}"), we advise focusing the technical screening on hands-on system implementation and checking production references.`,
      generatedBy: 'AIRIS Heuristic Intelligence'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error querying candidate AI', error: error.message });
  }
});

/**
 * GET /api/applications/:id/screening-feedback
 * Returns actionable skill gaps, section modifications, and projected ATS score
 * when a candidate fails or needs optimization after initial screening.
 */
router.get('/:id/screening-feedback', verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Authorization: owner applicant or tenant admin
    const isOwner = app.applicantId ? (app.applicantId === req.user.id) : (app.applicantEmail === req.user.email);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Access denied to this application' });
    }

    const job = jobs.getById(app.jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job posting not found' });
    }

    // Retrieve resume text
    let resumeText = app.resumeText || '';
    if (!resumeText && app.resumePath && fs.existsSync(app.resumePath)) {
      try {
        resumeText = await extractTextFromFile(app.resumePath);
        applications.update(app._id, { resumeText: resumeText.slice(0, 15000) });
      } catch (e) {
        console.warn('[Applications] Failed extracting resume text for feedback:', e.message);
      }
    }

    const isRejected = (app.status === 'rejected') ||
      (app.eligibility && app.eligibility.includes('Rejected')) ||
      (app.scores && (app.scores.final || 0) < 0.65);

    const recommendations = await generateScreeningRecommendations({
      job,
      resumeText,
      skills: app.skills || { matched: [], missing: [] },
      scores: app.scores || {},
      eligibility: app.eligibility || ''
    });

    res.json({
      applicationId: app._id,
      job: {
        id: job.id,
        title: job.title,
        companyName: job.companyName,
        mandatory_skills: job.mandatory_skills || [],
        optional_skills: job.optional_skills || []
      },
      currentScreening: {
        status: app.status,
        eligibility: app.eligibility,
        scores: app.scores,
        category: app.category,
        isRejected
      },
      hasOptimizedResume: Boolean(app.optimizedResume),
      recommendations
    });
  } catch (err) {
    console.error('[Applications] Error fetching screening feedback:', err);
    res.status(500).json({ message: 'Error retrieving screening feedback', error: err.message });
  }
});

/**
 * POST /api/applications/:id/generate-optimized-resume
 * On-demand: Reconstructs an enhanced resume matching the candidate's original template,
 * incorporating missing competencies and STAR achievements.
 */
router.post('/:id/generate-optimized-resume', verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Authorization: owner applicant or tenant admin
    const isOwner = app.applicantId ? (app.applicantId === req.user.id) : (app.applicantEmail === req.user.email);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Access denied to this application' });
    }

    const job = jobs.getById(app.jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job posting not found' });
    }

    // Retrieve resume text
    let resumeText = app.resumeText || '';
    if (!resumeText && app.resumePath && fs.existsSync(app.resumePath)) {
      try {
        resumeText = await extractTextFromFile(app.resumePath);
      } catch (e) {
        console.warn('[Applications] Failed extracting resume text for optimization:', e.message);
      }
    }

    const optimizedResume = await generateOptimizedResume({
      job,
      resumeText,
      skills: app.skills || { matched: [], missing: [] },
      candidateName: app.applicantName,
      candidateEmail: app.applicantEmail
    });

    // Save optimized resume to application record
    applications.update(app._id, {
      optimizedResume,
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Template-preserved optimized resume generated successfully',
      optimizedResume
    });
  } catch (err) {
    console.error('[Applications] Error generating optimized resume:', err);
    res.status(500).json({ message: 'Failed to generate optimized resume', error: err.message });
  }
});

/**
 * POST /api/applications/:id/rescreen
 * Submits the optimized resume, runs screening re-evaluation,
 * updates ATS scores & eligibility, and unlocks Pre-Interview Skill Verification Gate.
 */
router.post('/:id/rescreen', verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Authorization: owner applicant or tenant admin
    const isOwner = app.applicantId ? (app.applicantId === req.user.id) : (app.applicantEmail === req.user.email);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Access denied to this application' });
    }

    const job = jobs.getById(app.jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job posting not found' });
    }

    const optimized = app.optimizedResume || req.body.optimizedResume;
    if (!optimized || (!optimized.markdownText && !optimized.styledHtml)) {
      return res.status(400).json({ message: 'Please generate an optimized resume first before re-screening.' });
    }

    const newResumeText = (optimized.markdownText || '') + '\n' + (app.resumeText || '');
    const newResumeFilePath = path.join(uploadDir, `optimized-resume-${app._id}.txt`);
    fs.writeFileSync(newResumeFilePath, newResumeText, 'utf8');

    // Run analyzer with new resume file
    const newAnalysis = await analyzeResume({
      resumePath: newResumeFilePath,
      certificatePaths: app.certificates || [],
      job,
      candidateName: app.applicantName,
      candidateEmail: app.applicantEmail
    });

    // Check Pre-Interview Gate configuration
    const preGate = job.preInterviewGate || { enabled: true, cutoffScore: 70, durationMinutes: 5, allowRetakes: true, maxRetakes: 2, passportBypassEnabled: true };
    const isPassing = !newAnalysis.eligibility.includes('Rejected');

    let newStatus = app.status;
    let newSkillVerification = app.skillVerification || {
      status: 'pending',
      score: null,
      passed: false,
      cutoff: preGate.cutoffScore || 70,
      durationMinutes: preGate.durationMinutes || 5,
      maxAttempts: 3,
      attemptsCount: 0
    };

    if (isPassing) {
      if (!preGate.enabled) {
        newStatus = 'skill_verified';
        newSkillVerification.status = 'passed';
        newSkillVerification.passed = true;
        newSkillVerification.score = 100;
        newSkillVerification.summary = 'Direct interview access granted (Pre-Interview Gate disabled).';
      } else {
        newStatus = 'skill_test_pending';
        newSkillVerification.status = 'pending';
      }
    } else {
      newStatus = 'rejected';
    }

    // Update candidate intelligence
    let newIntelligence = app.intelligence;
    try {
      newIntelligence = await generateCandidateIntelligence({
        resumeText: newResumeText,
        candidateName: app.applicantName,
        job,
        scores: newAnalysis.scores,
        skills: newAnalysis.skills,
        eligibility: newAnalysis.eligibility,
        category: newAnalysis.category
      });
    } catch (e) {
      console.warn('[Applications] Failed updating intelligence on rescreen:', e.message);
    }

    const updatedApp = applications.update(app._id, {
      resumePath: newResumeFilePath,
      resumeText: newResumeText.slice(0, 15000),
      scores: newAnalysis.scores,
      category: newAnalysis.category,
      eligibility: newAnalysis.eligibility,
      skills: newAnalysis.skills,
      status: newStatus,
      skillVerification: newSkillVerification,
      intelligence: newIntelligence,
      rescreened: true,
      optimizedResume: optimized,
      rescreenedAt: new Date().toISOString(),
      previousScores: app.scores
    });

    const nextStepUrl = !isPassing
      ? null
      : (!preGate.enabled ? `/interview/${app._id}` : `/skill-test/${app._id}`);

    res.json({
      success: true,
      message: isPassing
        ? 'Congratulations! Your optimized resume passed the screening criteria.'
        : 'Resume re-evaluated. Additional skill adjustments recommended.',
      isPassing,
      application: updatedApp,
      analysis: newAnalysis,
      nextStepUrl
    });
  } catch (err) {
    console.error('[Applications] Error re-screening application:', err);
    res.status(500).json({ message: 'Failed to re-screen application', error: err.message });
  }
});

/**
 * GET /api/applications/:id/optimized-resume-html
 * Returns clean, self-contained printable HTML representation
 */
router.get('/:id/optimized-resume-html', verifyToken, (req, res) => {
  try {
    const app = applications.getById(req.params.id);
    if (!app) return res.status(404).send('Application not found');
    const isOwner = app.applicantId ? (app.applicantId === req.user.id) : (app.applicantEmail === req.user.email);
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin && !isOwner) {
      return res.status(403).send('Access denied');
    }

    if (!app.optimizedResume || !app.optimizedResume.styledHtml) {
      return res.status(404).send('No optimized resume available. Please generate one first.');
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(app.optimizedResume.styledHtml);
  } catch (err) {
    res.status(500).send('Error retrieving resume HTML: ' + err.message);
  }
});

module.exports = router;
