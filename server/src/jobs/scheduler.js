import cron from 'node-cron';
import ExpiryEngine from '../services/expiryEngine.js';
import ReorderEngine from '../services/reorderEngine.js';
import logger from '../utils/logger.js';

const initScheduler = () => {
  logger.info('Initializing Node-Cron background jobs...');

  // Daily job at midnight: Expiry Scan & Reorder Check
  cron.schedule('0 0 * * *', async () => {
    logger.info('[CRON] Running daily Batch Expiry Scan & Auto-Reorder Check...');
    try {
      await ExpiryEngine.scanBatchExpiries();
      await ReorderEngine.checkAndGenerateReorders();
    } catch (err) {
      logger.error('[CRON ERROR] Daily job failed: ' + err.message);
    }
  });

  // Hourly job: Auto-reorder check for immediate stock breaches
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Running hourly Low Stock Auto-Reorder Check...');
    try {
      await ReorderEngine.checkAndGenerateReorders();
    } catch (err) {
      logger.error('[CRON ERROR] Hourly reorder job failed: ' + err.message);
    }
  });
};

export { initScheduler };
