const express = require('express');
const router = express.Router();
const fs = require('fs');
const { applications, jobs, companies } = require('../db/store');
const { verifyToken } = require('./auth');
const { extractTextFromFile } = require('../services/analyzer');
const {
  generateInterviewQuestions,
  evaluateAnswer,
  compileInterviewReport
} = require('../services/interviewEngine');

/**
 * Start or resume an AI Interview Session for an application
 */
router.get('/session/:appId', verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.appId);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Authorization: Must be applicant owner or admin
    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied to this interview session' });
    }

    const job = jobs.getById(app.jobId) || {
      id: app.jobId,
      title: app.jobTitle,
      companyName: app.companyName || 'AIRIS Partner',
      proctoring: {
        level: app.proctoringLevel || 'medium',
        require_camera: true,
        require_microphone: false,
        face_detection: true,
        tab_switch_detection: true,
        max_infractions: 4
      }
    };

    const company = companies.getById(job.companyId) || { name: job.companyName, logo: '🏢' };

    // If questions have not been generated yet, generate them dynamically
    if (!app.interview || !Array.isArray(app.interview.questions) || app.interview.questions.length === 0) {
      let resumeText = '';
      if (app.resumePath && fs.existsSync(app.resumePath)) {
        try {
          resumeText = await extractTextFromFile(app.resumePath);
        } catch (err) {
          console.warn('[Interview] Could not parse resume text for interview context:', err.message);
        }
      }

      const generatedQuestions = await generateInterviewQuestions({
        job,
        resumeText,
        skills: app.skills || { matched: [], missing: [] },
        candidateName: app.applicantName
      });

      const proctoringMax = job.proctoring?.max_infractions || 3;

      const initialInterview = {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        overallScore: null,
        recommendation: null,
        proctoringConfig: job.proctoring,
        questions: generatedQuestions.map(q => ({
          ...q,
          candidateAnswer: '',
          evaluation: null,
          answeredAt: null
        })),
        proctoringReport: {
          integrityStatus: 'CLEAN',
          infractionCount: 0,
          maxInfractions: proctoringMax,
          infractions: []
        }
      };

      applications.updateInterview(app._id, initialInterview);
      app.interview = initialInterview;
    }

    res.json({
      applicationId: app._id,
      candidate: {
        id: app.applicantId,
        name: app.applicantName,
        email: app.applicantEmail
      },
      job: {
        id: job.id,
        title: job.title,
        companyName: job.companyName || company.name,
        companyLogo: company.logo,
        department: job.department,
        proctoring: job.proctoring
      },
      interview: app.interview
    });
  } catch (error) {
    console.error('[Interview] Error initializing session:', error);
    res.status(500).json({ message: 'Error initializing interview session', error: error.message });
  }
});

/**
 * Submit and evaluate an answer for a specific question
 */
router.post('/session/:appId/submit-answer', verifyToken, async (req, res) => {
  try {
    const app = applications.getById(req.params.appId);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { questionIndex, answer } = req.body;
    if (questionIndex === undefined || typeof questionIndex !== 'number') {
      return res.status(400).json({ message: 'Valid questionIndex is required' });
    }

    if (!app.interview || !Array.isArray(app.interview.questions) || !app.interview.questions[questionIndex]) {
      return res.status(400).json({ message: 'Invalid question index for this interview session' });
    }

    const question = app.interview.questions[questionIndex];
    const job = jobs.getById(app.jobId) || { title: app.jobTitle, companyName: app.companyName };

    // Evaluate answer with AI
    const evaluation = await evaluateAnswer({
      question,
      candidateAnswer: answer || '',
      job,
      candidateName: app.applicantName
    });

    question.candidateAnswer = answer || '';
    question.evaluation = evaluation;
    question.answeredAt = new Date().toISOString();

    const questionsList = [...app.interview.questions];
    questionsList[questionIndex] = question;

    applications.updateInterview(app._id, {
      questions: questionsList
    });

    const isLastQuestion = questionIndex === questionsList.length - 1;

    res.json({
      message: 'Answer evaluated successfully',
      questionIndex,
      evaluation,
      isLastQuestion,
      nextQuestionIndex: isLastQuestion ? null : questionIndex + 1
    });
  } catch (error) {
    console.error('[Interview] Error evaluating answer:', error);
    res.status(500).json({ message: 'Error evaluating candidate answer', error: error.message });
  }
});

/**
 * Record a real-time proctoring infraction
 */
router.post('/session/:appId/record-infraction', verifyToken, (req, res) => {
  try {
    const app = applications.getById(req.params.appId);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { type, message, details } = req.body;
    const job = jobs.getById(app.jobId);
    const maxInfractions = job?.proctoring?.max_infractions || 3;

    const result = applications.recordInfraction(app._id, {
      type: type || 'ANOMALY',
      message: message || 'Proctoring alert triggered',
      details: details || '',
      maxInfractions
    });

    res.json({
      message: 'Infraction recorded',
      infraction: result.infraction,
      integrityStatus: result.report.integrityStatus,
      infractionCount: result.report.infractionCount,
      maxInfractions,
      isDisqualified: result.report.integrityStatus === 'DISQUALIFIED'
    });
  } catch (error) {
    console.error('[Interview] Error recording infraction:', error);
    res.status(500).json({ message: 'Error recording infraction', error: error.message });
  }
});

/**
 * Complete the interview session and finalize scoring & proctoring report
 */
router.post('/session/:appId/complete', verifyToken, (req, res) => {
  try {
    const app = applications.getById(req.params.appId);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const job = jobs.getById(app.jobId) || { proctoring: { max_infractions: 3 } };
    const infractions = app.interview?.proctoringReport?.infractions || [];
    const questions = app.interview?.questions || [];

    const report = compileInterviewReport({
      questions,
      infractions,
      proctoringConfig: job.proctoring || {}
    });

    const isDisqualified = report.integrityStatus === 'DISQUALIFIED';

    const updatedInterview = {
      status: isDisqualified ? 'disqualified' : 'completed',
      overallScore: report.overallScore,
      recommendation: report.recommendation,
      completedAt: report.completedAt,
      proctoringReport: {
        ...app.interview?.proctoringReport,
        integrityStatus: report.integrityStatus,
        infractionCount: infractions.length,
        maxInfractions: report.maxInfractions
      }
    };

    applications.updateInterview(app._id, updatedInterview);

    // If disqualified, we can update overall application category / status
    if (isDisqualified) {
      applications.updateStatus(app._id, 'flagged');
    }

    res.json({
      message: 'Interview session completed successfully',
      report: {
        ...report,
        jobTitle: app.jobTitle,
        candidateName: app.applicantName
      },
      interview: updatedInterview
    });
  } catch (error) {
    console.error('[Interview] Error completing interview:', error);
    res.status(500).json({ message: 'Error completing interview session', error: error.message });
  }
});

/**
 * Get comprehensive interview report and audit trail
 */
router.get('/session/:appId/report', verifyToken, (req, res) => {
  try {
    const app = applications.getById(req.params.appId);
    if (!app) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const job = jobs.getById(app.jobId);
    const company = companies.getById(app.companyId);

    res.json({
      applicationId: app._id,
      candidate: {
        name: app.applicantName,
        email: app.applicantEmail
      },
      job: {
        id: app.jobId,
        title: app.jobTitle,
        companyName: app.companyName,
        companyLogo: company?.logo,
        proctoring: job?.proctoring || { level: app.proctoringLevel }
      },
      interview: app.interview || { status: 'not_started' },
      appliedAt: app.appliedAt
    });
  } catch (error) {
    console.error('[Interview] Error retrieving report:', error);
    res.status(500).json({ message: 'Error retrieving interview report', error: error.message });
  }
});

module.exports = router;
