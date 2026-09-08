const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { applications, jobs } = require('../db/store');
const { verifyToken } = require('./auth');
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

      // Perform NLP and AI Resume Analysis
      const analysis = await analyzeResume({
        resumePath: resumeFile.path,
        certificatePaths,
        job
      });

      const applicantName = req.body.name || req.user.name || analysis.candidate_name || 'Candidate';
      const applicantEmail = req.body.email || req.user.email || 'candidate@example.com';

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
        status: analysis.eligibility.includes('Rejected') ? 'rejected' : 'pending'
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

// Get all applications (Admin only, optional company filter)
router.get('/all', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { companyId } = req.query;
    const filter = {};
    if (companyId && companyId !== 'all') {
      filter.companyId = companyId;
    }

    const allApps = applications.getAll(filter);
    res.json(allApps);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications', error: error.message });
  }
});

// Update application status (Admin only)
router.patch('/:id/status', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const updated = applications.updateStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ message: 'Application not found' });
    }

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

    // Ensure applicant can only view their own, unless admin
    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const forceRefresh = req.query.refresh === 'true';

    if (app.intelligence && !forceRefresh) {
      return res.json({
        applicationId: app._id,
        candidateName: app.applicantName,
        jobTitle: app.jobTitle,
        scores: app.scores,
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

    if (req.user.role !== 'admin' && app.applicantId !== req.user.id) {
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
