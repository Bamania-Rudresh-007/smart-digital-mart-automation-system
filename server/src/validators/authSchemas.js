const Joi = require('joi');

const registerSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  email: Joi.string().email().required().trim(),
  phone: Joi.string().optional().allow('', null),
  password: Joi.string().min(6).required(),
  store_id: Joi.number().integer().optional().allow(null),
  requested_role: Joi.string().optional().default('Cashier')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().trim(),
  password: Joi.string().required(),
  remember_me: Joi.boolean().optional().default(false)
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().trim()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  new_password: Joi.string().min(6).required()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema
};
