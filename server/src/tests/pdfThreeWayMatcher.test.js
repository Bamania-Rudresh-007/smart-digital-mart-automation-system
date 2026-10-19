import PDFDocument from 'pdfkit';
import { PDFParse } from 'pdf-parse';
import { validatePdfThreeWayMatch } from '../services/pdfThreeWayMatcher.js';
import { createPurchaseOrderPdf, createValidationSamplePdf } from '../services/purchaseOrderPdf.js';

const expectedPoNumber = 'PO-TEST-001';
const purchaseOrderValues = { quantity: 10, unitPrice: 20, totalAmount: 200 };

const createPdf = lines => new Promise((resolve, reject) => {
  const document = new PDFDocument();
  const chunks = [];
  document.on('data', chunk => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.on('error', reject);
  lines.forEach(line => document.text(line));
  document.end();
});

const makeDocuments = async ({
  invoiceQuantity = 10,
  invoicePrice = 20,
  invoiceTotal = 200,
  grnQuantity = 10,
  grnPoNumber = expectedPoNumber,
  invoicePoNumber = expectedPoNumber
} = {}) => ({
  goodsReceiptNote: await createPdf([
    'Goods Receipt Note: GRN-100',
    `Purchase Order Reference: ${grnPoNumber}`,
    `Received Quantity: ${grnQuantity}`,
    'Purchase Price: 20.00'
  ]),
  supplierInvoice: await createPdf([
    'Supplier Invoice: INV-100',
    `Purchase Order Reference: ${invoicePoNumber}`,
    `Billed Quantity: ${invoiceQuantity}`,
    `Unit Price: ${invoicePrice.toFixed(2)}`,
    `Invoice Total: ${invoiceTotal.toFixed(2)}`
  ])
});

const matchDocuments = documents => validatePdfThreeWayMatch({
  ...documents,
  purchaseOrderValues,
  expectedPoNumber
});

describe('PDF 3-Way Matching', () => {
  const originalTolerance = process.env.MATCH_TOLERANCE_PERCENT;

  afterEach(() => {
    if (originalTolerance === undefined) {
      delete process.env.MATCH_TOLERANCE_PERCENT;
    } else {
      process.env.MATCH_TOLERANCE_PERCENT = originalTolerance;
    }
  });

  test('matches labeled GRN and invoice values against the selected saved PO values', async () => {
    process.env.MATCH_TOLERANCE_PERCENT = '2';
    const result = await matchDocuments(await makeDocuments());

    expect(result.match_status).toBe('Matched');
    expect(result.checks).toHaveLength(6);
    expect(result.checks.every(check => check.within_tolerance)).toBe(true);
    expect(result.documents.purchase_order.totalAmount).toBe(200);
  });

  test('reports quantity, unit-price, and amount discrepancies', async () => {
    process.env.MATCH_TOLERANCE_PERCENT = '2';
    const result = await matchDocuments(await makeDocuments({
      invoiceQuantity: 9,
      invoicePrice: 22,
      invoiceTotal: 198
    }));

    expect(result.match_status).toBe('Discrepancy');
    expect(result.discrepancies.some(issue => issue.startsWith('Quantity discrepancy'))).toBe(true);
    expect(result.discrepancies.some(issue => issue.startsWith('Unit Price discrepancy'))).toBe(true);
    expect(result.discrepancies.some(issue => issue.startsWith('Total Amount discrepancy'))).toBe(true);
  });

  test('rejects documents that do not reference the selected purchase order', async () => {
    const result = await matchDocuments(await makeDocuments({ invoicePoNumber: 'PO-OTHER-999' }));

    expect(result.match_status).toBe('Discrepancy');
    expect(result.checks.some(check => check.parameter === 'PO Reference' && !check.within_tolerance)).toBe(true);
  });

  test('rejects a document that is not a PDF', async () => {
    await expect(matchDocuments({
      goodsReceiptNote: Buffer.from('not a PDF'),
      supplierInvoice: Buffer.from('not a PDF')
    })).rejects.toThrow('Goods Receipt Note must be a valid PDF file.');
  });

  test('rejects a supplier invoice without a labeled total', async () => {
    const documents = await makeDocuments();
    documents.supplierInvoice = await createPdf([
      'Supplier Invoice: INV-100',
      `Purchase Order Reference: ${expectedPoNumber}`,
      'Billed Quantity: 10',
      'Unit Price: 20.00'
    ]);

    await expect(matchDocuments(documents))
      .rejects.toThrow('Supplier Invoice is missing a clearly labeled total amount');
  });

  test('provides matching and deliberately discrepant sample PDFs for a selected PO', async () => {
    process.env.MATCH_TOLERANCE_PERCENT = '2';
    const po = {
      po_number: expectedPoNumber,
      items: [{ ordered_qty: 10, agreed_unit_price: 20 }]
    };
    const matching = await matchDocuments({
      goodsReceiptNote: await createValidationSamplePdf(po, 'grn', 'matching'),
      supplierInvoice: await createValidationSamplePdf(po, 'invoice', 'matching')
    });
    const discrepantInvoice = await matchDocuments({
      goodsReceiptNote: await createValidationSamplePdf(po, 'grn', 'matching'),
      supplierInvoice: await createValidationSamplePdf(po, 'invoice', 'mismatch')
    });
    const discrepantGrn = await matchDocuments({
      goodsReceiptNote: await createValidationSamplePdf(po, 'grn', 'mismatch'),
      supplierInvoice: await createValidationSamplePdf(po, 'invoice', 'matching')
    });

    expect(matching.match_status).toBe('Matched');
    expect(discrepantInvoice.match_status).toBe('Discrepancy');
    expect(discrepantGrn.match_status).toBe('Discrepancy');
  });

  test('generates a downloadable PO PDF from the saved order details', async () => {
    const po = {
      po_number: expectedPoNumber,
      status: 'Sent',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      supplier: { name: 'Example Supplier' },
      items: [{
        ordered_qty: 10,
        agreed_unit_price: 20,
        product_id: 1,
        product: { name: 'Test Product', sku: 'TEST-001' }
      }]
    };
    const pdf = await createPurchaseOrderPdf(po);
    const parser = new PDFParse({ data: pdf });

    try {
      const result = await parser.getText();
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(result.text).toContain(expectedPoNumber);
      expect(result.text).toContain('Total Ordered Quantity: 10');
      expect(result.text).toContain('PO Total: INR 200.00');
    } finally {
      await parser.destroy();
    }
  });
});
