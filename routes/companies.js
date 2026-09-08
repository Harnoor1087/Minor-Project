const express = require('express');
const router = express.Router();
const { companies, jobs, users } = require('../db/store');
const { verifyToken } = require('./auth');

// Get all companies with active job counts
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

// Get authenticated recruiter's company workspace
router.get('/me/workspace', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Recruiter/Admin only.' });
    }

    const user = users.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let comp = null;
    if (user.companyId) {
      comp = companies.getById(user.companyId);
    }
    if (!comp && user.company) {
      comp = companies.getBySlug(user.company.toLowerCase().replace(/[^a-z0-9]/g, '-')) ||
             companies.getAll().find(c => c.name.toLowerCase() === user.company.toLowerCase());
    }
    if (!comp) {
      comp = companies.getById('comp_airis');
    }

    const companyJobs = jobs.getAll({ companyId: comp.id });
    res.json({
      company: comp,
      jobs: companyJobs
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching company workspace', error: err.message });
  }
});

// Update authenticated recruiter's company workspace
router.put('/me/workspace', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Recruiter/Admin only.' });
    }

    const user = users.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetCompanyId = user.companyId || 'comp_airis';
    const updated = companies.update(targetCompanyId, req.body);

    if (!updated) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json({
      message: 'Company workspace updated successfully',
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
