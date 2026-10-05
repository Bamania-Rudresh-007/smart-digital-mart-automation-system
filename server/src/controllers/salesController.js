const FefoService = require('../services/fefoService');
const { Sale, SaleItem, StockLedger, Product, Batch, User, Store } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const AuditService = require('../services/auditService');

class SalesController {
  static async checkout(req, res, next) {
    try {
      const storeId = req.targetStoreId || req.body.store_id || req.user.store_id;
      if (!storeId) return ApiResponse.error(res, 'Store ID is required', 400);

      const result = await FefoService.processSale({
        store_id: storeId,
        cashier_id: req.user.id,
        items: req.body.items,
        discount_amount: req.body.discount_amount || 0,
        tax_amount: req.body.tax_amount || 0,
        payment_mode: req.body.payment_mode || 'CASH'
      });

      await AuditService.logAction({
        userId: req.user.id,
        action: 'CREATE_SALE',
        tableName: 'sales',
        recordId: result.sale.id,
        newValue: { invoice_no: result.invoice_no, net_amount: result.net_amount }
      });

      return ApiResponse.success(res, 'Sale completed successfully', result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getSales(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = (page - 1) * limit;

      const where = {};
      if (req.targetStoreId) where.store_id = req.targetStoreId;

      const { count, rows } = await Sale.findAndCountAll({
        where,
        limit,
        offset,
        include: [
          { model: User, as: 'cashier', attributes: ['id', 'name', 'email'] },
          { model: Store, as: 'store' },
          { 
            model: SaleItem, 
            as: 'items', 
            include: [
              { model: Product, as: 'product' },
              { model: Batch, as: 'batch' }
            ] 
          }
        ],
        order: [['sale_date', 'DESC']]
      });

      return ApiResponse.paginated(res, 'Sales list', rows, page, limit, count);
    } catch (error) {
      next(error);
    }
  }

  static async getSaleById(req, res, next) {
    try {
      const sale = await Sale.findByPk(req.params.id, {
        include: [
          { model: User, as: 'cashier', attributes: ['id', 'name', 'email'] },
          { model: Store, as: 'store' },
          { 
            model: SaleItem, 
            as: 'items', 
            include: [
              { model: Product, as: 'product' },
              { model: Batch, as: 'batch' }
            ] 
          }
        ]
      });

      if (!sale) return ApiResponse.error(res, 'Sale invoice not found', 404);
      return ApiResponse.success(res, 'Sale invoice details', sale);
    } catch (error) {
      next(error);
    }
  }

  static async getStockLedger(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = (page - 1) * limit;

      const where = {};
      if (req.targetStoreId) where.store_id = req.targetStoreId;
      if (req.query.product_id) where.product_id = req.query.product_id;
      if (req.query.batch_id) where.batch_id = req.query.batch_id;
      if (req.query.txn_type) where.txn_type = req.query.txn_type;

      const { count, rows } = await StockLedger.findAndCountAll({
        where,
        limit,
        offset,
        include: [
          { model: Product, as: 'product' },
          { model: Batch, as: 'batch' },
          { model: Store, as: 'store' }
        ],
        order: [['createdAt', 'DESC']]
      });

      return ApiResponse.paginated(res, 'Stock ledger trail', rows, page, limit, count);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SalesController;
