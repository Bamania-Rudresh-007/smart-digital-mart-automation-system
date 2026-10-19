import { sequelize, PurchaseOrder, POItem, GoodsReceipt, GRNItem, VendorInvoice, InvoiceItem, PurchaseMatch, Supplier, Product, Batch, StockLedger, User } from '../models/index.js';
import ApiResponse from '../utils/apiResponse.js';
import MatchingEngine from '../services/matchingEngine.js';
import { validatePdfThreeWayMatch } from '../services/pdfThreeWayMatcher.js';
import { createPurchaseOrderPdf, createValidationSamplePdf } from '../services/purchaseOrderPdf.js';
import ExpiryEngine from '../services/expiryEngine.js';
import AuditService from '../services/auditService.js';

class PurchaseController {
  // --- PURCHASE ORDERS ---
  static async validateDocuments(req, res, next) {
    let transaction;
    try {
      const files = req.files || {};
      const goodsReceiptNoteFile = files.goods_receipt_note?.[0];
      const supplierInvoiceFile = files.supplier_invoice?.[0];
      if (!goodsReceiptNoteFile || !supplierInvoiceFile) {
        return ApiResponse.error(
          res,
          'Upload one PDF each for the goods receipt note and supplier invoice.',
          400
        );
      }

      const po = await PurchaseOrder.findByPk(req.params.id, {
        include: [{ model: POItem, as: 'items' }]
      });
      if (!po || (req.targetStoreId && Number(po.store_id) !== Number(req.targetStoreId))) {
        return ApiResponse.error(res, 'Purchase Order not found', 404);
      }

      const quantity = po.items.reduce((sum, item) => sum + Number(item.ordered_qty), 0);
      const totalAmount = po.items.reduce(
        (sum, item) => sum + Number(item.ordered_qty) * Number(item.agreed_unit_price),
        0
      );
      if (!quantity || !totalAmount) {
        return ApiResponse.error(res, 'Purchase Order has no valid items to match against.', 400);
      }

      const result = await validatePdfThreeWayMatch({
        expectedPoNumber: po.po_number,
        purchaseOrderValues: {
          quantity,
          unitPrice: totalAmount / quantity,
          totalAmount
        },
        goodsReceiptNote: goodsReceiptNoteFile.buffer,
        supplierInvoice: supplierInvoiceFile.buffer
      });

      transaction = await sequelize.transaction();
      let matchRecord = await PurchaseMatch.findOne({
        where: { po_id: po.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (matchRecord) {
        await matchRecord.update({
          match_status: result.match_status,
          remarks: result.remarks,
          resolved_by: null
        }, { transaction });
      } else {
        matchRecord = await PurchaseMatch.create({
          po_id: po.id,
          match_status: result.match_status,
          remarks: result.remarks,
          resolved_by: null
        }, { transaction });
      }

      const previousStatus = po.status;
      po.status = result.match_status === 'Matched' ? 'Approved' : 'Discrepancy';
      await po.save({ transaction });
      await transaction.commit();

      await AuditService.logAction({
        userId: req.user.id,
        action: 'VALIDATE_PURCHASE_DOCUMENTS',
        tableName: 'purchase_orders',
        recordId: po.id,
        oldValue: { status: previousStatus },
        newValue: { status: po.status, match_status: result.match_status, remarks: result.remarks }
      });

      return ApiResponse.success(res, 'PDF 3-Way Match completed', {
        ...result,
        po_id: po.id,
        po_number: po.po_number
      });
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      next(error);
    }
  }

  static async downloadPurchaseOrderPdf(req, res, next) {
    try {
      const po = await PurchaseOrder.findByPk(req.params.id, {
        include: [
          { model: Supplier, as: 'supplier' },
          { model: POItem, as: 'items', include: [{ model: Product, as: 'product' }] }
        ]
      });
      if (!po || (req.targetStoreId && Number(po.store_id) !== Number(req.targetStoreId))) {
        return ApiResponse.error(res, 'Purchase Order not found', 404);
      }

      const pdf = await createPurchaseOrderPdf(po);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${po.po_number}.pdf"`);
      return res.send(pdf);
    } catch (error) {
      next(error);
    }
  }

  static async downloadValidationSample(req, res, next) {
    try {
      const { documentType, scenario } = req.params;
      if (!['grn', 'invoice'].includes(documentType) || !['matching', 'mismatch'].includes(scenario)) {
        return ApiResponse.error(res, 'Unsupported validation sample requested.', 400);
      }

      const po = await PurchaseOrder.findByPk(req.params.id, {
        include: [{ model: POItem, as: 'items' }]
      });
      if (!po || (req.targetStoreId && Number(po.store_id) !== Number(req.targetStoreId))) {
        return ApiResponse.error(res, 'Purchase Order not found', 404);
      }

      const pdf = await createValidationSamplePdf(
        po,
        documentType,
        scenario === 'matching' ? 'matching' : 'mismatch'
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${po.po_number}-${documentType}-${scenario}.pdf"`
      );
      return res.send(pdf);
    } catch (error) {
      next(error);
    }
  }

  static async deletePurchaseOrder(req, res, next) {
    let transaction;
    try {
      transaction = await sequelize.transaction();
      const po = await PurchaseOrder.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!po || (req.targetStoreId && Number(po.store_id) !== Number(req.targetStoreId))) {
        await transaction.rollback();
        return ApiResponse.error(res, 'Purchase Order not found', 404);
      }
      if (!['Draft', 'Rejected'].includes(po.status)) {
        await transaction.rollback();
        return ApiResponse.error(res, 'Only Draft or Rejected purchase orders can be deleted.', 409);
      }

      const [receiptCount, invoiceCount] = await Promise.all([
        GoodsReceipt.count({ where: { po_id: po.id }, transaction }),
        VendorInvoice.count({ where: { po_id: po.id }, transaction })
      ]);
      if (receiptCount || invoiceCount) {
        await transaction.rollback();
        return ApiResponse.error(
          res,
          'This purchase order has linked receiving or invoice records and cannot be deleted.',
          409
        );
      }

      await PurchaseMatch.destroy({ where: { po_id: po.id }, transaction });
      await POItem.destroy({ where: { po_id: po.id }, transaction });
      await po.destroy({ transaction });
      await transaction.commit();

      await AuditService.logAction({
        userId: req.user.id,
        action: 'DELETE',
        tableName: 'purchase_orders',
        recordId: po.id,
        oldValue: { po_number: po.po_number, status: po.status }
      });

      return ApiResponse.success(res, 'Purchase Order deleted.');
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      next(error);
    }
  }

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
          { model: GoodsReceipt, as: 'goodsReceipts', include: [{ model: GRNItem, as: 'items' }] },
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
      const storeId = req.targetStoreId || req.body.store_id || req.user.store_id;
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
    let transaction;
    try {
      transaction = await sequelize.transaction();
      const { po_id, items } = req.body;
      const po = await PurchaseOrder.findByPk(po_id, { transaction });
      if (!po) {
        await transaction.rollback();
        return ApiResponse.error(res, 'Purchase Order not found', 404);
      }
      if (!['Sent', 'Partially Received', 'Discrepancy'].includes(po.status)) {
        await transaction.rollback();
        return ApiResponse.error(res, `Cannot receive goods for a PO in '${po.status}' status`, 400);
      }

      const orderItems = await POItem.findAll({ where: { po_id }, transaction });
      const orderedByProduct = new Map();
      for (const orderItem of orderItems) {
        orderedByProduct.set(
          orderItem.product_id,
          (orderedByProduct.get(orderItem.product_id) || 0) + Number(orderItem.ordered_qty)
        );
      }

      const existingReceipts = await GoodsReceipt.findAll({
        where: { po_id },
        include: [{ model: GRNItem, as: 'items' }],
        transaction
      });
      const receivedByProduct = new Map();
      for (const receipt of existingReceipts) {
        for (const receiptItem of receipt.items) {
          receivedByProduct.set(
            receiptItem.product_id,
            (receivedByProduct.get(receiptItem.product_id) || 0) + Number(receiptItem.received_qty)
          );
        }
      }

      for (const item of items) {
        if (!orderedByProduct.has(item.product_id)) {
          await transaction.rollback();
          return ApiResponse.error(res, `Product ID ${item.product_id} is not part of this Purchase Order`, 400);
        }

        const previouslyReceived = receivedByProduct.get(item.product_id) || 0;
        if (previouslyReceived + Number(item.received_qty) > orderedByProduct.get(item.product_id)) {
          await transaction.rollback();
          return ApiResponse.error(res, `Received quantity exceeds the outstanding quantity for Product ID ${item.product_id}`, 400);
        }
        receivedByProduct.set(item.product_id, previouslyReceived + Number(item.received_qty));
      }

      const grnNumber = `GRN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const grn = await GoodsReceipt.create({
        grn_number: grnNumber,
        po_id,
        received_by: req.user.id,
        received_date: new Date()
      }, { transaction });

      for (const item of items) {
        // Create batch for received product
        const { status: expiry_status } = ExpiryEngine.classifyExpiry(item.expiry_date);

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
        }, { transaction });

        await GRNItem.create({
          grn_id: grn.id,
          product_id: item.product_id,
          batch_id: batch.id,
          received_qty: item.received_qty
        }, { transaction });

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
        }, { transaction });
      }

      const hasOutstandingQuantity = orderItems.some(orderItem =>
        (receivedByProduct.get(orderItem.product_id) || 0) < Number(orderItem.ordered_qty)
      );
      po.status = hasOutstandingQuantity ? 'Partially Received' : 'Fully Received';
      await po.save({ transaction });
      await transaction.commit();

      return ApiResponse.success(
        res,
        'GRN submitted and stock ledger updated. Upload the GRN and invoice PDFs to run 3-Way matching against the saved Purchase Order.',
        { grn },
        201
      );
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      next(error);
    }
  }

  // --- VENDOR INVOICE ENTRY ---
  static async createVendorInvoice(req, res, next) {
    let transaction;
    try {
      transaction = await sequelize.transaction();
      const { po_id, invoice_number, invoice_amount, invoice_date, items } = req.body;
      const po = await PurchaseOrder.findByPk(po_id, { transaction });
      if (!po) {
        await transaction.rollback();
        return ApiResponse.error(res, 'Purchase Order not found', 404);
      }
      if (!['Sent', 'Partially Received', 'Fully Received', 'Discrepancy'].includes(po.status)) {
        await transaction.rollback();
        return ApiResponse.error(res, `Cannot log an invoice for a PO in '${po.status}' status`, 400);
      }

      const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
      let invoice;
      if (po.status === 'Discrepancy') {
        invoice = await VendorInvoice.findOne({
          where: { po_id },
          order: [['createdAt', 'DESC']],
          transaction
        });
      }

      if (invoice) {
        await invoice.update({
          invoice_number,
          invoice_amount,
          invoice_date,
          file_url: fileUrl
        }, { transaction });
        await InvoiceItem.destroy({ where: { invoice_id: invoice.id }, transaction });
      } else {
        invoice = await VendorInvoice.create({
          po_id,
          invoice_number,
          invoice_amount,
          invoice_date,
          file_url: fileUrl
        }, { transaction });
      }

      for (const item of items) {
        await InvoiceItem.create({
          invoice_id: invoice.id,
          product_id: item.product_id,
          billed_qty: item.billed_qty,
          billed_unit_price: item.billed_unit_price
        }, { transaction });
      }
      await transaction.commit();

      return ApiResponse.success(
        res,
        'Vendor invoice logged. Upload the GRN and invoice PDFs to run 3-Way matching against the saved Purchase Order.',
        { invoice },
        201
      );
    } catch (error) {
      if (transaction && !transaction.finished) await transaction.rollback();
      next(error);
    }
  }

  static async acceptReceivedQuantity(req, res, next) {
    try {
      const { po_id, remarks } = req.body;
      const result = await MatchingEngine.acceptReceivedQuantity(po_id, req.user.id);

      await AuditService.logAction({
        userId: req.user.id,
        action: 'ACCEPT_RECEIVED_QUANTITY',
        tableName: 'purchase_orders',
        recordId: po_id,
        newValue: {
          follow_up_po_id: result.followUpPO?.id || null,
          manager_remarks: remarks,
          matching_result: result.match?.remarks || 'Upload the GRN and invoice PDFs to rerun 3-Way matching against the saved Purchase Order.'
        }
      });

      return ApiResponse.success(
        res,
        result.followUpPO
          ? `Received quantity accepted; remaining quantity carried forward to ${result.followUpPO.po_number}. Upload the GRN and invoice PDFs to rerun matching.`
          : 'Received quantity accepted. Upload the GRN and invoice PDFs to rerun matching.',
        result
      );
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

export default PurchaseController;
