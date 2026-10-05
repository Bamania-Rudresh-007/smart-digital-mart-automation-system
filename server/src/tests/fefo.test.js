const FefoService = require('../services/fefoService');
const { sequelize, Store, User, Role, Product, Batch, Category } = require('../models');

describe('FEFO Sales Deduction Engine Unit Tests', () => {
  beforeAll(async () => {
    process.env.DB_DIALECT = 'sqlite';
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('FEFO allocates earliest expiry batch first and updates remaining qty', async () => {
    const store = await Store.create({ name: 'Test Store' });
    const user = await User.create({ name: 'Cashier', email: 'testc@sdmas.com', password_hash: 'hash', store_id: store.id, status: 'active' });
    const cat = await Category.create({ name: 'Test Cat' });

    const product = await Product.create({
      sku: 'SKU-FEFO-1',
      name: 'FEFO Milk',
      category_id: cat.id,
      store_id: store.id,
      reorder_threshold: 5,
      max_stock_level: 50
    });

    const today = new Date();
    const expBatch1 = new Date(today);
    expBatch1.setDate(today.getDate() + 10); // Expiring earlier

    const expBatch2 = new Date(today);
    expBatch2.setDate(today.getDate() + 40); // Expiring later

    const batch1 = await Batch.create({
      product_id: product.id,
      batch_number: 'BATCH-EARLY',
      expiry_date: expBatch1,
      purchase_price: 40,
      selling_price: 50,
      qty_received: 10,
      qty_remaining: 10,
      expiry_status: 'Near Expiry'
    });

    const batch2 = await Batch.create({
      product_id: product.id,
      batch_number: 'BATCH-LATER',
      expiry_date: expBatch2,
      purchase_price: 40,
      selling_price: 50,
      qty_received: 20,
      qty_remaining: 20,
      expiry_status: 'Healthy'
    });

    // Sell 15 items -> Should take 10 from Batch 1 and 5 from Batch 2
    const result = await FefoService.processSale({
      store_id: store.id,
      cashier_id: user.id,
      items: [{ product_id: product.id, qty: 15, unit_selling_price: 50 }]
    });

    expect(result.net_amount).toBe(750);
    expect(result.items.length).toBe(2);

    // Refresh batches
    const updatedB1 = await Batch.findByPk(batch1.id);
    const updatedB2 = await Batch.findByPk(batch2.id);

    expect(updatedB1.qty_remaining).toBe(0);
    expect(updatedB2.qty_remaining).toBe(15);
  });
});
