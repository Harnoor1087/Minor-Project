const express = require('express');
const router = express.Router();
const { companies, jobs, users } = require('../db/store');
const { verifyToken, requireAdmin, requireTenant, assertTenantAccess } = require('../middleware/tenantIsolation');

// Get all companies with active job counts (or current company if non-superadmin recruiter)
router.get('/', (req, res) => {
  try {
    const list = companies.getAll();
    res.json({
      total: list.length,
      companies: list
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching companies', error: err.message });
  }
});

// Get authenticated recruiter's company workspace (Tenant Isolated)
router.get('/me/workspace', verifyToken, requireAdmin, requireTenant, (req, res) => {
  try {
    const comp = req.tenant;
    const companyJobs = jobs.getAll({ companyId: comp.id });
    res.json({
      tenantId: comp.id,
      company: comp,
      jobs: companyJobs,
      isSuperAdmin: req.isSuperAdmin || false
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching company workspace', error: err.message });
  }
});

// Update authenticated recruiter's company workspace (Tenant Isolated)
router.put('/me/workspace', verifyToken, requireAdmin, requireTenant, (req, res) => {
  try {
    const targetCompanyId = req.tenantId;
    const updated = companies.update(targetCompanyId, req.body);

    if (!updated) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json({
      message: 'Company workspace updated successfully',
      tenantId: targetCompanyId,
      company: updated
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating company workspace', error: err.message });
  }
});

// Get company profile by slug or ID with its open jobs
router.get('/:slugOrId', (req, res) => {
  try {
    const { slugOrId } = req.params;
    let comp = companies.getBySlug(slugOrId);
    if (!comp) {
      comp = companies.getById(slugOrId);
    }

    if (!comp) {
      return res.status(404).json({ message: `Company "${slugOrId}" not found` });
    }

    const companyJobs = jobs.getAll({ companyId: comp.id });

    res.json({
      company: comp,
      total_jobs: companyJobs.length,
      jobs: companyJobs
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching company', error: err.message });
  }
});

// Create a new company workspace
router.post('/', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { name, industry, website, location, tagline, description, logo } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Company name is required' });
    }

    const newCompany = companies.create({
      name,
      industry,
      website,
      location,
      tagline,
      description,
      logo
    });

    res.status(201).json({
      message: 'Company workspace created successfully',
      company: newCompany
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating company', error: err.message });
  }
});

module.exports = router;
