const { PurchaseOrder, POItem, GoodsReceipt, GRNItem, VendorInvoice, InvoiceItem, PurchaseMatch, Supplier, Product, Batch, StockLedger, User } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const MatchingEngine = require('../services/matchingEngine');
const AuditService = require('../services/auditService');

class PurchaseController {
  // --- PURCHASE ORDERS ---
  static async getPurchaseOrders(req, res, next) {
    try {
      const where = {};
      if (req.targetStoreId) where.store_id = req.targetStoreId;

      const pos = await PurchaseOrder.findAll({
        where,
        include: [
          { model: Supplier, as: 'supplier' },
          { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
          { model: POItem, as: 'items', include: [{ model: Product, as: 'product' }] },
          { model: PurchaseMatch, as: 'match' }
        ],
        order: [['createdAt', 'DESC']]
      });

      return ApiResponse.success(res, 'Purchase orders list', pos);
    } catch (error) {
      next(error);
    }
  }

  static async getPOById(req, res, next) {
    try {
      const po = await PurchaseOrder.findByPk(req.params.id, {
        include: [
          { model: Supplier, as: 'supplier' },
          { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
          { model: POItem, as: 'items', include: [{ model: Product, as: 'product' }] },
          { model: GoodsReceipt, as: 'goodsReceipts', include: [{ model: GRNItem, as: 'items', include: [{ model: Product, as: 'product' }] }] },
          { model: VendorInvoice, as: 'vendorInvoices', include: [{ model: InvoiceItem, as: 'items', include: [{ model: Product, as: 'product' }] }] },
          { model: PurchaseMatch, as: 'match' }
        ]
      });

      if (!po) return ApiResponse.error(res, 'Purchase Order not found', 404);
      return ApiResponse.success(res, 'Purchase Order details', po);
    } catch (error) {
      next(error);
    }
  }

  static async createPO(req, res, next) {
    try {
      const storeId = req.targetStoreId || req.body.store_id;
      if (!storeId) return ApiResponse.error(res, 'Store ID is required', 400);

      const poNumber = `PO-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const po = await PurchaseOrder.create({
        po_number: poNumber,
        supplier_id: req.body.supplier_id,
        store_id: storeId,
        status: 'Draft',
        created_by: req.user.id
      });

      for (const item of req.body.items) {
        await POItem.create({
          po_id: po.id,
          product_id: item.product_id,
          ordered_qty: item.ordered_qty,
          agreed_unit_price: item.agreed_unit_price
        });
      }

      await AuditService.logAction({
        userId: req.user.id,
        action: 'CREATE',
        tableName: 'purchase_orders',
        recordId: po.id,
        newValue: po.toJSON()
      });

      return ApiResponse.success(res, 'Purchase Order created in Draft state', po, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updatePOStatus(req, res, next) {
    try {
      const { status } = req.body;
      const po = await PurchaseOrder.findByPk(req.params.id);
      if (!po) return ApiResponse.error(res, 'Purchase Order not found', 404);

      // Valid state transitions
      const validTransitions = {
        'Draft': ['Sent', 'Rejected'],
        'Sent': ['Partially Received', 'Fully Received', 'Rejected'],
        'Partially Received': ['Fully Received', 'Discrepancy'],
        'Fully Received': ['Matched', 'Discrepancy'],
        'Discrepancy': ['Approved', 'Rejected'],
        'Matched': ['Approved']
      };

      const allowed = validTransitions[po.status] || [];
      if (!allowed.includes(status)) {
        return ApiResponse.error(res, `Invalid PO status transition from '${po.status}' to '${status}'`, 400);
      }

      po.status = status;
      await po.save();

      return ApiResponse.success(res, `PO status updated to ${status}`, po);
    } catch (error) {
      next(error);
    }
  }

  // --- GOODS RECEIPT NOTE (GRN) ---
  static async createGRN(req, res, next) {
    try {
      const { po_id, items } = req.body;
      const po = await PurchaseOrder.findByPk(po_id);
      if (!po) return ApiResponse.error(res, 'Purchase Order not found', 404);

      const grnNumber = `GRN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const grn = await GoodsReceipt.create({
        grn_number: grnNumber,
        po_id,
        received_by: req.user.id,
        received_date: new Date()
      });

      for (const item of items) {
        // Create batch for received product
        const today = new Date();
        const expDate = new Date(item.expiry_date);
        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        let expiry_status = 'Healthy';
        if (diffDays <= 0) expiry_status = 'Expired';
        else if (diffDays <= 30) expiry_status = 'Near Expiry';

        const batch = await Batch.create({
          product_id: item.product_id,
          batch_number: item.batch_number,
          mfg_date: item.mfg_date || null,
          expiry_date: item.expiry_date,
          purchase_price: item.purchase_price,
          selling_price: item.selling_price,
          qty_received: item.received_qty,
          qty_remaining: item.received_qty,
          supplier_id: po.supplier_id,
          expiry_status
        });

        await GRNItem.create({
          grn_id: grn.id,
          product_id: item.product_id,
          batch_id: batch.id,
          received_qty: item.received_qty
        });

        // Write immutable stock ledger
        await StockLedger.create({
          product_id: item.product_id,
          batch_id: batch.id,
          store_id: po.store_id,
          txn_type: 'purchase',
          qty: item.received_qty,
          balance_after: batch.qty_remaining,
          ref_id: grnNumber,
          notes: `GRN Entry for PO ${po.po_number}`
        });
      }

      po.status = 'Fully Received';
      await po.save();

      // Trigger 3-Way Match Check
      const matchResult = await MatchingEngine.validateThreeWayMatch(po_id);

      return ApiResponse.success(res, 'GRN submitted and stock ledger updated', { grn, matchResult }, 201);
    } catch (error) {
      next(error);
    }
  }

  // --- VENDOR INVOICE ENTRY ---
  static async createVendorInvoice(req, res, next) {
    try {
      const { po_id, invoice_number, invoice_amount, invoice_date, items } = req.body;
      const po = await PurchaseOrder.findByPk(po_id);
      if (!po) return ApiResponse.error(res, 'Purchase Order not found', 404);

      const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

      const invoice = await VendorInvoice.create({
        po_id,
        invoice_number,
        invoice_amount,
        invoice_date,
        file_url: fileUrl
      });

      for (const item of items) {
        await InvoiceItem.create({
          invoice_id: invoice.id,
          product_id: item.product_id,
          billed_qty: item.billed_qty,
          billed_unit_price: item.billed_unit_price
        });
      }

      // Trigger 3-Way Match Check
      const matchResult = await MatchingEngine.validateThreeWayMatch(po_id);

      return ApiResponse.success(res, 'Vendor invoice logged and 3-Way match evaluated', { invoice, matchResult }, 201);
    } catch (error) {
      next(error);
    }
  }

  // --- DISCREPANCY OVERRIDE ---
  static async overrideDiscrepancy(req, res, next) {
    try {
      const { po_id, remarks } = req.body;
      const result = await MatchingEngine.overrideDiscrepancy(po_id, req.user.id, remarks);
      
      await AuditService.logAction({
        userId: req.user.id,
        action: 'OVERRIDE_DISCREPANCY',
        tableName: 'purchase_orders',
        recordId: po_id,
        newValue: { remarks, manager_id: req.user.id }
      });

      return ApiResponse.success(res, 'Discrepancy successfully overridden by manager', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PurchaseController;
