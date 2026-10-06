const ExpiryEngine = require('../services/expiryEngine');
const ReorderEngine = require('../services/reorderEngine');
const ProductController = require('../controllers/productController');
const {
  sequelize,
  Store,
  User,
  Supplier,
  Product,
  Category,
  Batch,
  StockLedger,
  PurchaseOrder,
  POItem,
  Alert
} = require('../models');

describe('Expiry detection and automatic reorder workflows', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('expiry detection scans zero-stock batches and classifies by the configured date window', async () => {
    process.env.EXPIRY_WARNING_DAYS_1 = '30';
    const store = await Store.create({ name: 'Expiry Test Store' });
    const category = await Category.create({ name: 'Expiry Test Category' });
    const product = await Product.create({
      sku: 'EXPIRY-TEST-1',
      name: 'Expiry Test Product',
      category_id: category.id,
      store_id: store.id
    });

    const expiredDate = new Date();
    expiredDate.setUTCDate(expiredDate.getUTCDate() - 1);
    const healthyStatus = await Batch.create({
      product_id: product.id,
      batch_number: 'EXPIRY-TEST-EXPIRED',
      expiry_date: expiredDate.toISOString().slice(0, 10),
      purchase_price: 10,
      selling_price: 15,
      qty_received: 2,
      qty_remaining: 0,
      expiry_status: 'Healthy'
    });
    const nearExpiryDate = new Date();
    nearExpiryDate.setUTCDate(nearExpiryDate.getUTCDate() + 30);
    const nearExpiryBatch = await Batch.create({
      product_id: product.id,
      batch_number: 'EXPIRY-TEST-NEAR',
      expiry_date: nearExpiryDate.toISOString().slice(0, 10),
      purchase_price: 10,
      selling_price: 15,
      qty_received: 2,
      qty_remaining: 1,
      expiry_status: 'Healthy'
    });

    const result = await ExpiryEngine.scanBatchExpiries();

    await healthyStatus.reload();
    await nearExpiryBatch.reload();
    expect(result.totalScanned).toBe(2);
    expect(healthyStatus.expiry_status).toBe('Expired');
    expect(nearExpiryBatch.expiry_status).toBe('Near Expiry');
    expect(await Alert.count({ where: { store_id: store.id, type: 'expiry' } })).toBe(2);
  });

  test('checkout reorder generation creates one reviewable draft with the correct actor and quantity', async () => {
    const store = await Store.create({ name: 'Reorder Test Store' });
    const user = await User.create({
      name: 'Checkout Cashier',
      email: 'reorder-test@sdmas.com',
      password_hash: 'hash',
      store_id: store.id,
      status: 'active'
    });
    const supplier = await Supplier.create({ name: 'Reorder Test Supplier' });
    const category = await Category.create({ name: 'Reorder Test Category' });
    const product = await Product.create({
      sku: 'REORDER-TEST-1',
      name: 'Reorder Test Product',
      category_id: category.id,
      store_id: store.id,
      reorder_threshold: 5,
      max_stock_level: 20
    });
    const expiryDate = new Date();
    expiryDate.setUTCDate(expiryDate.getUTCDate() + 90);
    await Batch.create({
      product_id: product.id,
      batch_number: 'REORDER-TEST-BATCH',
      expiry_date: expiryDate.toISOString().slice(0, 10),
      purchase_price: 25,
      selling_price: 35,
      qty_received: 5,
      qty_remaining: 5,
      supplier_id: supplier.id,
      expiry_status: 'Healthy'
    });

    const generated = await ReorderEngine.checkAndGenerateReorders(store.id, user.id);
    const secondCheck = await ReorderEngine.checkAndGenerateReorders(store.id, user.id);
    const purchaseOrder = await PurchaseOrder.findOne({ where: { store_id: store.id } });
    const purchaseItem = await POItem.findOne({ where: { po_id: purchaseOrder.id } });

    expect(generated).toHaveLength(1);
    expect(secondCheck).toHaveLength(0);
    expect(purchaseOrder.status).toBe('Draft');
    expect(purchaseOrder.is_auto_generated).toBe(true);
    expect(purchaseOrder.created_by).toBe(user.id);
    expect(purchaseItem.ordered_qty).toBe(15);
    expect(await Alert.count({ where: { store_id: store.id, type: 'low_stock' } })).toBe(1);
  });

  test('product creation generates a SKU and records a dated opening batch in the stock ledger', async () => {
    const store = await Store.create({ name: 'Product Creation Store' });
    const user = await User.create({
      name: 'Product Manager',
      email: 'product-manager@sdmas.com',
      password_hash: 'hash',
      store_id: store.id,
      status: 'active'
    });
    const supplier = await Supplier.create({ name: 'Product Creation Supplier' });
    const category = await Category.create({ name: 'Product Creation Category' });
    const expiryDate = new Date();
    expiryDate.setUTCDate(expiryDate.getUTCDate() + 120);
    const body = {
      name: 'Fresh Juice 1L',
      category_id: category.id,
      reorder_threshold: 5,
      max_stock_level: 50,
      initial_batch: {
        expiry_date: expiryDate.toISOString().slice(0, 10),
        purchase_price: 35,
        selling_price: 50,
        qty_received: 12,
        supplier_id: supplier.id
      }
    };
    let response;
    const res = {
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(payload) {
        response = payload;
        return payload;
      }
    };

    await ProductController.createProduct({
      body,
      targetStoreId: null,
      user: { id: user.id, store_id: store.id }
    }, res, error => {
      throw error;
    });

    expect(res.statusCode).toBe(201);
    expect(response.success).toBe(true);
    expect(response.data.sku).toMatch(/^SKU-\d{6}$/);
    const batch = await Batch.findOne({ where: { product_id: response.data.id } });
    expect(batch.batch_number).toContain(response.data.sku);
    expect(batch.expiry_date).toBe(body.initial_batch.expiry_date);
    expect(batch.qty_remaining).toBe(12);
    expect(await StockLedger.count({ where: { batch_id: batch.id, store_id: store.id } })).toBe(1);
  });
});
