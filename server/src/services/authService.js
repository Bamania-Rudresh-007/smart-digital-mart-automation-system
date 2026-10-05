const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Role, Store, RefreshToken, PasswordReset, sequelize } = require('../models');
const NotificationService = require('./notificationService');
const AuditService = require('./auditService');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_sdmas_access_token_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_sdmas_refresh_token_key_2026';

class AuthService {
  static generateAccessToken(user) {
    const roles = (user.roles || []).map(r => r.role_name);
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        store_id: user.store_id,
        roles
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
  }

  static async generateRefreshToken(user) {
    const refreshToken = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await RefreshToken.create({
      user_id: user.id,
      token: refreshToken,
      expires_at: expiresAt
    });

    return refreshToken;
  }

  static async register({ name, email, phone, password, store_id, requested_role }) {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('Email is already registered');
    }

    const countUsers = await User.count();
    const isFirstUser = countUsers === 0;

    const passwordHash = await bcrypt.hash(password, 10);
    const status = isFirstUser ? 'active' : 'pending';

    let assignedStoreId = store_id;
    if (!assignedStoreId) {
      const defaultStore = await Store.findOne();
      assignedStoreId = defaultStore ? defaultStore.id : null;
    }

    const user = await User.create({
      name,
      email,
      phone,
      password_hash: passwordHash,
      store_id: assignedStoreId,
      status
    });

    if (isFirstUser) {
      const superAdminRole = await Role.findOne({ where: { role_name: 'Super Admin' } });
      if (superAdminRole) {
        await user.addRole(superAdminRole);
      }
    } else {
      const roleToAssign = await Role.findOne({ where: { role_name: requested_role || 'Cashier' } });
      if (roleToAssign) {
        await user.addRole(roleToAssign);
      }
    }

    await AuditService.logAction({
      userId: user.id,
      action: 'REGISTER',
      tableName: 'users',
      recordId: user.id,
      newValue: { email: user.email, status, role: isFirstUser ? 'Super Admin' : requested_role }
    });

    return {
      user,
      isFirstUser,
      message: isFirstUser 
        ? 'Super Admin account created and activated successfully'
        : 'Registration submitted successfully. Your account is pending approval by a Store Manager/Admin.'
    };
  }

  static async login({ email, password }) {
    const user = await User.findOne({
      where: { email },
      include: [
        { model: Store, as: 'store' },
        { model: Role, as: 'roles' }
      ]
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    if (user.status === 'pending') {
      throw new Error('Your account registration is awaiting Store Manager approval.');
    }
    if (user.status === 'disabled') {
      throw new Error('Your account has been disabled. Please contact system administrator.');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    await AuditService.logAction({
      userId: user.id,
      action: 'LOGIN',
      tableName: 'users',
      recordId: user.id
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        store: user.store,
        roles: user.roles.map(r => r.role_name),
        status: user.status
      }
    };
  }

  static async refresh(refreshTokenStr) {
    let payload;
    try {
      payload = jwt.verify(refreshTokenStr, JWT_REFRESH_SECRET);
    } catch (err) {
      throw new Error('Invalid or expired refresh token');
    }

    const storedToken = await RefreshToken.findOne({
      where: { user_id: payload.id, token: refreshTokenStr }
    });

    if (!storedToken || new Date() > new Date(storedToken.expires_at)) {
      if (storedToken) await storedToken.destroy();
      throw new Error('Refresh token revoked or expired');
    }

    const user = await User.findByPk(payload.id, {
      include: [{ model: Store, as: 'store' }, { model: Role, as: 'roles' }]
    });

    if (!user || user.status !== 'active') {
      throw new Error('User inactive or suspended');
    }

    // Revoke old refresh token & issue new pair
    await storedToken.destroy();
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  static async forgotPassword(email) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Return success to avoid email enumeration
      return { message: 'If an account exists with that email, a reset token has been dispatched.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    await PasswordReset.create({
      user_id: user.id,
      token: resetToken,
      expires_at: expiresAt
    });

    await NotificationService.sendEmail({
      to: user.email,
      subject: 'SDMAS Password Reset Request',
      text: `You requested a password reset. Use this token: ${resetToken} to reset your password. It expires in 30 minutes.`
    });

    return { message: 'If an account exists with that email, a reset token has been dispatched.', devToken: resetToken };
  }

  static async resetPassword({ token, new_password }) {
    const resetEntry = await PasswordReset.findOne({
      where: { token, used: false }
    });

    if (!resetEntry || new Date() > new Date(resetEntry.expires_at)) {
      throw new Error('Invalid or expired reset token');
    }

    const user = await User.findByPk(resetEntry.user_id);
    if (!user) {
      throw new Error('User not found');
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    await user.save();

    resetEntry.used = true;
    await resetEntry.save();

    await AuditService.logAction({
      userId: user.id,
      action: 'PASSWORD_RESET',
      tableName: 'users',
      recordId: user.id
    });

    return { message: 'Password reset successfully. You can now log in.' };
  }
}

module.exports = AuthService;
