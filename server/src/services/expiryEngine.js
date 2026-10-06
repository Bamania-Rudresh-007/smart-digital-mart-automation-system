const { Batch, Product, Alert } = require('../models');
const { broadcastAlert } = require('../sockets/socketManager');
const logger = require('../utils/logger');

class ExpiryEngine {
  static classifyExpiry(expiryDate, referenceDate = new Date()) {
    const expiryDay = new Date(expiryDate).toISOString().slice(0, 10);
    const todayDay = referenceDate.toISOString().slice(0, 10);
    const expiryUtc = Date.parse(`${expiryDay}T00:00:00Z`);
    const todayUtc = Date.parse(`${todayDay}T00:00:00Z`);
    const diffDays = Math.round((expiryUtc - todayUtc) / (1000 * 60 * 60 * 24));
    const warnDays = Number.parseInt(process.env.EXPIRY_WARNING_DAYS_1 || '30', 10);

    if (!Number.isFinite(warnDays) || warnDays < 0) {
      throw new Error('EXPIRY_WARNING_DAYS_1 must be a non-negative integer.');
    }

    let status = 'Healthy';
    if (diffDays <= 0) status = 'Expired';
    else if (diffDays <= warnDays) status = 'Near Expiry';

    return { diffDays, status };
  }

  /**
   * Run batch expiry scan and update statuses.
   */
   static async scanBatchExpiries() {
     const today = new Date();

     const warnDays2 = parseInt(process.env.EXPIRY_WARNING_DAYS_2 || '15', 10);
    if (!Number.isFinite(warnDays2) || warnDays2 < 0) {
      throw new Error('EXPIRY_WARNING_DAYS_2 must be a non-negative integer.');
    }

    const batches = await Batch.findAll({
      include: [{ model: Product, as: 'product' }]
    });

    let expiredCount = 0;
    let nearExpiryCount = 0;

    for (const batch of batches) {
      const { diffDays, status: newStatus } = this.classifyExpiry(batch.expiry_date, today);

      let oldStatus = batch.expiry_status;

      if (oldStatus !== newStatus) {
        batch.expiry_status = newStatus;
        await batch.save();

        if (!batch.product) {
          throw new Error(`Cannot alert for batch ${batch.id}: associated product is missing.`);
        }

        if (newStatus === 'Expired') {
          expiredCount++;
          const alert = await Alert.create({
            store_id: batch.product.store_id,
            type: 'expiry',
            reference_id: `BATCH-${batch.id}`,
            message: `CRITICAL: Batch ${batch.batch_number} of "${batch.product.name}" has EXPIRED! (Qty remaining: ${batch.qty_remaining}). Write-off recommended.`,
            status: 'new',
            sent_channels: 'in-app,email'
          });
          broadcastAlert(batch.product.store_id, alert);
        } else if (newStatus === 'Near Expiry') {
          nearExpiryCount++;
          const discountPct = diffDays <= warnDays2 ? 40 : 20;
          const alert = await Alert.create({
            store_id: batch.product.store_id,
            type: 'expiry',
            reference_id: `BATCH-${batch.id}`,
            message: `WARNING: Batch ${batch.batch_number} of "${batch.product.name}" expires in ${diffDays} days! Recommended markdown discount: ${discountPct}%.`,
            status: 'new',
            sent_channels: 'in-app,email'
          });
          broadcastAlert(batch.product.store_id, alert);
        }
      }
    }

    logger.info(`Batch Expiry Scan Complete. Updated ${expiredCount} expired batches and ${nearExpiryCount} near-expiry batches.`);
    return { expiredCount, nearExpiryCount, totalScanned: batches.length };
  }
}

module.exports = ExpiryEngine;
