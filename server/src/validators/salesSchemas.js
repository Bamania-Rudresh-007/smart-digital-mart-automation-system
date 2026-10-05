const Joi = require('joi');

const checkoutSchema = Joi.object({
  store_id: Joi.number().integer().optional(),
  discount_amount: Joi.number().precision(2).min(0).default(0),
  tax_amount: Joi.number().precision(2).min(0).default(0),
  payment_mode: Joi.string().valid('CASH', 'CARD', 'UPI', 'MIXED').default('CASH'),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().required(),
      qty: Joi.number().integer().positive().required(),
      unit_selling_price: Joi.number().precision(2).positive().required()
    })
  ).min(1).required()
});

module.exports = { checkoutSchema };
