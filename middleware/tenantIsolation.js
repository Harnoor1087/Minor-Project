const jwt = require('jsonwebtoken');
const { users, companies } = require('../db/store');

const JWT_SECRET = process.env.JWT_SECRET || 'airis_secret_jwt_key_2026';

/**
 * Role Permission Matrix
 */
const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'manage_jobs',
    'view_applications',
    'review_candidates',
    'issue_offers',
    'manage_team',
    'manage_company',
    'view_audit_logs',
    'purge_data'
  ],
  recruiter: [
    'manage_jobs',
    'view_applications',
    'review_candidates',
    'view_audit_logs'
  ],
  hiring_manager: [
    'view_applications',
    'review_candidates'
  ],
  applicant: [
    'apply',
    'take_assessment',
    'view_own_applications',
    'edit_profile'
  ]
};

/**
 * Verify JWT token from HttpOnly Cookie or Authorization Header and attach user to request
 */
function verifyToken(req, res, next) {
  // Check HttpOnly cookie first, fallback to Authorization header
  let token = req.cookies?.airis_access_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (authHeader) {
      token = authHeader;
    }
  }

  if (!token) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Authentication required. No session token provided in cookie or header.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'TOKEN_INVALID_OR_EXPIRED',
      message: 'Invalid or expired session token. Please re-authenticate.'
    });
  }
}

/**
 * Granular Role Check Middleware
 * @param {string|string[]} allowedRoles - Role or array of allowed roles
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
    }

    if (req.user.role === 'super_admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN_ROLE',
        message: `Access denied. Requires one of roles: [${roles.join(', ')}]. Current role: "${req.user.role}".`
      });
    }
    next();
  };
}

/**
 * Granular Permission Check Middleware
 * @param {string} permission - Required permission string
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
    }

    const role = req.user.role || 'applicant';
    const permissions = ROLE_PERMISSIONS[role] || [];

    if (permissions.includes('*') || permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: `Access denied. You do not possess the "${permission}" permission.`,
      requiredPermission: permission,
      userRole: role
    });
  };
}

/**
 * Require admin or super_admin role (backward-compatible)
 */
function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'recruiter')) {
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
  requireRole,
  requirePermission,
  requireTenant,
  assertTenantAccess,
  ROLE_PERMISSIONS,
  JWT_SECRET
};
