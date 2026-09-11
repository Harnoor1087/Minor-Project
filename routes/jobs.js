const express = require('express');
const router = express.Router();
const { jobs } = require('../db/store');
const { verifyToken, requireAdmin, requireTenant, assertTenantAccess } = require('../middleware/tenantIsolation');

// Helper to optionally extract authenticated user if token is present
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  try {
    verifyToken(req, res, () => {
      // If user is admin, resolve tenant context
      if (req.user?.role === 'admin' || req.user?.role === 'super_admin') {
        requireTenant(req, res, next);
      } else {
        next();
      }
    });
  } catch (e) {
    next();
  }
}

// Get all jobs (with tenant isolation for recruiters, public filter for candidates)
router.get('/', optionalAuth, (req, res) => {
  try {
    const { companyId, companySlug, scope } = req.query;
    let filter = {};

    // If request comes from an authenticated recruiter/admin, enforce their tenant
    if (req.user && (req.user.role === 'admin' || scope === 'admin') && !req.isSuperAdmin) {
      filter.companyId = req.tenantId;
    } else if (req.isSuperAdmin && companyId && companyId !== 'all') {
      filter.companyId = companyId;
    } else {
      // Public candidate browsing
      if (companyId && companyId !== 'all') filter.companyId = companyId;
      if (companySlug) filter.companySlug = companySlug;
    }

    const allJobs = jobs.getAll(filter);
    res.json({
      total_jobs: allJobs.length,
      tenant_id: req.tenantId || null,
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
      proctoring: job.proctoring,
      preInterviewGate: job.preInterviewGate
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching job', error: error.message });
  }
});

// Create job (Admin only, tenant isolated)
router.post('/', verifyToken, requireAdmin, requireTenant, (req, res) => {
  try {
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
      proctoring_level,
      preInterviewGate,
      pre_interview_gate
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    // Strictly enforce tenant boundary: non-super-admins can ONLY create jobs for their tenant
    const targetCompanyId = req.isSuperAdmin && companyId ? companyId : req.tenantId;

    const resolvedProctoring = req.body.proctoring_config || proctoring || (proctoring_level ? { level: proctoring_level } : null);
    const resolvedPreGate = req.body.pre_interview_gate_config || preInterviewGate || pre_interview_gate || null;

    const newJob = jobs.create({
      title,
      description,
      mandatory_skills,
      optional_skills,
      certification_enabled,
      certification_weight,
      companyId: targetCompanyId,
      department,
      location,
      employmentType,
      experienceLevel,
      proctoring: resolvedProctoring,
      proctoring_level,
      preInterviewGate: resolvedPreGate
    });

    res.status(201).json({
      message: 'Job created successfully within tenant workspace',
      tenant_id: targetCompanyId,
      job_id: newJob.id,
      job: newJob
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating job', error: error.message });
  }
});

// Update job (Admin only, tenant isolated)
router.put('/:id', verifyToken, requireAdmin, requireTenant, (req, res) => {
  try {
    const existingJob = jobs.getById(req.params.id);
    if (!existingJob) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Cross-tenant protection
    if (!assertTenantAccess(req, res, existingJob.companyId, 'Job opening')) {
      return;
    }

    const payload = { ...req.body };
    if (payload.proctoring_config) {
      payload.proctoring = payload.proctoring_config;
    }

    // Do not allow reassigning job to another tenant unless super_admin
    if (!req.isSuperAdmin) {
      delete payload.companyId;
    }

    const updated = jobs.update(req.params.id, payload);
    res.json({
      message: 'Job updated successfully',
      job_id: updated.id,
      job: updated
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating job', error: error.message });
  }
});

// Delete job (Admin only, tenant isolated)
router.delete('/:id', verifyToken, requireAdmin, requireTenant, (req, res) => {
  try {
    const existingJob = jobs.getById(req.params.id);
    if (!existingJob) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Cross-tenant protection
    if (!assertTenantAccess(req, res, existingJob.companyId, 'Job opening')) {
      return;
    }

    jobs.delete(req.params.id);

    res.json({
      message: 'Job deleted successfully',
      deleted_job_id: req.params.id
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting job', error: error.message });
  }
});

module.exports = router;
