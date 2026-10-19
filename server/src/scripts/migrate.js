import { pathToFileURL } from 'node:url';
import sequelize from '../config/database.js';
import logger from '../utils/logger.js';
import { Permission, Role } from '../models/index.js';

async function migrate() {
  try {
    logger.info('Running safe database migrations...');
    await sequelize.sync();

    const queryInterface = sequelize.getQueryInterface();
    const productColumns = await queryInterface.describeTable('products');
    if (productColumns.dummyjson_id) {
      await queryInterface.removeColumn('products', 'dummyjson_id');
    }

    const procurementRole = await Role.findOne({ where: { role_name: 'Procurement Officer' } });
    if (procurementRole) {
      const [deletePermission] = await Permission.findOrCreate({
        where: { module: 'PurchaseOrders', action: 'delete' },
        defaults: { module: 'PurchaseOrders', action: 'delete' }
      });
      await procurementRole.addPermission(deletePermission);
    }

    logger.info('Database migration completed successfully!');
  } catch (error) {
    logger.error('Migration failed: ' + error.message);
    console.error(error);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().then(() => process.exit(0));
}

export default migrate;
