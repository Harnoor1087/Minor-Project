const express = require('express');
const router = express.Router();
const { jobs } = require('../db/store');
const { verifyToken } = require('./auth');

// Get all jobs (with optional companyId/companySlug query filter)
router.get('/', (req, res) => {
  try {
    const { companyId, companySlug } = req.query;
    const allJobs = jobs.getAll({ companyId, companySlug });
    res.json({
      total_jobs: allJobs.length,
      jobs: allJobs
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching jobs', error: error.message });
  }
});

// Get single job
router.get('/:id', (req, res) => {
  try {
    const job = jobs.getById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json({
      job_id: job.id,
      id: job.id,
      title: job.title,
      description: job.description,
      companyId: job.companyId,
      companyName: job.companyName,
      companySlug: job.companySlug,
      department: job.department || 'General',
      location: job.location || 'Remote',
      employmentType: job.employmentType || 'Full-time',
      experienceLevel: job.experienceLevel || 'Mid Level',
      mandatory_skills: job.mandatory_skills,
      optional_skills: job.optional_skills,
      certification_enabled: job.certification_enabled,
      certification_weight: job.certification_weight,
      proctoring: job.proctoring
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching job', error: error.message });
  }
});

// Create job (Admin only)
router.post('/', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const {
      title,
      description,
      mandatory_skills,
      optional_skills,
      certification_enabled,
      certification_weight,
      companyId,
      department,
      location,
      employmentType,
      experienceLevel,
      proctoring,
      proctoring_level
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    // Default companyId to authenticated admin's company if available
    const resolvedCompanyId = companyId || req.user.companyId || 'comp_airis';
    const resolvedProctoring = req.body.proctoring_config || proctoring || (proctoring_level ? { level: proctoring_level } : null);

    const newJob = jobs.create({
      title,
      description,
      mandatory_skills,
      optional_skills,
      certification_enabled,
      certification_weight,
      companyId: resolvedCompanyId,
      department,
      location,
      employmentType,
      experienceLevel,
      proctoring: resolvedProctoring,
      proctoring_level
    });

    res.status(201).json({
      message: 'Job created successfully',
      job_id: newJob.id,
      job: newJob
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating job', error: error.message });
  }
});

// Update job (Admin only)
router.put('/:id', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const payload = { ...req.body };
    if (payload.proctoring_config) {
      payload.proctoring = payload.proctoring_config;
    }

    const updated = jobs.update(req.params.id, payload);
    if (!updated) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({
      message: 'Job updated successfully',
      job_id: updated.id,
      job: updated
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating job', error: error.message });
  }
});

// Delete job (Admin only)
router.delete('/:id', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const deleted = jobs.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({
      message: 'Job deleted successfully',
      deleted_job_id: req.params.id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting job', error: error.message });
  }
});

module.exports = router;
