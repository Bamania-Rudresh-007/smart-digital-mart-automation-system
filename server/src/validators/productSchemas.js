const Joi = require('joi');

const productSchema = Joi.object({
  sku: Joi.string().optional().trim().allow(''),
  name: Joi.string().required().trim(),
  category_id: Joi.number().integer().required(),
  unit_of_measure_id: Joi.number().integer().optional().allow(null),
  reorder_threshold: Joi.number().integer().min(0).default(10),
  max_stock_level: Joi.number().integer().min(1).default(100),
  store_id: Joi.number().integer().optional(),
  initial_batch: Joi.object({
    batch_number: Joi.string().trim().allow(''),
    mfg_date: Joi.date().max(Joi.ref('expiry_date')).optional().allow(null),
    expiry_date: Joi.date().required(),
    purchase_price: Joi.number().precision(2).positive().required(),
    selling_price: Joi.number().precision(2).positive().required(),
    qty_received: Joi.number().integer().positive().required(),
    supplier_id: Joi.number().integer().optional().allow(null)
  }).optional().allow(null)
});

const categorySchema = Joi.object({
  name: Joi.string().required().trim(),
  parent_category_id: Joi.number().integer().optional().allow(null)
});

const batchSchema = Joi.object({
  product_id: Joi.number().integer().required(),
  batch_number: Joi.string().required().trim(),
  mfg_date: Joi.date().optional().allow(null),
  expiry_date: Joi.date().required(),
  purchase_price: Joi.number().precision(2).positive().required(),
  selling_price: Joi.number().precision(2).positive().required(),
  qty_received: Joi.number().integer().positive().required(),
  supplier_id: Joi.number().integer().optional().allow(null)
});

const supplierSchema = Joi.object({
  name: Joi.string().required().trim(),
  contact: Joi.string().optional().allow('', null),
  email: Joi.string().email().optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  gst_no: Joi.string().optional().allow('', null)
});

module.exports = {
  productSchema,
  categorySchema,
  batchSchema,
  supplierSchema
};
