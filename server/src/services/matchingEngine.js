const { PurchaseOrder, POItem, GoodsReceipt, GRNItem, VendorInvoice, InvoiceItem, PurchaseMatch, Alert } = require('../models');
const { broadcastAlert } = require('../sockets/socketManager');
const NotificationService = require('./notificationService');
const logger = require('../utils/logger');

class MatchingEngine {
  /**
   * Run 3-Way Match validation for a given Purchase Order.
   */
  static async validateThreeWayMatch(poId, resolvedUserId = null) {
    const po = await PurchaseOrder.findByPk(poId, {
      include: [
        { model: POItem, as: 'items' },
        { model: GoodsReceipt, as: 'goodsReceipts', include: [{ model: GRNItem, as: 'items' }] },
        { model: VendorInvoice, as: 'vendorInvoices', include: [{ model: InvoiceItem, as: 'items' }] }
      ]
    });

    if (!po) {
      throw new Error(`Purchase Order ${poId} not found.`);
    }

    if (po.goodsReceipts.length === 0 || po.vendorInvoices.length === 0) {
      logger.info(`PO ${poId}: Cannot execute 3-Way match yet. Waiting for both GRN and Vendor Invoice.`);
      return { match_status: 'Pending_Inputs', po };
    }

    const tolerancePercent = parseFloat(process.env.MATCH_TOLERANCE_PERCENT || '2.0');
    let hasDiscrepancy = false;
    const discrepancies = [];

    // Aggregate GRN quantities per product
    const grnTotals = {};
    po.goodsReceipts.forEach(grn => {
      grn.items.forEach(gi => {
        grnTotals[gi.product_id] = (grnTotals[gi.product_id] || 0) + gi.received_qty;
      });
    });

    // Aggregate Vendor Invoice quantities & price per product
    const invoiceTotals = {};
    const invoicePrices = {};
    po.vendorInvoices.forEach(inv => {
      inv.items.forEach(ii => {
        invoiceTotals[ii.product_id] = (invoiceTotals[ii.product_id] || 0) + ii.billed_qty;
        invoicePrices[ii.product_id] = parseFloat(ii.billed_unit_price);
      });
    });

    for (const item of po.items) {
      const pid = item.product_id;
      const orderedQty = item.ordered_qty;
      const agreedPrice = parseFloat(item.agreed_unit_price);

      const receivedQty = grnTotals[pid] || 0;
      const billedQty = invoiceTotals[pid] || 0;
      const billedPrice = invoicePrices[pid] || agreedPrice;

      // 1. Check Quantity Variance (PO ordered vs GRN received vs Invoice billed)
      if (receivedQty !== orderedQty || billedQty !== orderedQty) {
        hasDiscrepancy = true;
        discrepancies.push(`Quantity Mismatch for Product ID ${pid}: Ordered=${orderedQty}, Received=${receivedQty}, Billed=${billedQty}`);
      }

      // 2. Check Price Variance within tolerance
      const priceDiffPct = (Math.abs(billedPrice - agreedPrice) / agreedPrice) * 100;
      if (priceDiffPct > tolerancePercent) {
        hasDiscrepancy = true;
        discrepancies.push(`Price Variance for Product ID ${pid}: Agreed=${agreedPrice}, Billed=${billedPrice} (${priceDiffPct.toFixed(2)}% variance)`);
      }
    }

    let matchStatus = hasDiscrepancy ? 'Discrepancy' : 'Matched';
    const remarksText = hasDiscrepancy ? discrepancies.join('; ') : '3-Way Match Passed within tolerance.';

    // Create or update PurchaseMatch record
    let matchRecord = await PurchaseMatch.findOne({ where: { po_id: poId } });
    if (matchRecord) {
      matchRecord.match_status = matchStatus;
      matchRecord.remarks = remarksText;
      matchRecord.resolved_by = resolvedUserId;
      await matchRecord.save();
    } else {
      matchRecord = await PurchaseMatch.create({
        po_id: poId,
        match_status: matchStatus,
        remarks: remarksText,
        resolved_by: resolvedUserId
      });
    }

    // Update PO Status
    if (!hasDiscrepancy) {
      po.status = 'Approved'; // Auto-approve
      await po.save();
      logger.info(`PO ${poId} 3-Way Match Passed! Auto-Approved for payment.`);
    } else {
      po.status = 'Discrepancy';
      await po.save();
      logger.warn(`PO ${poId} 3-Way Match Failed! Discrepancies: ${remarksText}`);

      // Create Alert for Store Manager
      const alert = await Alert.create({
        store_id: po.store_id,
        type: 'discrepancy',
        reference_id: `PO-${po.id}`,
        message: `Purchase Order ${po.po_number} has 3-way matching discrepancies: ${remarksText}`,
        status: 'new',
        sent_channels: 'in-app,email'
      });

      broadcastAlert(po.store_id, alert);
    }

    return {
      match_status: matchStatus,
      remarks: remarksText,
      po
    };
  }

  /**
   * Manager override for a discrepancy.
   */
  static async overrideDiscrepancy(poId, managerUserId, remarks) {
    const po = await PurchaseOrder.findByPk(poId);
    if (!po) throw new Error('Purchase Order not found');

    if (po.status !== 'Discrepancy') {
      throw new Error(`Cannot override PO in status '${po.status}'. Must be in 'Discrepancy' state.`);
    }

    let matchRecord = await PurchaseMatch.findOne({ where: { po_id: poId } });
    if (!matchRecord) {
      matchRecord = await PurchaseMatch.create({
        po_id: poId,
        match_status: 'Override_Approved',
        remarks: `Manager Override: ${remarks}`,
        resolved_by: managerUserId
      });
    } else {
      matchRecord.match_status = 'Override_Approved';
      matchRecord.remarks = `Manager Override: ${remarks}`;
      matchRecord.resolved_by = managerUserId;
      await matchRecord.save();
    }

    po.status = 'Approved';
    await po.save();

    logger.info(`PO ${poId} discrepancy overridden by User ${managerUserId}`);
    return { po, matchRecord };
  }
}

module.exports = MatchingEngine;
