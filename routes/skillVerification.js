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

    const preGate = job.preInterviewGate || {
      enabled: true,
      cutoffScore: 70,
      durationMinutes: 5,
      allowRetakes: true,
      maxRetakes: 2,
      passportBypassEnabled: true
    };
    const passingCutoff = preGate.cutoffScore || job.skill_verification_cutoff || 70;
    const maxAttempts = preGate.allowRetakes ? (preGate.maxRetakes || 2) + 1 : 1;
    const currentAttempts = app.skillVerification?.attemptsCount || 0;

    // If application already has completed skill verification (passed or waived)
    if (app.skillVerification && app.skillVerification.status === 'passed') {
      return res.json({
        alreadyCompleted: true,
        passed: true,
        score: app.skillVerification.score,
        status: app.skillVerification.status,
        summary: app.skillVerification.summary || 'Skills successfully verified',
        verifiedSkills: app.skillVerification.verifiedSkills || [],
        bypassedViaPassport: Boolean(app.skillVerification.bypassedViaPassport),
        waived: Boolean(app.skillVerification.waived),
        waivedBy: app.skillVerification.waivedBy || null,
        waivedReason: app.skillVerification.waivedReason || null,
        nextUrl: `/interview/${app._id}`,
        job: { id: job.id, title: job.title, companyName: job.companyName }
      });
    }

    // If candidate previously failed
    if (app.skillVerification && app.skillVerification.status === 'failed') {
      const isRetakeRequested = req.query.retake === 'true';
      if (!isRetakeRequested || currentAttempts >= maxAttempts) {
        return res.json({
          alreadyCompleted: true,
          passed: false,
          score: app.skillVerification.score,
          status: 'failed',
          canRetake: currentAttempts < maxAttempts,
          attemptsCount: currentAttempts,
          maxAttempts,
          summary: app.skillVerification.summary || 'Technical score below passing threshold.',
          antiInflationVerdict: app.skillVerification.antiInflationVerdict || 'SUSPECTED_KEYWORD_INFLATION',
          results: app.skillVerification.results || null,
          job: { id: job.id, title: job.title, companyName: job.companyName, cutoff: passingCutoff }
        });
      }
    }

    // If an existing pending test is active and not retake
    if (req.query.retake !== 'true' && app.skillVerification?.activeTest && Array.isArray(app.skillVerification.activeTest.questions)) {
      return res.json({
        alreadyCompleted: false,
        test: sanitizeTestForClient(app.skillVerification.activeTest),
        job: {
          id: job.id,
          title: job.title,
          companyName: job.companyName,
          cutoff: passingCutoff,
          durationMinutes: preGate.durationMinutes || 5,
          attemptsCount: currentAttempts,
          maxAttempts
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

    // Generate new randomized test
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
      cutoff: passingCutoff,
      maxAttempts,
      durationMinutes: preGate.durationMinutes || 5,
      startedAt: new Date().toISOString()
    });

    res.json({
      alreadyCompleted: false,
      test: sanitizeTestForClient(generatedTest),
      job: {
        id: job.id,
        title: job.title,
        companyName: job.companyName,
        cutoff: passingCutoff,
        durationMinutes: preGate.durationMinutes || 5,
        attemptsCount: currentAttempts,
        maxAttempts
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
    const preGate = job.preInterviewGate || { enabled: true, cutoffScore: 70, allowRetakes: true, maxRetakes: 2 };
    const passingCutoff = preGate.cutoffScore || job.skill_verification_cutoff || 70;

    const activeTest = app.skillVerification?.activeTest;
    if (!activeTest || !Array.isArray(activeTest.questions)) {
      return res.status(400).json({ message: 'No active skill verification test found for this application' });
    }

    // Evaluate answers securely on server
    const evaluation = evaluateSkillTestAnswers(activeTest.questions, answers, passingCutoff);
    evaluation.tabSwitches = tabSwitches;

    const isPassed = evaluation.passed;
    const newStatus = isPassed ? 'passed' : 'failed';
    const attemptsCount = (app.skillVerification?.attemptsCount || 0) + 1;
    const maxAttempts = app.skillVerification?.maxAttempts || (preGate.allowRetakes ? (preGate.maxRetakes || 2) + 1 : 1);

    const history = Array.isArray(app.skillVerification?.history) ? [...app.skillVerification.history] : [];
    history.push({
      attempt: attemptsCount,
      score: evaluation.scorePercentage,
      passed: isPassed,
      completedAt: new Date().toISOString()
    });

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
      attemptsCount,
      maxAttempts,
      history,
      activeTest: null, // Clear active test so retakes generate fresh questions
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
        ? 'Pre-Interview Skill Gate PASSED! You are unlocked for the Proctored AI Technical Interview.'
        : 'Skill verification score did not meet the requirement. Full AI interview is guarded.',
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
        questionResults: evaluation.questionResults,
        attemptsCount,
        maxAttempts,
        canRetake: !isPassed && attemptsCount < maxAttempts
      },
      nextUrl: isPassed ? `/interview/${app._id}` : null
    });
  } catch (error) {
    console.error('[SkillVerification] Submit error:', error);
    res.status(500).json({ message: 'Error submitting skill verification', error: error.message });
  }
});

/**
 * POST /api/skill-verification/waive/:appId
 * Recruiter override: waive Pre-Interview Gate for candidate
 */
router.post('/waive/:appId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    const app = applications.getById(req.params.appId);
    if (!app) return res.status(404).json({ message: 'Application not found' });

    const reason = req.body.reason || 'Recruiter verified portfolio / production engineering background';

    applications.updateSkillVerification(app._id, {
      status: 'passed',
      passed: true,
      score: 100,
      waived: true,
      waivedBy: req.user.name || 'Recruiter',
      waivedReason: reason,
      completedAt: new Date().toISOString(),
      summary: `Pre-Interview Gate waived by recruiter: ${reason}`
    });
    applications.updateStatus(app._id, 'skill_verified');

    res.json({
      message: 'Pre-Interview Gate waived successfully. Candidate is now unlocked for AI interview.',
      application: applications.getById(app._id)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error waiving skill gate', error: error.message });
  }
});

/**
 * POST /api/skill-verification/grant-retake/:appId
 * Recruiter action: grant an additional skill gate attempt to candidate
 */
router.post('/grant-retake/:appId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    const app = applications.getById(req.params.appId);
    if (!app) return res.status(404).json({ message: 'Application not found' });

    const currentMax = app.skillVerification?.maxAttempts || 2;

    applications.updateSkillVerification(app._id, {
      status: 'pending',
      passed: false,
      activeTest: null,
      maxAttempts: currentMax + 1,
      grantedBy: req.user.name || 'Recruiter',
      grantedAt: new Date().toISOString()
    });
    applications.updateStatus(app._id, 'skill_test_pending');

    res.json({
      message: 'Pre-Interview Gate retake attempt granted. Candidate can now retake the skill test.',
      application: applications.getById(app._id)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error granting retake', error: error.message });
  }
});

/**
 * GET /api/skill-verification/gate-stats
 * Pre-Interview Gate funnel & compute cost savings metrics for recruiter dashboard
 */
router.get('/gate-stats', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { companyId } = req.query;
    const filter = {};
    if (companyId && companyId !== 'all') {
      filter.companyId = companyId;
    }

    const apps = applications.getAll(filter);
    const totalApps = apps.length;

    let gatePending = 0;
    let gatePassed = 0;
    let gateFailed = 0;
    let passportBypassed = 0;
    let gateWaived = 0;
    let keywordInflationFiltered = 0;

    apps.forEach(a => {
      const sv = a.skillVerification;
      if (!sv || sv.status === 'pending') {
        gatePending++;
      } else if (sv.status === 'passed') {
        gatePassed++;
        if (sv.bypassedViaPassport) passportBypassed++;
        if (sv.waived) gateWaived++;
      } else if (sv.status === 'failed') {
        gateFailed++;
        if (sv.antiInflationVerdict === 'SUSPECTED_KEYWORD_INFLATION') {
          keywordInflationFiltered++;
        }
      }
    });

    const evaluatedTotal = gatePassed + gateFailed;
    const passRate = evaluatedTotal > 0 ? Math.round((gatePassed / evaluatedTotal) * 100) : 0;
    const failRate = evaluatedTotal > 0 ? Math.round((gateFailed / evaluatedTotal) * 100) : 0;

    // AI Compute Cost Savings calculation:
    // Every candidate blocked at the gate saves ~30 mins of video compute, Whisper/Gemini Live tokens, and Cloud storage ($2.80 per session)
    const estimatedSavedCostDollars = (gateFailed * 2.80).toFixed(2);
    const savedHours = (gateFailed * 0.5).toFixed(1);

    res.json({
      totalApps,
      evaluatedTotal,
      gatePending,
      gatePassed,
      gateFailed,
      passportBypassed,
      gateWaived,
      keywordInflationFiltered,
      passRate,
      failRate,
      estimatedSavedCostDollars,
      savedHours
    });
  } catch (error) {
    res.status(500).json({ message: 'Error calculating gate stats', error: error.message });
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
