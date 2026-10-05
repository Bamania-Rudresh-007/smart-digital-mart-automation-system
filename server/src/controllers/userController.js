const { User, Role, Permission, Store } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const AuditService = require('../services/auditService');

class UserController {
  static async getUsers(req, res, next) {
    try {
      const where = {};
      if (req.targetStoreId) where.store_id = req.targetStoreId;
      if (req.query.status) where.status = req.query.status;

      const users = await User.findAll({
        where,
        attributes: { exclude: ['password_hash'] },
        include: [
          { model: Store, as: 'store' },
          { model: Role, as: 'roles', include: [{ model: Permission, as: 'permissions' }] }
        ],
        order: [['createdAt', 'DESC']]
      });

      return ApiResponse.success(res, 'Users list', users);
    } catch (error) {
      next(error);
    }
  }

  static async updateUserStatus(req, res, next) {
    try {
      const { status } = req.body;
      const user = await User.findByPk(req.params.id);
      if (!user) return ApiResponse.error(res, 'User not found', 404);

      const oldStatus = user.status;
      user.status = status;
      await user.save();

      await AuditService.logAction({
        userId: req.user.id,
        action: 'UPDATE_USER_STATUS',
        tableName: 'users',
        recordId: user.id,
        oldValue: { status: oldStatus },
        newValue: { status }
      });

      return ApiResponse.success(res, `User account ${status === 'active' ? 'approved & activated' : status}`, user);
    } catch (error) {
      next(error);
    }
  }

  static async getRoles(req, res, next) {
    try {
      const roles = await Role.findAll({
        include: [{ model: Permission, as: 'permissions' }]
      });
      return ApiResponse.success(res, 'Roles list', roles);
    } catch (error) {
      next(error);
    }
  }

  static async getPermissions(req, res, next) {
    try {
      const permissions = await Permission.findAll();
      return ApiResponse.success(res, 'Permissions list', permissions);
    } catch (error) {
      next(error);
    }
  }

  static async createRole(req, res, next) {
    try {
      const { role_name, description, permission_ids } = req.body;
      
      const role = await Role.create({
        role_name,
        description,
        is_custom: true
      });

      if (permission_ids && permission_ids.length > 0) {
        await role.setPermissions(permission_ids);
      }

      await AuditService.logAction({
        userId: req.user.id,
        action: 'CREATE_ROLE',
        tableName: 'roles',
        recordId: role.id,
        newValue: { role_name, permission_ids }
      });

      return ApiResponse.success(res, 'Custom Role created', role, 201);
    } catch (error) {
      next(error);
    }
  }

  static async assignRoleToUser(req, res, next) {
    try {
      const { role_ids } = req.body;
      const user = await User.findByPk(req.params.id);
      if (!user) return ApiResponse.error(res, 'User not found', 404);

      await user.setRoles(role_ids);

      await AuditService.logAction({
        userId: req.user.id,
        action: 'ASSIGN_ROLES',
        tableName: 'user_roles',
        recordId: user.id,
        newValue: { role_ids }
      });

      return ApiResponse.success(res, 'Roles assigned to user successfully', user);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
