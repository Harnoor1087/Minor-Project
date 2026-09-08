const express = require('express');
const router = express.Router();
const { applications, jobs, companies } = require('../db/store');
const { verifyToken } = require('./auth');
const {
  calculateCompositeHiringIndex,
  calibrateLevelingAndCompensation,
  generateOfferLetter,
  generateRejectionFeedback
} = require('../services/decisionEngine');

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Recruiter / Admin privilege required.' });
  }
  next();
};

// GET /calibration/:appId and /calibrate/:appId
router.get(['/calibration/:appId', '/calibrate/:appId'], verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.appId);
    if (!app) return res.status(404).json({ message: 'Application not found' });

    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const job = jobs.getById(app.jobId) || {
      title: app.jobTitle,
      companyName: app.companyName || 'AIRIS Talent'
    };

    const chiResult = calculateCompositeHiringIndex({
      scores: app.scores,
      interview: app.interview,
      proctoringReport: app.interview?.proctoringReport
    });

    const calibration = calibrateLevelingAndCompensation({
      job,
      application: app,
      chi: chiResult.compositeHiringIndex
    });

    const matchedSkills = app.skills?.matched || (job.mandatory_skills ? job.mandatory_skills.slice(0, 3) : ['Engineering']);
    const missingSkills = app.skills?.missing || ['Advanced Microservices Telemetry'];
    const interviewScore = app.interview?.overallScore || 75;

    const draftOffer = await generateOfferLetter({
      candidateName: app.applicantName,
      jobTitle: job.title || app.jobTitle,
      companyName: job.companyName || app.companyName,
      baseSalary: calibration.suggestedBaseSalary,
      equity: calibration.equityRange.split('-')[0].trim() || '0.10% Options',
      startDate: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().split('T')[0],
      verifiedSkills: matchedSkills,
      interviewScore
    });

    const draftFeedback = await generateRejectionFeedback({
      candidateName: app.applicantName,
      jobTitle: job.title || app.jobTitle,
      companyName: job.companyName || app.companyName,
      verifiedSkills: matchedSkills,
      missingSkills,
      interviewScore
    });

    res.json({
      applicationId: app._id,
      candidateName: app.applicantName,
      jobTitle: job.title || app.jobTitle,
      companyName: job.companyName || app.companyName,
      candidate: {
        id: app.applicantId,
        name: app.applicantName,
        email: app.applicantEmail
      },
      job: {
        id: job.id,
        title: job.title,
        companyName: job.companyName
      },
      chi: {
        score: chiResult.compositeHiringIndex,
        breakdown: chiResult.breakdown,
        verdict: chiResult.verdict,
        verdictLabel: chiResult.verdictLabel,
        percentile: chiResult.percentile
      },
      chiResult,
      leveling: {
        level: calibration.levelCode,
        title: calibration.levelTitle,
        rampUpWeeks: calibration.rampUpWeeks || 3,
        compensation: {
          baseSalary: calibration.suggestedBaseSalary,
          equity: calibration.equityRange,
          salaryRange: calibration.salaryRange
        }
      },
      calibration,
      draftOffer,
      draftFeedback,
      decision: app.decision || null,
      savedDecision: app.decision || null,
      status: app.status
    });
  } catch (err) {
    console.error('[Decisions] Calibration error:', err);
    res.status(500).json({ message: 'Error calibrating candidate decision', error: err.message });
  }
});

// POST /generate-letter/:appId and /generate-letter
router.post(['/generate-letter/:appId', '/generate-letter'], verifyToken, requireAdmin, async (req, res) => {
  try {
    const appId = req.params.appId || req.body.applicationId;
    const app = applications.getById(appId);
    if (!app) return res.status(404).json({ message: 'Application not found' });

    const { type, verdict, baseSalary, equity, startDate, compensation, customNotes } = req.body;
    const job = jobs.getById(app.jobId) || { title: app.jobTitle, companyName: app.companyName };
    const matchedSkills = app.skills?.matched || (job.mandatory_skills ? job.mandatory_skills.slice(0, 4) : ['Full-Stack Engineering']);
    const missingSkills = app.skills?.missing || [];
    const interviewScore = app.interview?.overallScore || 80;

    const isRejection = verdict === 'REJECT' || type === 'rejection';

    if (isRejection) {
      const letter = await generateRejectionFeedback({
        candidateName: app.applicantName,
        jobTitle: job.title || app.jobTitle,
        companyName: job.companyName || app.companyName,
        verifiedSkills: matchedSkills,
        missingSkills,
        interviewScore,
        customNotes
      });
      return res.json({ letter, type: 'rejection' });
    }

    const effectiveSalary = (compensation && compensation.baseSalary) || baseSalary || '$155,000 USD';
    const effectiveEquity = (compensation && compensation.equity) || equity || '0.15% Options';
    const effectiveDate = (compensation && compensation.startDate) || startDate || new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const letter = await generateOfferLetter({
      candidateName: app.applicantName,
      jobTitle: job.title || app.jobTitle,
      companyName: job.companyName || app.companyName,
      baseSalary: effectiveSalary,
      equity: effectiveEquity,
      startDate: effectiveDate,
      customNotes,
      verifiedSkills: matchedSkills,
      interviewScore
    });

    res.json({ letter, type: 'offer' });
  } catch (err) {
    console.error('[Decisions] Generate letter error:', err);
    res.status(500).json({ message: 'Error generating decision letter', error: err.message });
  }
});

// POST /finalize/:appId and /finalize
router.post(['/finalize/:appId', '/finalize'], verifyToken, requireAdmin, async (req, res) => {
  try {
    const appId = req.params.appId || req.body.applicationId;
    const app = applications.getById(appId);
    if (!app) return res.status(404).json({ message: 'Application not found' });

    const {
      verdict,
      decisionLetter,
      letter,
      customNotes,
      leveling,
      compensation,
      salaryBenchmark,
      compositeHiringIndex
    } = req.body;

    if (!verdict) return res.status(400).json({ message: 'Decision verdict is required' });

    const finalLetter = letter || (typeof decisionLetter === 'string' ? decisionLetter : decisionLetter?.body || '');
    const finalComp = compensation || {
      baseSalary: salaryBenchmark || '$155,000 USD',
      equity: '0.15%',
      startDate: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().split('T')[0]
    };

    const decisionPayload = {
      verdict,
      compositeHiringIndex: compositeHiringIndex || (app.decision?.compositeHiringIndex ?? 85),
      leveling: leveling || app.decision?.leveling || { level: 'L4', title: 'Software Engineer' },
      compensation: finalComp,
      salaryBenchmark: finalComp.baseSalary || salaryBenchmark || 'Market Rate',
      letter: finalLetter,
      finalized: true,
      customNotes: customNotes || '',
      decisionLetter: finalLetter ? {
        body: finalLetter,
        sentAt: new Date().toISOString(),
        sentBy: `${req.user.name || 'Hiring Committee'} (${req.user.company || 'AIRIS Talent'})`
      } : null,
      finalizedBy: req.user.email,
      finalizedAt: new Date().toISOString()
    };

    const updated = applications.updateDecision(app._id, decisionPayload);

    // Update application stage if status changed
    let nextStatus = app.status;
    if (verdict === 'STRONG_HIRE') nextStatus = 'accepted';
    else if (verdict === 'REJECT') nextStatus = 'rejected';
    else if (verdict === 'CONSIDER_WITH_RESERVATIONS') nextStatus = 'reviewed';

    if (nextStatus !== app.status) {
      applications.updateStatus(app._id, nextStatus);
    }

    res.json({
      message: 'Decision successfully finalized and dispatched',
      application: updated,
      decision: updated.decision,
      status: nextStatus
    });
  } catch (err) {
    console.error('[Decisions] Finalize error:', err);
    res.status(500).json({ message: 'Error finalizing decision', error: err.message });
  }
});

// GET /talent-matrix and /matrix
router.get(['/talent-matrix', '/matrix'], verifyToken, requireAdmin, async (req, res) => {
  try {
    const { jobId, companyId } = req.query;
    let allApps = applications.getAll();

    if (companyId && companyId !== 'all') {
      allApps = allApps.filter(a => a.companyId === companyId);
    }

    if (jobId && jobId !== 'all') {
      const targetJobId = parseInt(jobId, 10);
      allApps = allApps.filter(a => a.jobId === targetJobId);
    }

    const rankedCandidates = allApps.map(app => {
      const chiData = calculateCompositeHiringIndex({
        scores: app.scores,
        interview: app.interview,
        proctoringReport: app.interview?.proctoringReport
      });

      const job = jobs.getById(app.jobId) || { title: app.jobTitle };
      const calibration = calibrateLevelingAndCompensation({
        job,
        application: app,
        chi: chiData.compositeHiringIndex
      });

      return {
        _id: app._id,
        applicantName: app.applicantName,
        applicantEmail: app.applicantEmail,
        jobId: app.jobId,
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        scores: app.scores,
        skills: app.skills || { matched: [], missing: [] },
        interview: app.interview || { status: 'not_started' },
        status: app.status,
        appliedAt: app.appliedAt,
        chi: chiData.compositeHiringIndex,
        chiBreakdown: chiData.breakdown,
        verdict: chiData.verdict,
        verdictLabel: chiData.verdictLabel,
        percentile: chiData.percentile,
        leveling: calibration.levelTitle,
        levelCode: calibration.levelCode,
        salaryBenchmark: calibration.salaryRange,
        decision: app.decision || null,
        hasDecision: Boolean(app.decision?.finalized || app.decision?.decisionLetter)
      };
    });

    rankedCandidates.sort((a, b) => b.chi - a.chi);

    const totalApplicants = rankedCandidates.length;
    const completedAssessments = rankedCandidates.filter(c => c.interview && (c.interview.status === 'completed' || c.interview.status === 'disqualified')).length;
    const avgChi = totalApplicants > 0
      ? Math.round(rankedCandidates.reduce((acc, c) => acc + c.chi, 0) / totalApplicants)
      : 0;

    const topCandidate = rankedCandidates.length > 0 ? rankedCandidates[0] : null;

    const matrixItems = rankedCandidates.map((c, i) => ({
      ...c,
      rank: i + 1,
      chi: {
        score: c.chi,
        breakdown: c.chiBreakdown,
        verdict: c.verdict,
        verdictLabel: c.verdictLabel
      },
      leveling: {
        level: c.levelCode,
        title: c.leveling,
        compensation: {
          baseSalary: c.salaryBenchmark
        }
      }
    }));

    res.json({
      cohort: {
        totalApplicants,
        completedAssessments,
        avgChi,
        topCandidate
      },
      candidates: rankedCandidates,
      matrix: matrixItems
    });
  } catch (err) {
    console.error('[Decisions] Talent matrix error:', err);
    res.status(500).json({ message: 'Error generating talent matrix', error: err.message });
  }
});

// POST /compare-candidates and /compare
router.post(['/compare-candidates', '/compare'], verifyToken, requireAdmin, async (req, res) => {
  try {
    const { applicationIds } = req.body;
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ message: 'At least 2 application IDs are required for comparison' });
    }

    const selectedApps = applicationIds
      .map(id => applications.getById(id))
      .filter(Boolean);

    if (selectedApps.length < 2) {
      return res.status(400).json({ message: 'Please select at least 2 valid candidates to compare' });
    }

    const compared = selectedApps.map(app => {
      const chi = calculateCompositeHiringIndex({
        scores: app.scores,
        interview: app.interview,
        proctoringReport: app.interview?.proctoringReport
      });

      const job = jobs.getById(app.jobId) || { title: app.jobTitle };
      const calibration = calibrateLevelingAndCompensation({
        job,
        application: app,
        chi: chi.compositeHiringIndex
      });

      return {
        _id: app._id,
        applicationId: app._id,
        applicantName: app.applicantName,
        candidateName: app.applicantName,
        applicantEmail: app.applicantEmail,
        candidateEmail: app.applicantEmail,
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        chi: {
          score: chi.compositeHiringIndex,
          verdict: chi.verdict,
          breakdown: chi.breakdown
        },
        triad: {
          resumeScorePct: chi.breakdown?.resumeScorePct ?? Math.round((app.scores?.final || 0) * 100),
          interviewScorePct: chi.breakdown?.interviewScorePct ?? (app.interview?.overallScore ?? '--'),
          integrityScorePct: chi.breakdown?.integrityScorePct ?? 100
        },
        leveling: {
          level: calibration.levelCode,
          title: calibration.levelTitle,
          compensation: {
            baseSalary: calibration.suggestedBaseSalary,
            equity: calibration.equityRange,
            salaryRange: calibration.salaryRange
          }
        },
        calibration,
        scores: app.scores,
        skills: Array.isArray(app.skills?.matched) ? app.skills.matched : (Array.isArray(app.skills) ? app.skills : []),
        interview: app.interview || { status: 'not_started' },
        decision: app.decision || null,
        status: app.status
      };
    });

    // Sort by CHI descending
    compared.sort((a, b) => b.chi.score - a.chi.score);

    res.json({
      comparisonCount: compared.length,
      topPickId: compared[0] ? compared[0]._id : null,
      candidates: compared
    });
  } catch (err) {
    console.error('[Decisions] Candidate comparison error:', err);
    res.status(500).json({ message: 'Error comparing candidates', error: err.message });
  }
});

module.exports = router;
