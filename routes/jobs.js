const express = require('express');
const router = express.Router();
const { jobs } = require('../db/store');
const { verifyToken } = require('./auth');

// Get all jobs
router.get('/', (req, res) => {
  try {
    const allJobs = jobs.getAll();
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
      mandatory_skills: job.mandatory_skills,
      optional_skills: job.optional_skills,
      certification_enabled: job.certification_enabled,
      certification_weight: job.certification_weight
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

    const { title, description, mandatory_skills, optional_skills, certification_enabled, certification_weight } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    const newJob = jobs.create({
      title,
      description,
      mandatory_skills,
      optional_skills,
      certification_enabled,
      certification_weight
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

    const updated = jobs.update(req.params.id, req.body);
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
