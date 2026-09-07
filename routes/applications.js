const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { applications, jobs } = require('../db/store');
const { verifyToken } = require('./auth');
const { analyzeResume } = require('../services/analyzer');

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

      // Save application to store
      const application = applications.create({
        applicantId: req.user.id,
        applicantName,
        applicantEmail,
        jobId: job.id,
        jobTitle: job.title,
        resumePath: resumeFile.path,
        certificates: certificatePaths,
        scores: analysis.scores,
        category: analysis.category,
        eligibility: analysis.eligibility,
        status: analysis.eligibility.includes('Rejected') ? 'rejected' : 'pending'
      });

      res.json({
        message: 'Application submitted successfully',
        application,
        analysis
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

// Get all applications (Admin only)
router.get('/all', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const allApps = applications.getAll();
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

module.exports = router;
