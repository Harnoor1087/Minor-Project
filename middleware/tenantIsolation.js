const jwt = require('jsonwebtoken');
const { users, companies } = require('../db/store');

const JWT_SECRET = process.env.JWT_SECRET || 'airis_secret_jwt_key_2026';

/**
 * Verify JWT token and attach user to request
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session token.' });
  }
}

/**
 * Require admin or super_admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied. Recruiter or Administrator privilege required.'
    });
  }
  next();
}

/**
 * Resolve and enforce B2B tenant context for recruiter/admin requests
 */
function requireTenant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Applicants do not have a companyId constraint for applicant-specific actions
  if (req.user.role === 'applicant') {
    return next();
  }

  const dbUser = users.findById(req.user.id) || users.findByEmail(req.user.email);
  const userCompanyId = dbUser?.companyId || req.user.companyId;

  // Super admin can explicitly request another tenant via header or query if authorized
  if (req.user.role === 'super_admin') {
    const requestedTenant = req.headers['x-tenant-id'] || req.query.companyId;
    if (requestedTenant && requestedTenant !== 'all') {
      const targetComp = companies.getById(requestedTenant) || companies.getBySlug(requestedTenant);
      if (targetComp) {
        req.tenantId = targetComp.id;
        req.tenant = targetComp;
        req.isSuperAdmin = true;
        return next();
      }
    }
    // Default super admin to user company or all
    req.tenantId = userCompanyId || 'comp_airis';
    req.tenant = companies.getById(req.tenantId) || { id: req.tenantId, name: 'Platform Admin' };
    req.isSuperAdmin = true;
    return next();
  }

  // Normal admin / recruiter is strictly bound to their tenant
  if (!userCompanyId) {
    return res.status(403).json({
      error: 'TENANT_UNASSIGNED',
      message: 'Your account is not assigned to an active organization tenant. Please contact support.'
    });
  }

  const company = companies.getById(userCompanyId);
  if (!company) {
    return res.status(403).json({
      error: 'TENANT_NOT_FOUND',
      message: `Assigned organization tenant "${userCompanyId}" does not exist.`
    });
  }

  req.tenantId = company.id;
  req.tenant = company;
  req.isSuperAdmin = false;
  next();
}

/**
 * Helper to assert that a given resource belongs to the current tenant
 */
function assertTenantAccess(req, res, resourceCompanyId, resourceType = 'Resource') {
  if (req.user?.role === 'super_admin') {
    return true;
  }

  if (!req.tenantId) {
    res.status(403).json({
      error: 'TENANT_CONTEXT_MISSING',
      message: 'Tenant context is missing for this operation.'
    });
    return false;
  }

  if (resourceCompanyId !== req.tenantId) {
    res.status(403).json({
      error: 'CROSS_TENANT_ACCESS_DENIED',
      message: `Tenant Isolation Violation: This ${resourceType} belongs to another organization. Cross-tenant access is strictly prohibited.`,
      tenantId: req.tenantId
    });
    return false;
  }

  return true;
}

module.exports = {
  verifyToken,
  requireAdmin,
  requireTenant,
  assertTenantAccess,
  JWT_SECRET
};
