const sequelize = require('../config/database');
const logger = require('../utils/logger');
require('../models');

async function migrate() {
  try {
    logger.info('Running database migrations (Sequelize Sync)...');
    await sequelize.sync({ alter: true });
    logger.info('Database migration completed successfully!');
  } catch (error) {
    logger.error('Migration failed: ' + error.message);
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  migrate().then(() => process.exit(0));
}

module.exports = migrate;
