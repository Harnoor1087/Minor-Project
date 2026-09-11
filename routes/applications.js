const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { applications, jobs, users } = require('../db/store');
const { verifyToken, requireAdmin, requireTenant, assertTenantAccess } = require('../middleware/tenantIsolation');
const { analyzeResume, generateCandidateIntelligence, extractTextFromFile } = require('../services/analyzer');

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

      const applicantName = req.body.name || req.user.name || 'Candidate';
      const applicantEmail = req.body.email || req.user.email || 'candidate@example.com';

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

module.exports = router;
