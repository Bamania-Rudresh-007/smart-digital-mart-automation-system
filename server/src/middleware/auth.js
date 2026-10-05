const jwt = require('jsonwebtoken');
const { User, Role, Permission, Store } = require('../models');
const ApiResponse = require('../utils/apiResponse');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 'Authentication token missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_sdmas_access_token_key_2026');

    const user = await User.findByPk(decoded.id, {
      include: [
        { model: Store, as: 'store' },
        { 
          model: Role, 
          as: 'roles', 
          include: [{ model: Permission, as: 'permissions' }] 
        }
      ]
    });

    if (!user) {
      return ApiResponse.error(res, 'User no longer exists', 401);
    }

    if (user.status !== 'active') {
      return ApiResponse.error(res, `Account is currently ${user.status}. Please contact system administrator.`, 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 'Access token expired', 401);
    }
    return ApiResponse.error(res, 'Invalid authentication token', 401);
  }
};

module.exports = { authenticate };
