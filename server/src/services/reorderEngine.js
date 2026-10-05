const { Op } = require('sequelize');
const { Product, Batch, PurchaseOrder, POItem, Supplier, Alert } = require('../models');
const { broadcastAlert } = require('../sockets/socketManager');
const logger = require('../utils/logger');

class ReorderEngine {
  /**
   * Evaluates all products in a store (or across all stores) for low-stock reorder triggers.
   */
  static async checkAndGenerateReorders(storeId = null) {
    const whereClause = storeId ? { store_id: storeId } : {};
    const products = await Product.findAll({
      where: whereClause,
      include: [
        { model: Batch, as: 'batches' }
      ]
    });

    const generatedPOs = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (const product of products) {
      // Calculate current active non-expired stock
      const currentStock = product.batches
        .filter(b => b.expiry_status !== 'Expired' && b.expiry_date >= todayStr)
        .reduce((sum, b) => sum + b.qty_remaining, 0);

      if (currentStock <= product.reorder_threshold) {
        // FR-15: Check if there is already an active pending PO for this product in this store
        const existingPendingPO = await PurchaseOrder.findOne({
          where: {
            store_id: product.store_id,
            status: { [Op.in]: ['Draft', 'Sent', 'Partially Received'] }
          },
          include: [
            {
              model: POItem,
              as: 'items',
              where: { product_id: product.id }
            }
          ]
        });

        if (existingPendingPO) {
          logger.info(`Skipping auto-reorder for product "${product.name}": Pending PO ${existingPendingPO.po_number} already exists.`);
          continue;
        }

        // Determine default supplier from existing batches or default supplier
        const lastBatch = product.batches.find(b => b.supplier_id);
        let supplierId = lastBatch ? lastBatch.supplier_id : null;

        if (!supplierId) {
          const firstSupplier = await Supplier.findOne();
          supplierId = firstSupplier ? firstSupplier.id : 1;
        }

        const suggestedQty = Math.max(product.max_stock_level - currentStock, 10);
        const lastPrice = lastBatch ? parseFloat(lastBatch.purchase_price) : 100.00;

        const poNumber = `PO-AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const draftPO = await PurchaseOrder.create({
          po_number: poNumber,
          supplier_id: supplierId,
          store_id: product.store_id,
          status: 'Draft',
          created_by: 1, // System automated user
          is_auto_generated: true
        });

        await POItem.create({
          po_id: draftPO.id,
          product_id: product.id,
          ordered_qty: suggestedQty,
          agreed_unit_price: lastPrice
        });

        // Trigger Alert
        const alert = await Alert.create({
          store_id: product.store_id,
          type: 'low_stock',
          reference_id: `PO-${draftPO.id}`,
          message: `Low stock breach for "${product.name}" (Stock: ${currentStock}, Threshold: ${product.reorder_threshold}). Auto-generated Draft PO ${poNumber}.`,
          status: 'new',
          sent_channels: 'in-app,email'
        });

        broadcastAlert(product.store_id, alert);
        generatedPOs.push(draftPO);

        logger.info(`Auto-generated Draft Reorder PO ${poNumber} for product ${product.name}`);
      }
    }

    return generatedPOs;
  }
}

module.exports = ReorderEngine;
