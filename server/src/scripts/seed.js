const bcrypt = require('bcryptjs');
const { 
  sequelize, Store, Role, Permission, User, Category, UnitOfMeasure, 
  Product, Supplier, Batch, PurchaseOrder, POItem, StockLedger, AlertRule 
} = require('../models');
const logger = require('../utils/logger');

async function seedDatabase() {
  try {
    const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'rudresh@gmail.com';
    const superAdminPassword = process.env.SUPERADMIN_PASSWORD;
    if (!superAdminPassword || superAdminPassword.length < 8) {
      throw new Error('Set SUPERADMIN_PASSWORD to a value containing at least 8 characters before seeding.');
    }

    logger.info('Syncing database...');
    await sequelize.sync({ force: true });
    logger.info('Database synced successfully.');

    // 1. Seed Stores
    logger.info('Seeding Stores...');
    const mainStore = await Store.create({
      name: 'SDMart - Central Superstore',
      address: 'Plot 42, Commercial Belt, Metro Sector 15',
      contact_info: '+91 98765 43210',
      status: 'active'
    });

    const branchStore = await Store.create({
      name: 'SDMart - Express Branch',
      address: 'Shop 101, Galleria Mall, Downtown',
      contact_info: '+91 98765 43211',
      status: 'active'
    });

    // 2. Seed Roles & Permissions
    logger.info('Seeding Roles & Permissions...');
    const defaultRoles = [
      { role_name: 'Super Admin', description: 'Full system access across all stores and settings' },
      { role_name: 'Store Manager', description: 'Full access to assigned store, approves POs and overrides match discrepancies' },
      { role_name: 'Inventory Staff', description: 'Manage inventory, products, batches and receive GRN' },
      { role_name: 'Procurement Officer', description: 'Manage Purchase Orders, 3-way matching and suppliers' },
      { role_name: 'Cashier', description: 'Access POS billing screen and create sales transactions' },
      { role_name: 'Auditor', description: 'Read-only access to audit logs, stock ledger, and financial reports' }
    ];

    const createdRoles = {};
    for (const r of defaultRoles) {
      createdRoles[r.role_name] = await Role.create(r);
    }

    const modules = ['Products', 'Batches', 'PurchaseOrders', 'GRN', 'VendorInvoices', 'Sales', 'Reports', 'UserManagement', 'AuditLogs'];
    const actions = ['create', 'read', 'update', 'delete', 'approve'];

    const permissions = [];
    for (const mod of modules) {
      for (const act of actions) {
        const perm = await Permission.create({ module: mod, action: act });
        permissions.push(perm);
      }
    }

    // Assign all permissions to Super Admin & Store Manager
    await createdRoles['Super Admin'].addPermissions(permissions);
    await createdRoles['Store Manager'].addPermissions(permissions);

    // 3. Seed Users
    logger.info('Seeding Users...');
    const passwordHash = await bcrypt.hash('Password@123', 10);
    const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

    const userSeedData = [
      { name: 'Rudresh Super Admin', email: superAdminEmail, phone: '9999900001', role: 'Super Admin', store_id: mainStore.id, password_hash: superAdminPasswordHash },
      { name: 'Rajesh Store Manager', email: 'manager@sdmas.com', phone: '9999900002', role: 'Store Manager', store_id: mainStore.id },
      { name: 'Amit Inventory Lead', email: 'inventory@sdmas.com', phone: '9999900003', role: 'Inventory Staff', store_id: mainStore.id },
      { name: 'Priya Procurement Officer', email: 'procurement@sdmas.com', phone: '9999900004', role: 'Procurement Officer', store_id: mainStore.id },
      { name: 'Rahul Cashier', email: 'cashier@sdmas.com', phone: '9999900005', role: 'Cashier', store_id: mainStore.id },
      { name: 'Suresh Compliance Auditor', email: 'auditor@sdmas.com', phone: '9999900006', role: 'Auditor', store_id: mainStore.id }
    ];

    for (const u of userSeedData) {
      const user = await User.create({
        name: u.name,
        email: u.email,
        phone: u.phone,
        password_hash: u.password_hash || passwordHash,
        store_id: u.store_id,
        status: 'active'
      });
      await user.addRoles([createdRoles[u.role]]);
    }

    // 4. Seed Units of Measure
    logger.info('Seeding Units of Measure...');
    const uomData = [
      { name: 'Pieces', symbol: 'Pcs' },
      { name: 'Kilograms', symbol: 'Kg' },
      { name: 'Grams', symbol: 'g' },
      { name: 'Liters', symbol: 'L' },
      { name: 'Milliliters', symbol: 'mL' },
      { name: 'Pack', symbol: 'Pk' }
    ];
    const uomMap = {};
    for (const u of uomData) {
      const created = await UnitOfMeasure.create(u);
      uomMap[u.symbol] = created.id;
    }

    // 5. Seed Categories
    logger.info('Seeding Categories...');
    const catDairy = await Category.create({ name: 'Dairy & Bakery' });
    const catGroceries = await Category.create({ name: 'Staples & Groceries' });
    const catPersonal = await Category.create({ name: 'Personal Care & Hygiene' });
    const catBeverages = await Category.create({ name: 'Beverages & Snacks' });

    const subMilk = await Category.create({ name: 'Fresh Milk & Butter', parent_category_id: catDairy.id });
    const subRice = await Category.create({ name: 'Rice & Grains', parent_category_id: catGroceries.id });
    const subFlour = await Category.create({ name: 'Atta & Flours', parent_category_id: catGroceries.id });
    const subSoaps = await Category.create({ name: 'Soaps & Wash', parent_category_id: catPersonal.id });
    const subTea = await Category.create({ name: 'Tea & Coffee', parent_category_id: catBeverages.id });
    const subSnacks = await Category.create({ name: 'Snacks & Biscuits', parent_category_id: catBeverages.id });
    const subCleaning = await Category.create({ name: 'Laundry & Cleaning', parent_category_id: catPersonal.id });

    // 6. Seed Suppliers
    logger.info('Seeding Suppliers...');
    const supplierAmul = await Supplier.create({ name: 'Amul Dairy Co-op', contact: 'Ramesh Patel', email: 'supply@amul.coop', address: 'Anand, Gujarat', gst_no: '24AAAAA0000A1Z5' });
    const supplierFortune = await Supplier.create({ name: 'Fortune Consumer Products Ltd', contact: 'Sunil Verma', email: 'sales@fortunefoods.com', address: 'Ahmedabad, Gujarat', gst_no: '24BBBBB1111B2Z6' });
    const supplierHUL = await Supplier.create({ name: 'Hindustan Unilever Distribution', contact: 'Kavita Sharma', email: 'orders@hul-dist.com', address: 'Mumbai, Maharashtra', gst_no: '27CCCCC2222C3Z7' });
    const supplierTata = await Supplier.create({ name: 'Tata Consumer Products', contact: 'Venkatesh Iyer', email: 'b2b@tataconsumer.com', address: 'Bengaluru, Karnataka', gst_no: '29DDDDD3333D4Z8' });

    // 7. Seed Products & Batches (including Healthy, Near-Expiry, and Expired)
    logger.info('Seeding Products and Batches...');

    const productsData = [
      {
        sku: 'SKU-MILK-001',
        name: 'Amul Taaza Toned Milk 1L',
        category_id: subMilk.id,
        unit_of_measure_id: uomMap['L'],
        reorder_threshold: 20,
        max_stock_level: 100,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-MILK-2026-01', days_to_expiry: -2, purchase_price: 48.00, selling_price: 54.00, qty: 15, supplier_id: supplierAmul.id },
          { batch_number: 'B-MILK-2026-02', days_to_expiry: 10, purchase_price: 48.00, selling_price: 54.00, qty: 35, supplier_id: supplierAmul.id },
          { batch_number: 'B-MILK-2026-03', days_to_expiry: 45, purchase_price: 48.00, selling_price: 54.00, qty: 50, supplier_id: supplierAmul.id }
        ]
      },
      {
        sku: 'SKU-RICE-001',
        name: 'Fortune Everyday Basmati Rice 5kg',
        category_id: subRice.id,
        unit_of_measure_id: uomMap['Pk'],
        reorder_threshold: 10,
        max_stock_level: 50,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-RICE-901', days_to_expiry: 180, purchase_price: 340.00, selling_price: 420.00, qty: 25, supplier_id: supplierFortune.id }
        ]
      },
      {
        sku: 'SKU-ATTA-001',
        name: 'Aashirvaad Shudh Chakki Atta 10kg',
        category_id: subFlour.id,
        unit_of_measure_id: uomMap['Pk'],
        reorder_threshold: 15,
        max_stock_level: 60,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-ATTA-55', days_to_expiry: 12, purchase_price: 360.00, selling_price: 445.00, qty: 8, supplier_id: supplierFortune.id }, // Low stock & Near expiry
          { batch_number: 'B-ATTA-56', days_to_expiry: 90, purchase_price: 360.00, selling_price: 445.00, qty: 20, supplier_id: supplierFortune.id }
        ]
      },
      {
        sku: 'SKU-SOAP-001',
        name: 'Dove Cream Beauty Bathing Bar 125g (Pack of 3)',
        category_id: subSoaps.id,
        unit_of_measure_id: uomMap['Pk'],
        reorder_threshold: 25,
        max_stock_level: 120,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-DOVE-089', days_to_expiry: 250, purchase_price: 135.00, selling_price: 175.00, qty: 60, supplier_id: supplierHUL.id }
        ]
      },
      {
        sku: 'SKU-TEA-001',
        name: 'Tata Tea Gold Premium 500g',
        category_id: subTea.id,
        unit_of_measure_id: uomMap['Pk'],
        reorder_threshold: 12,
        max_stock_level: 50,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-TEA-102', days_to_expiry: 200, purchase_price: 260.00, selling_price: 330.00, qty: 30, supplier_id: supplierTata.id }
        ]
      },
      {
        sku: 'SKU-BUTTER-001',
        name: 'Amul Salted Butter 500g',
        category_id: subMilk.id,
        unit_of_measure_id: uomMap['Pk'],
        reorder_threshold: 12,
        max_stock_level: 50,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-BUTTER-241', days_to_expiry: 75, purchase_price: 245.00, selling_price: 285.00, qty: 24, supplier_id: supplierAmul.id }
        ]
      },
      {
        sku: 'SKU-OIL-001',
        name: 'Fortune Sunlite Sunflower Oil 1L',
        category_id: catGroceries.id,
        unit_of_measure_id: uomMap['L'],
        reorder_threshold: 20,
        max_stock_level: 80,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-OIL-518', days_to_expiry: 250, purchase_price: 108.00, selling_price: 125.00, qty: 35, supplier_id: supplierFortune.id }
        ]
      },
      {
        sku: 'SKU-SALT-001',
        name: 'Tata Salt Iodized 1kg',
        category_id: catGroceries.id,
        unit_of_measure_id: uomMap['Kg'],
        reorder_threshold: 20,
        max_stock_level: 120,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-SALT-334', days_to_expiry: 300, purchase_price: 18.00, selling_price: 24.00, qty: 70, supplier_id: supplierTata.id }
        ]
      },
      {
        sku: 'SKU-BISCUIT-001',
        name: 'Parle-G Gluco Biscuits 800g',
        category_id: subSnacks.id,
        unit_of_measure_id: uomMap['Pk'],
        reorder_threshold: 15,
        max_stock_level: 80,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-PARLE-782', days_to_expiry: 140, purchase_price: 70.00, selling_price: 90.00, qty: 45, supplier_id: supplierTata.id }
        ]
      },
      {
        sku: 'SKU-DETERGENT-001',
        name: 'Surf Excel Easy Wash Detergent 1kg',
        category_id: subCleaning.id,
        unit_of_measure_id: uomMap['Pk'],
        reorder_threshold: 10,
        max_stock_level: 60,
        store_id: mainStore.id,
        batches: [
          { batch_number: 'B-SURF-129', days_to_expiry: 365, purchase_price: 122.00, selling_price: 145.00, qty: 28, supplier_id: supplierHUL.id }
        ]
      }
    ];

    const today = new Date();

    for (const pData of productsData) {
      const product = await Product.create({
        sku: pData.sku,
        name: pData.name,
        category_id: pData.category_id,
        unit_of_measure_id: pData.unit_of_measure_id,
        reorder_threshold: pData.reorder_threshold,
        max_stock_level: pData.max_stock_level,
        store_id: pData.store_id
      });

      for (const bData of pData.batches) {
        const expDate = new Date(today);
        expDate.setDate(today.getDate() + bData.days_to_expiry);

        const mfgDate = new Date(today);
        mfgDate.setDate(today.getDate() - 60);

        let expiry_status = 'Healthy';
        if (bData.days_to_expiry <= 0) {
          expiry_status = 'Expired';
        } else if (bData.days_to_expiry <= 30) {
          expiry_status = 'Near Expiry';
        }

        const batch = await Batch.create({
          product_id: product.id,
          batch_number: bData.batch_number,
          mfg_date: mfgDate,
          expiry_date: expDate,
          purchase_price: bData.purchase_price,
          selling_price: bData.selling_price,
          qty_received: bData.qty,
          qty_remaining: bData.qty,
          supplier_id: bData.supplier_id,
          expiry_status
        });

        // Record initial purchase entry in stock ledger
        await StockLedger.create({
          product_id: product.id,
          batch_id: batch.id,
          store_id: pData.store_id,
          txn_type: 'purchase',
          qty: bData.qty,
          balance_after: bData.qty,
          ref_id: 'INIT-SEED',
          notes: 'Initial stock seeding'
        });
      }
    }

    // 8. Seed Alert Rules
    await AlertRule.create({
      store_id: mainStore.id,
      alert_type: 'expiry',
      recipient_emails: 'manager@sdmas.com,inventory@sdmas.com',
      notification_channels: 'in-app,email'
    });

    await AlertRule.create({
      store_id: mainStore.id,
      alert_type: 'low_stock',
      recipient_emails: 'manager@sdmas.com,procurement@sdmas.com',
      notification_channels: 'in-app,email'
    });

    logger.info('Database seeding completed successfully!');
  } catch (error) {
    logger.error('Error seeding database: ' + error.message);
    console.error(error);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedDatabase;
