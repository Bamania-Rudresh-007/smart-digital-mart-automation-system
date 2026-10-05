const AuthService = require('../services/authService');
const ApiResponse = require('../utils/apiResponse');
const { User, Role, Store } = require('../models');

class AuthController {
  static async register(req, res, next) {
    try {
      const result = await AuthService.register(req.body);
      return ApiResponse.success(res, result.message, result.user, 201);
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const result = await AuthService.login(req.body);
      return ApiResponse.success(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.refresh(refreshToken);
      return ApiResponse.success(res, 'Token refreshed successfully', result);
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await AuthService.forgotPassword(email);
      return ApiResponse.success(res, result.message, { devToken: result.devToken });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const result = await AuthService.resetPassword(req.body);
      return ApiResponse.success(res, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password_hash'] },
        include: [
          { model: Store, as: 'store' },
          { model: Role, as: 'roles' }
        ]
      });
      return ApiResponse.success(res, 'Profile retrieved', user);
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const { name, phone } = req.body;
      const user = await User.findByPk(req.user.id);
      if (name) user.name = name;
      if (phone) user.phone = phone;
      await user.save();
      return ApiResponse.success(res, 'Profile updated successfully', user);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
