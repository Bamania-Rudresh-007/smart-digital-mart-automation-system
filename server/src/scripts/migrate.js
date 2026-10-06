const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../utils/logger');
require('../models');

async function migrate() {
  try {
    logger.info('Running safe database migrations...');
    await sequelize.sync();

    const queryInterface = sequelize.getQueryInterface();
    const productColumns = await queryInterface.describeTable('products');
    if (!productColumns.dummyjson_id) {
      await queryInterface.addColumn('products', 'dummyjson_id', {
        type: DataTypes.INTEGER,
        allowNull: true
      });
    }

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
