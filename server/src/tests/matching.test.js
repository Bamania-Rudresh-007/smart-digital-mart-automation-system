const MatchingEngine = require('../services/matchingEngine');
const { sequelize, Store, User, Supplier, Product, Category, PurchaseOrder, POItem, GoodsReceipt, GRNItem, VendorInvoice, InvoiceItem } = require('../models');

describe('3-Way Matching Engine Unit Tests', () => {
  beforeAll(async () => {
    process.env.DB_DIALECT = 'sqlite';
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('3-Way Match approves when PO, GRN and Vendor Invoice quantities & prices match', async () => {
    const store = await Store.create({ name: 'Match Store' });
    const user = await User.create({ name: 'Procurement', email: 'pro@sdmas.com', password_hash: 'hash', store_id: store.id, status: 'active' });
    const supplier = await Supplier.create({ name: 'Test Supplier' });
    const cat = await Category.create({ name: 'Test Cat' });

    const product = await Product.create({
      sku: 'SKU-PO-1',
      name: 'PO Rice',
      category_id: cat.id,
      store_id: store.id
    });

    const po = await PurchaseOrder.create({
      po_number: 'PO-TEST-1',
      supplier_id: supplier.id,
      store_id: store.id,
      status: 'Fully Received',
      created_by: user.id
    });

    await POItem.create({
      po_id: po.id,
      product_id: product.id,
      ordered_qty: 20,
      agreed_unit_price: 100.00
    });

    const grn = await GoodsReceipt.create({
      grn_number: 'GRN-TEST-1',
      po_id: po.id,
      received_by: user.id
    });

    await GRNItem.create({
      grn_id: grn.id,
      product_id: product.id,
      received_qty: 20
    });

    const invoice = await VendorInvoice.create({
      po_id: po.id,
      invoice_number: 'INV-TEST-1',
      invoice_amount: 2000.00,
      invoice_date: '2026-10-05'
    });

    await InvoiceItem.create({
      invoice_id: invoice.id,
      product_id: product.id,
      billed_qty: 20,
      billed_unit_price: 100.00
    });

    const result = await MatchingEngine.validateThreeWayMatch(po.id);

    expect(result.match_status).toBe('Matched');
    expect(result.po.status).toBe('Approved');
  });

  test('3-Way Match flags unit-price and invoice-total discrepancies', async () => {
    process.env.MATCH_TOLERANCE_PERCENT = '2';
    const store = await Store.create({ name: 'Discrepancy Store' });
    const user = await User.create({ name: 'Procurement', email: 'discrepancy@sdmas.com', password_hash: 'hash', store_id: store.id, status: 'active' });
    const supplier = await Supplier.create({ name: 'Discrepancy Supplier' });
    const cat = await Category.create({ name: 'Discrepancy Cat' });
    const product = await Product.create({
      sku: 'SKU-PO-2',
      name: 'PO Oil',
      category_id: cat.id,
      store_id: store.id
    });
    const po = await PurchaseOrder.create({
      po_number: 'PO-TEST-2',
      supplier_id: supplier.id,
      store_id: store.id,
      status: 'Fully Received',
      created_by: user.id
    });
    await POItem.create({ po_id: po.id, product_id: product.id, ordered_qty: 20, agreed_unit_price: 100 });
    const grn = await GoodsReceipt.create({ grn_number: 'GRN-TEST-2', po_id: po.id, received_by: user.id });
    await GRNItem.create({ grn_id: grn.id, product_id: product.id, received_qty: 20 });
    const invoice = await VendorInvoice.create({
      po_id: po.id,
      invoice_number: 'INV-TEST-2',
      invoice_amount: 2100,
      invoice_date: '2026-10-05'
    });
    await InvoiceItem.create({
      invoice_id: invoice.id,
      product_id: product.id,
      billed_qty: 20,
      billed_unit_price: 105
    });

    const result = await MatchingEngine.validateThreeWayMatch(po.id);

    expect(result.match_status).toBe('Discrepancy');
    expect(result.remarks).toContain('Unit Price discrepancy');
    expect(result.remarks).toContain('Total Amount discrepancy');
    expect(result.po.status).toBe('Discrepancy');
  });

  test('accepting a partial delivery carries the remaining quantity into a draft PO', async () => {
    const store = await Store.create({ name: 'Carry Forward Store' });
    const user = await User.create({ name: 'Manager', email: 'carry-forward@sdmas.com', password_hash: 'hash', store_id: store.id, status: 'active' });
    const supplier = await Supplier.create({ name: 'Carry Forward Supplier' });
    const cat = await Category.create({ name: 'Carry Forward Cat' });
    const product = await Product.create({
      sku: 'SKU-PO-3',
      name: 'PO Lentils',
      category_id: cat.id,
      store_id: store.id
    });
    const po = await PurchaseOrder.create({
      po_number: 'PO-TEST-3',
      supplier_id: supplier.id,
      store_id: store.id,
      status: 'Discrepancy',
      created_by: user.id
    });
    const poItem = await POItem.create({
      po_id: po.id,
      product_id: product.id,
      ordered_qty: 20,
      agreed_unit_price: 100
    });
    const grn = await GoodsReceipt.create({ grn_number: 'GRN-TEST-3', po_id: po.id, received_by: user.id });
    await GRNItem.create({ grn_id: grn.id, product_id: product.id, received_qty: 8 });
    const invoice = await VendorInvoice.create({
      po_id: po.id,
      invoice_number: 'INV-TEST-3',
      invoice_amount: 800,
      invoice_date: '2026-10-05'
    });
    await InvoiceItem.create({
      invoice_id: invoice.id,
      product_id: product.id,
      billed_qty: 8,
      billed_unit_price: 100
    });

    const result = await MatchingEngine.acceptReceivedQuantity(po.id, user.id);

    await poItem.reload();
    expect(poItem.ordered_qty).toBe(8);
    expect(result.followUpPO.status).toBe('Draft');
    const carriedItem = await POItem.findOne({ where: { po_id: result.followUpPO.id } });
    expect(carriedItem.ordered_qty).toBe(12);
    expect(result.match.match_status).toBe('Matched');
    expect(result.match.po.status).toBe('Approved');
  });
});
