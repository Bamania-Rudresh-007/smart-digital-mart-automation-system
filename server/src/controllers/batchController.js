const { Batch, Product, Supplier, StockLedger } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const AuditService = require('../services/auditService');
const ExpiryEngine = require('../services/expiryEngine');
const { Op } = require('sequelize');

class BatchController {
  static async getBatches(req, res, next) {
    try {
      const { product_id, status } = req.query;
      const where = {};
      if (product_id) where.product_id = product_id;
      if (status) where.expiry_status = status;

      const batches = await Batch.findAll({
        where,
        include: [
          { model: Product, as: 'product' },
          { model: Supplier, as: 'supplier' }
        ],
        order: [['expiry_date', 'ASC']]
      });

      return ApiResponse.success(res, 'Batches list fetched', batches);
    } catch (error) {
      next(error);
    }
  }

  static async createBatch(req, res, next) {
    try {
      const product = await Product.findByPk(req.body.product_id);
      if (!product) return ApiResponse.error(res, 'Product not found', 404);

      const today = new Date();
      const expDate = new Date(req.body.expiry_date);
      let expiry_status = 'Healthy';
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) expiry_status = 'Expired';
      else if (diffDays <= 30) expiry_status = 'Near Expiry';

      const batch = await Batch.create({
        ...req.body,
        qty_remaining: req.body.qty_received,
        expiry_status
      });

      // Stock Ledger initial entry
      await StockLedger.create({
        product_id: product.id,
        batch_id: batch.id,
        store_id: product.store_id,
        txn_type: 'purchase',
        qty: batch.qty_received,
        balance_after: batch.qty_received,
        ref_id: `MANUAL-BATCH-${batch.id}`,
        notes: 'Manual batch creation'
      });

      await AuditService.logAction({
        userId: req.user.id,
        action: 'CREATE',
        tableName: 'batches',
        recordId: batch.id,
        newValue: batch.toJSON()
      });

      return ApiResponse.success(res, 'Batch created successfully', batch, 201);
    } catch (error) {
      next(error);
    }
  }

  static async triggerExpiryScan(req, res, next) {
    try {
      const scanResult = await ExpiryEngine.scanBatchExpiries();
      return ApiResponse.success(res, 'Batch expiry scan completed', scanResult);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BatchController;
