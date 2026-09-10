const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { applications, jobs, users } = require('../db/store');
const { verifyToken } = require('./auth');
const {
  createSkillVerificationTest,
  sanitizeTestForClient,
  evaluateSkillTestAnswers,
  normalizeSkillKey
} = require('../services/skillVerificationService');
const { extractTextFromFile, extractSkillsFromText } = require('../services/analyzer');

// Multer for master resume upload
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `master-${Date.now()}-${safeName}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

/**
 * GET /api/skill-verification/session/:appId
 * Retrieve or initialize the Skill Verification assessment for an application
 */
router.get('/session/:appId', verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.appId);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Authorization: applicant owner or admin
    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this assessment' });
    }

    const job = jobs.getById(app.jobId) || {
      id: app.jobId,
      title: app.jobTitle,
      mandatory_skills: ['python', 'sql'],
      optional_skills: []
    };

    const userObj = users.findById(app.applicantId);
    const existingVerified = (userObj?.verifiedSkills || []).filter(s => new Date(s.expiresAt) > new Date());

    // If application already has completed skill verification
    if (app.skillVerification && app.skillVerification.status === 'passed') {
      return res.json({
        alreadyCompleted: true,
        passed: true,
        score: app.skillVerification.score,
        status: app.skillVerification.status,
        summary: app.skillVerification.summary || 'Skills successfully verified',
        verifiedSkills: app.skillVerification.verifiedSkills || [],
        job: { id: job.id, title: job.title, companyName: job.companyName }
      });
    }

    // If a test session exists in memory/store and not submitted yet
    if (app.skillVerification?.activeTest && Array.isArray(app.skillVerification.activeTest.questions)) {
      return res.json({
        alreadyCompleted: false,
        test: sanitizeTestForClient(app.skillVerification.activeTest),
        job: {
          id: job.id,
          title: job.title,
          companyName: job.companyName,
          cutoff: job.skill_verification_cutoff || 70
        }
      });
    }

    // Extract claimed skills from application or resume analysis
    let claimedSkills = [];
    if (app.skills && Array.isArray(app.skills.matched)) {
      claimedSkills = app.skills.matched;
    } else if (app.scores && app.scores.matchedSkills) {
      claimedSkills = app.scores.matchedSkills;
    }

    // Generate new test
    const generatedTest = await createSkillVerificationTest({
      claimedSkills,
      jobMandatorySkills: job.mandatory_skills || [],
      jobOptionalSkills: job.optional_skills || [],
      candidateName: app.applicantName,
      jobTitle: job.title
    });

    // Save full test on server
    applications.updateSkillVerification(app._id, {
      status: 'pending',
      activeTest: generatedTest,
      startedAt: new Date().toISOString()
    });

    res.json({
      alreadyCompleted: false,
      test: sanitizeTestForClient(generatedTest),
      job: {
        id: job.id,
        title: job.title,
        companyName: job.companyName,
        cutoff: job.skill_verification_cutoff || 70
      }
    });
  } catch (error) {
    console.error('[SkillVerification] Session error:', error);
    res.status(500).json({ message: 'Error initializing skill verification', error: error.message });
  }
});

/**
 * POST /api/skill-verification/submit/:appId
 * Submit candidate answers, score test, award Skill Passport badges, and unlock interview
 */
router.post('/submit/:appId', verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.appId);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { answers, tabSwitches = 0 } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ message: 'Submitted answers are required' });
    }

    const job = jobs.getById(app.jobId) || {};
    const passingCutoff = job.skill_verification_cutoff || 70;

    const activeTest = app.skillVerification?.activeTest;
    if (!activeTest || !Array.isArray(activeTest.questions)) {
      return res.status(400).json({ message: 'No active skill verification test found for this application' });
    }

    // Evaluate answers securely on server
    const evaluation = evaluateSkillTestAnswers(activeTest.questions, answers, passingCutoff);
    evaluation.tabSwitches = tabSwitches;

    const isPassed = evaluation.passed;
    const newStatus = isPassed ? 'passed' : 'failed';

    // Update application skill verification
    applications.updateSkillVerification(app._id, {
      status: newStatus,
      score: evaluation.scorePercentage,
      passed: isPassed,
      cutoff: passingCutoff,
      summary: evaluation.summary,
      antiInflationVerdict: evaluation.antiInflationVerdict,
      verifiedSkills: evaluation.verifiedSkills,
      knowledgeGaps: evaluation.knowledgeGaps,
      tabSwitches,
      completedAt: new Date().toISOString(),
      results: evaluation
    });

    // If passed, update application status to 'skill_verified' and award badges to user passport
    if (isPassed) {
      applications.updateStatus(app._id, 'skill_verified');
      if (evaluation.verifiedSkills.length > 0) {
        users.updateVerifiedSkills(app.applicantId, evaluation.verifiedSkills);
      }
    } else {
      applications.updateStatus(app._id, 'skill_gate_failed');
    }

    res.json({
      message: isPassed
        ? 'Skill verification passed! You are qualified for the AI Technical Interview.'
        : 'Skill verification score did not reach the threshold. Please review key concepts.',
      evaluation: {
        scorePercentage: evaluation.scorePercentage,
        passingCutoff: evaluation.passingCutoff,
        passed: evaluation.passed,
        correctCount: evaluation.correctCount,
        totalQuestions: evaluation.totalQuestions,
        antiInflationVerdict: evaluation.antiInflationVerdict,
        summary: evaluation.summary,
        verifiedSkills: evaluation.verifiedSkills,
        knowledgeGaps: evaluation.knowledgeGaps,
        questionResults: evaluation.questionResults
      },
      nextUrl: isPassed ? `/interview/${app._id}` : null
    });
  } catch (error) {
    console.error('[SkillVerification] Submit error:', error);
    res.status(500).json({ message: 'Error submitting skill verification', error: error.message });
  }
});

/**
 * GET /api/skill-verification/passport
 * Get candidate's verified skills passport and master resume state
 */
router.get('/passport', verifyToken, (req, res) => {
  try {
    const user = users.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const verifiedSkills = (user.verifiedSkills || []).map(s => {
      const isExpired = new Date(s.expiresAt) <= new Date();
      return {
        ...s,
        isExpired,
        daysRemaining: Math.max(0, Math.ceil((new Date(s.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
      };
    });

    res.json({
      candidateName: user.name,
      email: user.email,
      verifiedSkills,
      masterResume: user.masterResume || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching skill passport', error: error.message });
  }
});

/**
 * POST /api/skill-verification/upload-master-resume
 * Upload master resume on student dashboard to parse skills and prepare verification
 */
router.post('/upload-master-resume', verifyToken, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Resume file is required' });
    }

    let resumeText = '';
    try {
      resumeText = await extractTextFromFile(req.file.path);
    } catch (err) {
      console.warn('[SkillVerification] Could not extract text from master resume:', err.message);
    }

    const extractedSkills = extractSkillsFromText(resumeText);

    const masterResumeData = {
      filename: req.file.originalname,
      path: req.file.path,
      uploadedAt: new Date().toISOString(),
      skills: extractedSkills,
      textExcerpt: resumeText.slice(0, 500)
    };

    users.updateMasterResume(req.user.id, masterResumeData);

    res.json({
      message: 'Master resume uploaded and parsed successfully',
      masterResume: masterResumeData
    });
  } catch (error) {
    console.error('[SkillVerification] Master resume upload error:', error);
    res.status(500).json({ message: 'Error uploading master resume', error: error.message });
  }
});

/**
 * POST /api/skill-verification/standalone-test
 * Generate a standalone skill test for a student wanting to verify a skill upfront
 */
router.post('/standalone-test', verifyToken, async (req, res) => {
  try {
    const { skill } = req.body;
    if (!skill) {
      return res.status(400).json({ message: 'Skill name is required' });
    }

    const user = users.findById(req.user.id);
    const test = await createSkillVerificationTest({
      claimedSkills: [skill],
      jobMandatorySkills: [skill],
      candidateName: user ? user.name : 'Candidate',
      jobTitle: `${skill.toUpperCase()} Skill Verification`
    });

    // Store standalone session on user temp
    req.session = req.session || {};

    res.json({
      testId: test.testId,
      skill,
      test: sanitizeTestForClient(test),
      _rawRef: test // for simple demo evaluation
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating standalone skill check', error: error.message });
  }
});

module.exports = router;
