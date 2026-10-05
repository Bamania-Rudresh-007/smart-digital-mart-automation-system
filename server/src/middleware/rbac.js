const ApiResponse = require('../utils/apiResponse');

const requirePermission = (moduleName, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(res, 'Unauthenticated user', 401);
    }

    const userRoles = req.user.roles || [];
    const isSuperAdmin = userRoles.some(r => r.role_name === 'Super Admin');
    
    if (isSuperAdmin) {
      return next();
    }

    let hasPermission = false;
    for (const role of userRoles) {
      const permissions = role.permissions || [];
      const match = permissions.some(p => p.module === moduleName && (p.action === action || p.action === 'all'));
      if (match) {
        hasPermission = true;
        break;
      }
    }

    if (!hasPermission) {
      return ApiResponse.error(res, `Forbidden: You lack permission to perform '${action}' on '${moduleName}'`, 403);
    }

    next();
  };
};

const enforceStoreScope = (req, res, next) => {
  if (!req.user) return next();
  const isSuperAdmin = (req.user.roles || []).some(r => r.role_name === 'Super Admin');
  
  if (isSuperAdmin) {
    // Super Admin can filter by store_id from query/body or access all
    req.targetStoreId = req.query.store_id || req.body.store_id || null;
  } else {
    // Non-Super Admin is strictly bound to their assigned store
    req.targetStoreId = req.user.store_id;
  }
  next();
};

module.exports = { requirePermission, enforceStoreScope };
