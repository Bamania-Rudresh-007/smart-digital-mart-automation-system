const { Op } = require('sequelize');
const { sequelize, Batch, Product, Sale, SaleItem, StockLedger } = require('../models');
const { broadcastStockUpdate } = require('../sockets/socketManager');
const ReorderEngine = require('./reorderEngine');
const logger = require('../utils/logger');

class FefoService {
  /**
   * Process a sale checkout transaction enforcing FEFO.
   */
  static async processSale({ store_id, cashier_id, items, discount_amount = 0, tax_amount = 0, payment_mode = 'CASH' }) {
    const transaction = await sequelize.transaction();

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      let subtotal = 0;
      const allocatedSaleItems = [];

      for (const item of items) {
        const { product_id, qty: requestedQty, unit_selling_price } = item;

        // Fetch product & non-expired batches ordered by expiry_date ASC
        const product = await Product.findByPk(product_id, { transaction });
        if (!product) {
          throw new Error(`Product ID ${product_id} not found.`);
        }

        const batches = await Batch.findAll({
          where: {
            product_id,
            qty_remaining: { [Op.gt]: 0 },
            expiry_status: { [Op.ne]: 'Expired' },
            expiry_date: { [Op.gte]: todayStr }
          },
          order: [['expiry_date', 'ASC'], ['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        const totalAvailable = batches.reduce((sum, b) => sum + b.qty_remaining, 0);
        if (totalAvailable < requestedQty) {
          throw new Error(`Insufficient non-expired stock for "${product.name}". Requested: ${requestedQty}, Available: ${totalAvailable}`);
        }

        let remainingToDeduct = requestedQty;

        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;

          const deductQty = Math.min(batch.qty_remaining, remainingToDeduct);
          batch.qty_remaining -= deductQty;
          
          if (batch.qty_remaining === 0) {
            // Option to mark batch completed
          }
          await batch.save({ transaction });

          // Record Stock Ledger immutable entry
          await StockLedger.create({
            product_id: product.id,
            batch_id: batch.id,
            store_id,
            txn_type: 'sale',
            qty: -deductQty,
            balance_after: batch.qty_remaining,
            ref_id: null, // Will update with sale invoice number
            notes: `POS Sale FEFO allocation`
          }, { transaction });

          allocatedSaleItems.push({
            product_id: product.id,
            batch_id: batch.id,
            qty_sold: deductQty,
            unit_selling_price,
            unit_cost_price: batch.purchase_price,
            product_name: product.name,
            batch_number: batch.batch_number
          });

          subtotal += deductQty * unit_selling_price;
          remainingToDeduct -= deductQty;

          // Broadcast real-time stock update
          broadcastStockUpdate(store_id, {
            product_id: product.id,
            batch_id: batch.id,
            qty_remaining: batch.qty_remaining
          });
        }
      }

      const totalAmount = subtotal;
      const netAmount = Math.max(0, totalAmount - parseFloat(discount_amount) + parseFloat(tax_amount));
      const invoiceNo = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const saleRecord = await Sale.create({
        invoice_no: invoiceNo,
        store_id,
        cashier_id,
        total_amount: totalAmount,
        discount_amount,
        tax_amount,
        net_amount: netAmount,
        payment_mode,
        sale_date: new Date()
      }, { transaction });

      for (const item of allocatedSaleItems) {
        await SaleItem.create({
          sale_id: saleRecord.id,
          product_id: item.product_id,
          batch_id: item.batch_id,
          qty_sold: item.qty_sold,
          unit_selling_price: item.unit_selling_price,
          unit_cost_price: item.unit_cost_price
        }, { transaction });
      }

      await transaction.commit();

      logger.info(`Sale processed successfully: Invoice ${invoiceNo}, Total ${netAmount}`);

      try {
        await ReorderEngine.checkAndGenerateReorders(store_id, cashier_id);
      } catch (reorderError) {
        logger.error(`Automatic reorder check failed after checkout ${invoiceNo}: ${reorderError.message}`);
      }

      return {
        sale: saleRecord,
        invoice_no: invoiceNo,
        items: allocatedSaleItems,
        net_amount: netAmount
      };
    } catch (error) {
      await transaction.rollback();
      logger.error(`FEFO Sale processing failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = FefoService;
