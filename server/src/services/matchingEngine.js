const {
  sequelize,
  PurchaseOrder,
  POItem,
  GoodsReceipt,
  GRNItem,
  VendorInvoice,
  InvoiceItem,
  PurchaseMatch,
  Alert
} = require('../models');
const { broadcastAlert } = require('../sockets/socketManager');
const logger = require('../utils/logger');

const percentDifference = (actual, expected) => {
  if (expected === 0) return actual === 0 ? 0 : Infinity;
  return (Math.abs(actual - expected) / Math.abs(expected)) * 100;
};

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

    const tolerancePercent = Number.parseFloat(process.env.MATCH_TOLERANCE_PERCENT || '2.0');
    if (!Number.isFinite(tolerancePercent) || tolerancePercent < 0) {
      throw new Error('MATCH_TOLERANCE_PERCENT must be a non-negative number.');
    }

    const expectedByProduct = new Map();
    for (const item of po.items) {
      const expected = expectedByProduct.get(item.product_id) || { qty: 0, amount: 0 };
      expected.qty += Number(item.ordered_qty);
      expected.amount += Number(item.ordered_qty) * Number(item.agreed_unit_price);
      expectedByProduct.set(item.product_id, expected);
    }

    const receivedByProduct = new Map();
    for (const grn of po.goodsReceipts) {
      for (const item of grn.items) {
        receivedByProduct.set(
          item.product_id,
          (receivedByProduct.get(item.product_id) || 0) + Number(item.received_qty)
        );
      }
    }

    const invoiceByProduct = new Map();
    let declaredInvoiceAmount = 0;
    for (const invoice of po.vendorInvoices) {
      declaredInvoiceAmount += Number(invoice.invoice_amount);
      for (const item of invoice.items) {
        const billed = invoiceByProduct.get(item.product_id) || { qty: 0, amount: 0, unitPrices: [] };
        billed.qty += Number(item.billed_qty);
        billed.amount += Number(item.billed_qty) * Number(item.billed_unit_price);
        billed.unitPrices.push(Number(item.billed_unit_price));
        invoiceByProduct.set(item.product_id, billed);
      }
    }

    let hasDiscrepancy = false;
    const discrepancies = [];
    let expectedPOAmount = 0;
    let invoicedLineAmount = 0;

    for (const [productId, expected] of expectedByProduct) {
      const receivedQty = receivedByProduct.get(productId) || 0;
      const billed = invoiceByProduct.get(productId) || { qty: 0, amount: 0, unitPrices: [] };
      const agreedUnitPrice = expected.amount / expected.qty;
      expectedPOAmount += expected.amount;
      invoicedLineAmount += billed.amount;

      const quantityComparisons = [
        { actual: receivedQty, expected: expected.qty, against: 'ordered' },
        { actual: billed.qty, expected: receivedQty, against: 'received' }
      ];

      for (const comparison of quantityComparisons) {
        const variance = percentDifference(comparison.actual, comparison.expected);
        if (variance > tolerancePercent) {
          hasDiscrepancy = true;
          discrepancies.push(
            `Quantity discrepancy for Product ID ${productId}: ${comparison.actual} ${comparison.against === 'ordered' ? 'received' : 'billed'} vs ${comparison.expected} ${comparison.against} (${Number.isFinite(variance) ? `${variance.toFixed(2)}%` : 'undefined'} variance)`
          );
        }
      }

      if (billed.unitPrices.length === 0) {
        hasDiscrepancy = true;
        discrepancies.push(`Unit Price discrepancy for Product ID ${productId}: no billed unit price was provided.`);
      }
      for (const billedUnitPrice of billed.unitPrices) {
        const priceVariance = percentDifference(billedUnitPrice, agreedUnitPrice);
        if (priceVariance > tolerancePercent) {
          hasDiscrepancy = true;
          discrepancies.push(
            `Unit Price discrepancy for Product ID ${productId}: agreed=${agreedUnitPrice.toFixed(2)}, billed=${billedUnitPrice.toFixed(2)} (${Number.isFinite(priceVariance) ? `${priceVariance.toFixed(2)}%` : 'undefined'} variance)`
          );
        }
      }
    }

    for (const productId of receivedByProduct.keys()) {
      if (!expectedByProduct.has(productId)) {
        hasDiscrepancy = true;
        discrepancies.push(`Quantity discrepancy: GRN contains un-ordered Product ID ${productId}.`);
      }
    }

    for (const productId of invoiceByProduct.keys()) {
      if (!expectedByProduct.has(productId)) {
        hasDiscrepancy = true;
        discrepancies.push(`Quantity discrepancy: invoice contains un-ordered Product ID ${productId}.`);
      }
    }

    const lineAmountVariance = percentDifference(invoicedLineAmount, declaredInvoiceAmount);
    if (lineAmountVariance > tolerancePercent) {
      hasDiscrepancy = true;
      discrepancies.push(
        `Total Amount discrepancy: invoice header=${declaredInvoiceAmount.toFixed(2)}, invoice lines=${invoicedLineAmount.toFixed(2)} (${Number.isFinite(lineAmountVariance) ? `${lineAmountVariance.toFixed(2)}%` : 'undefined'} variance)`
      );
    }

    const poAmountVariance = percentDifference(declaredInvoiceAmount, expectedPOAmount);
    if (poAmountVariance > tolerancePercent) {
      hasDiscrepancy = true;
      discrepancies.push(
        `Total Amount discrepancy: purchase order=${expectedPOAmount.toFixed(2)}, invoice=${declaredInvoiceAmount.toFixed(2)} (${Number.isFinite(poAmountVariance) ? `${poAmountVariance.toFixed(2)}%` : 'undefined'} variance)`
      );
    }

    const matchStatus = hasDiscrepancy ? 'Discrepancy' : 'Matched';
    const remarksText = hasDiscrepancy
      ? discrepancies.join('; ')
      : '3-Way Match Passed within configured quantity, unit price, and total amount tolerance.';

    let matchRecord = await PurchaseMatch.findOne({ where: { po_id: poId } });
    const shouldNotify = hasDiscrepancy &&
      (!matchRecord || matchRecord.match_status !== 'Discrepancy' || matchRecord.remarks !== remarksText);

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

    if (!hasDiscrepancy) {
      po.status = 'Approved';
      await po.save();
      logger.info(`PO ${poId} 3-Way Match Passed! Auto-Approved for payment.`);
    } else {
      po.status = 'Discrepancy';
      await po.save();
      logger.warn(`PO ${poId} 3-Way Match Failed! Discrepancies: ${remarksText}`);

      if (shouldNotify) {
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
    }

    return {
      match_status: matchStatus,
      remarks: remarksText,
      po
    };
  }

  /**
   * Accept received quantities and create a draft PO for the outstanding amounts.
   */
  static async acceptReceivedQuantity(poId, managerUserId) {
    const transaction = await sequelize.transaction();
    let followUpPO = null;

    try {
      const po = await PurchaseOrder.findByPk(poId, {
        include: [
          { model: POItem, as: 'items' },
          { model: GoodsReceipt, as: 'goodsReceipts', include: [{ model: GRNItem, as: 'items' }] }
        ],
        transaction
      });

      if (!po) throw new Error('Purchase Order not found.');
      if (po.status !== 'Discrepancy') {
        throw new Error('Quantity acceptance is only available for a PO with a discrepancy.');
      }

      const receivedByProduct = new Map();
      for (const receipt of po.goodsReceipts) {
        for (const item of receipt.items) {
          receivedByProduct.set(
            item.product_id,
            (receivedByProduct.get(item.product_id) || 0) + Number(item.received_qty)
          );
        }
      }

      const carryForward = [];
      for (const item of po.items) {
        const receivedQty = receivedByProduct.get(item.product_id) || 0;
        const orderedQty = Number(item.ordered_qty);

        if (receivedQty > orderedQty) {
          throw new Error(`Cannot accept quantity for Product ID ${item.product_id}: received quantity cannot exceed the ordered quantity.`);
        }

        if (receivedQty === 0) {
          carryForward.push({
            product_id: item.product_id,
            ordered_qty: orderedQty,
            agreed_unit_price: item.agreed_unit_price
          });
          await item.destroy({ transaction });
          continue;
        }

        if (receivedQty < orderedQty) {
          carryForward.push({
            product_id: item.product_id,
            ordered_qty: orderedQty - receivedQty,
            agreed_unit_price: item.agreed_unit_price
          });
          item.ordered_qty = receivedQty;
          await item.save({ transaction });
        }
      }

      if (carryForward.length > 0) {
        followUpPO = await PurchaseOrder.create({
          po_number: `PO-CARRY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          supplier_id: po.supplier_id,
          store_id: po.store_id,
          status: 'Draft',
          created_by: managerUserId,
          is_auto_generated: true
        }, { transaction });

        await POItem.bulkCreate(carryForward.map(item => ({
          ...item,
          po_id: followUpPO.id
        })), { transaction });
      }

      await transaction.commit();
      const match = await this.validateThreeWayMatch(poId, managerUserId);
      return { po, followUpPO, match };
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
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
