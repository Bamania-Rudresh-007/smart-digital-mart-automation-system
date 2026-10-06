const bcrypt = require('bcryptjs');
const { sequelize, Store, Role, Permission, User } = require('../models');
const logger = require('../utils/logger');

const modules = [
  'Products',
  'Batches',
  'PurchaseOrders',
  'GRN',
  'VendorInvoices',
  'Sales',
  'Reports',
  'UserManagement',
  'AuditLogs'
];
const actions = ['create', 'read', 'update', 'delete', 'approve'];

async function provisionSuperAdmin() {
  const email = process.env.SUPERADMIN_EMAIL || 'rudresh@gmail.com';
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!password || password.length < 8) {
    throw new Error('Set SUPERADMIN_PASSWORD to a value containing at least 8 characters before provisioning.');
  }

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const [store] = await Store.findOrCreate({
      where: { name: 'SDMart - Central Superstore' },
      defaults: {
        address: 'Plot 42, Commercial Belt, Metro Sector 15',
        contact_info: '+91 98765 43210',
        status: 'active'
      }
    });

    const [role] = await Role.findOrCreate({
      where: { role_name: 'Super Admin' },
      defaults: { description: 'Full system access across all stores and settings' }
    });

    const permissions = [];
    for (const module of modules) {
      for (const action of actions) {
        const [permission] = await Permission.findOrCreate({
          where: { module, action }
        });
        permissions.push(permission);
      }
    }
    await role.addPermissions(permissions);

    let user = await User.findOne({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);
    if (user) {
      user.name = 'Rudresh Super Admin';
      user.password_hash = passwordHash;
      user.store_id = user.store_id || store.id;
      user.status = 'active';
      await user.save();
    } else {
      user = await User.create({
        name: 'Rudresh Super Admin',
        email,
        phone: '9999900001',
        password_hash: passwordHash,
        store_id: store.id,
        status: 'active'
      });
    }

    const userRoles = await user.getRoles();
    if (!userRoles.some(userRole => userRole.id === role.id)) {
      await user.addRole(role);
    }

    logger.info(`Super Admin account provisioned: ${email}`);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  provisionSuperAdmin().catch(error => {
    logger.error(`Unable to provision Super Admin account: ${error.message}`);
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = provisionSuperAdmin;
