const { Op } = require('sequelize');
const { Batch, Product, Alert } = require('../models');
const { broadcastAlert } = require('../sockets/socketManager');
const logger = require('../utils/logger');

class ExpiryEngine {
  /**
   * Run batch expiry scan and update statuses.
   */
  static async scanBatchExpiries() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const warnDays1 = parseInt(process.env.EXPIRY_WARNING_DAYS_1 || '30', 10);
    const warnDays2 = parseInt(process.env.EXPIRY_WARNING_DAYS_2 || '15', 10);

    const batches = await Batch.findAll({
      where: {
        qty_remaining: { [Op.gt]: 0 }
      },
      include: [{ model: Product, as: 'product' }]
    });

    let expiredCount = 0;
    let nearExpiryCount = 0;

    for (const batch of batches) {
      const expDate = new Date(batch.expiry_date);
      expDate.setHours(0, 0, 0, 0);

      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let oldStatus = batch.expiry_status;
      let newStatus = 'Healthy';

      if (diffDays <= 0) {
        newStatus = 'Expired';
      } else if (diffDays <= warnDays1) {
        newStatus = 'Near Expiry';
      }

      if (oldStatus !== newStatus) {
        batch.expiry_status = newStatus;
        await batch.save();

        if (newStatus === 'Expired') {
          expiredCount++;
          const alert = await Alert.create({
            store_id: batch.product ? batch.product.store_id : 1,
            type: 'expiry',
            reference_id: `BATCH-${batch.id}`,
            message: `CRITICAL: Batch ${batch.batch_number} of "${batch.product?.name}" has EXPIRED! (Qty remaining: ${batch.qty_remaining}). Write-off recommended.`,
            status: 'new',
            sent_channels: 'in-app,email'
          });
          if (batch.product) broadcastAlert(batch.product.store_id, alert);
        } else if (newStatus === 'Near Expiry') {
          nearExpiryCount++;
          const discountPct = diffDays <= warnDays2 ? 40 : 20;
          const alert = await Alert.create({
            store_id: batch.product ? batch.product.store_id : 1,
            type: 'expiry',
            reference_id: `BATCH-${batch.id}`,
            message: `WARNING: Batch ${batch.batch_number} of "${batch.product?.name}" expires in ${diffDays} days! Recommended markdown discount: ${discountPct}%.`,
            status: 'new',
            sent_channels: 'in-app,email'
          });
          if (batch.product) broadcastAlert(batch.product.store_id, alert);
        }
      }
    }

    logger.info(`Batch Expiry Scan Complete. Updated ${expiredCount} expired batches and ${nearExpiryCount} near-expiry batches.`);
    return { expiredCount, nearExpiryCount, totalScanned: batches.length };
  }
}

module.exports = ExpiryEngine;
