const Joi = require('joi');

const poSchema = Joi.object({
  supplier_id: Joi.number().integer().required(),
  store_id: Joi.number().integer().optional(),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().required(),
      ordered_qty: Joi.number().integer().positive().required(),
      agreed_unit_price: Joi.number().precision(2).positive().required()
    })
  ).min(1).required()
});

const grnSchema = Joi.object({
  po_id: Joi.number().integer().required(),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().required(),
      batch_number: Joi.string().required(),
      mfg_date: Joi.date().optional().allow(null),
      expiry_date: Joi.date().required(),
      received_qty: Joi.number().integer().positive().required(),
      purchase_price: Joi.number().precision(2).positive().required(),
      selling_price: Joi.number().precision(2).positive().required()
    })
  ).min(1).required()
});

const vendorInvoiceSchema = Joi.object({
  po_id: Joi.number().integer().required(),
  invoice_number: Joi.string().required(),
  invoice_amount: Joi.number().precision(2).positive().required(),
  invoice_date: Joi.date().required(),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().required(),
      billed_qty: Joi.number().integer().positive().required(),
      billed_unit_price: Joi.number().precision(2).positive().required()
    })
  ).min(1).required()
});

const overrideSchema = Joi.object({
  po_id: Joi.number().integer().required(),
  remarks: Joi.string().required().min(5)
});

const quantityResolutionSchema = Joi.object({
  po_id: Joi.number().integer().required(),
  remarks: Joi.string().required().min(5)
});

module.exports = {
  poSchema,
  grnSchema,
  vendorInvoiceSchema,
  overrideSchema,
  quantityResolutionSchema
};
