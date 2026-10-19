import { PDFParse } from 'pdf-parse';

const numberPattern = '(-?\\d[\\d,]*(?:\\.\\d{1,4})?)';

const fieldAliases = {
  purchaseOrder: {
    quantity: ['ordered quantity', 'quantity ordered', 'order quantity', 'total quantity', 'ordered qty', 'quantity', 'qty'],
    unitPrice: ['agreed unit price', 'unit price', 'price per unit', 'rate'],
    totalAmount: ['purchase order total', 'total order amount', 'po total', 'order total', 'total amount', 'grand total', 'total']
  },
  goodsReceiptNote: {
    quantity: ['received quantity', 'quantity received', 'received qty', 'quantity', 'qty'],
    unitPrice: ['purchase price', 'unit price', 'price per unit', 'rate']
  },
  supplierInvoice: {
    quantity: ['billed quantity', 'quantity billed', 'invoice quantity', 'billed qty', 'quantity', 'qty'],
    unitPrice: ['billed unit price', 'unit price', 'price per unit', 'rate'],
    totalAmount: ['invoice total', 'total invoice amount', 'invoice amount', 'total amount', 'amount due', 'net payable', 'grand total', 'total']
  }
};

const labels = {
  purchaseOrder: 'Purchase Order',
  goodsReceiptNote: 'Goods Receipt Note',
  supplierInvoice: 'Supplier Invoice'
};

const extractNumber = (text, aliases) => {
  for (const alias of aliases) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const expression = new RegExp(
      `\\b${escapedAlias}\\b\\s*[:=#-]?\\s*(?:(?:USD|INR|EUR|GBP)\\s*)?[$₹€£]?\\s*${numberPattern}`,
      'i'
    );
    const match = text.match(expression);
    if (match) {
      const value = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
};

const extractPurchaseOrderReference = text => {
  const match = text.match(/\b(?:purchase\s*order|po)\s*(?:(?:number|no\.?|reference|ref)\s*)?[:#-]\s*(PO-[A-Z0-9-]+)\b/i);
  return match ? match[1].toUpperCase() : null;
};

const parseDocument = async (buffer, type) => {
  if (!buffer || buffer.length < 5 || buffer.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error(`${labels[type]} must be a valid PDF file.`);
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
    if (!text.trim()) {
      throw new Error(`${labels[type]} contains no selectable text. Scanned PDFs are not supported.`);
    }

    const fields = {};
    for (const [field, aliases] of Object.entries(fieldAliases[type])) {
      fields[field] = extractNumber(text, aliases);
    }

    if (!fields.quantity) {
      throw new Error(`${labels[type]} is missing a clearly labeled quantity (for example, "Quantity: 10").`);
    }
    if (type !== 'goodsReceiptNote' && !fields.unitPrice) {
      throw new Error(`${labels[type]} is missing a clearly labeled unit price (for example, "Unit Price: 10.00").`);
    }
    if (type === 'supplierInvoice' && !fields.totalAmount) {
      throw new Error('Supplier Invoice is missing a clearly labeled total amount (for example, "Invoice Total: 100.00").');
    }

    fields.purchaseOrderReference = extractPurchaseOrderReference(text);
    return fields;
  } catch (error) {
    if (error.message.startsWith(`${labels[type]} `) || error.message.startsWith('Supplier Invoice ')) {
      throw error;
    }
    throw new Error(`${labels[type]} could not be read. Ensure it is a valid, unencrypted PDF with selectable text.`);
  } finally {
    await parser.destroy();
  }
};

const percentDifference = (actual, expected) => (
  expected === 0 ? (actual === 0 ? 0 : Infinity) : (Math.abs(actual - expected) / Math.abs(expected)) * 100
);

const compare = (parameter, documentA, valueA, documentB, valueB, tolerancePercent) => {
  const variancePercent = percentDifference(valueA, valueB);
  return {
    parameter,
    documents: `${documentA} vs ${documentB}`,
    value_a: valueA,
    value_b: valueB,
    variance_percent: Number.isFinite(variancePercent) ? Number(variancePercent.toFixed(2)) : null,
    within_tolerance: variancePercent <= tolerancePercent
  };
};

const validatePdfThreeWayMatch = async ({
  purchaseOrderValues,
  expectedPoNumber,
  goodsReceiptNote,
  supplierInvoice
}) => {
  const tolerancePercent = Number.parseFloat(process.env.MATCH_TOLERANCE_PERCENT || '2.0');
  if (!Number.isFinite(tolerancePercent) || tolerancePercent < 0) {
    throw new Error('MATCH_TOLERANCE_PERCENT must be a non-negative number.');
  }

  if (!purchaseOrderValues || !expectedPoNumber) {
    throw new Error('Purchase Order values and number are required for PDF validation.');
  }

  const [grn, invoice] = await Promise.all([
    parseDocument(goodsReceiptNote, 'goodsReceiptNote'),
    parseDocument(supplierInvoice, 'supplierInvoice')
  ]);
  const po = { ...purchaseOrderValues, purchaseOrderReference: expectedPoNumber };

  const checks = [
    compare('Quantity', labels.purchaseOrder, po.quantity, labels.goodsReceiptNote, grn.quantity, tolerancePercent),
    compare('Quantity', labels.goodsReceiptNote, grn.quantity, labels.supplierInvoice, invoice.quantity, tolerancePercent),
    compare('Unit Price', labels.purchaseOrder, po.unitPrice, labels.supplierInvoice, invoice.unitPrice, tolerancePercent),
    compare('Total Amount', labels.purchaseOrder, po.totalAmount, labels.supplierInvoice, invoice.totalAmount, tolerancePercent)
  ];

  if (grn.unitPrice !== null) {
    checks.push(
      compare('Unit Price', labels.purchaseOrder, po.unitPrice, labels.goodsReceiptNote, grn.unitPrice, tolerancePercent),
      compare('Unit Price', labels.goodsReceiptNote, grn.unitPrice, labels.supplierInvoice, invoice.unitPrice, tolerancePercent)
    );
  }

  const discrepancies = checks
    .filter(check => !check.within_tolerance)
    .map(check => `${check.parameter} discrepancy (${check.documents}): ${check.value_a} vs ${check.value_b}${check.variance_percent === null ? '' : ` (${check.variance_percent}% variance)`}`);

  for (const [documentType, document] of [
    [labels.goodsReceiptNote, grn],
    [labels.supplierInvoice, invoice]
  ]) {
    const actualReference = document.purchaseOrderReference;
    if (actualReference !== String(expectedPoNumber).toUpperCase()) {
      const check = {
        parameter: 'PO Reference',
        documents: `Selected Purchase Order vs ${documentType}`,
        value_a: expectedPoNumber,
        value_b: actualReference || 'Missing',
        variance_percent: null,
        within_tolerance: false
      };
      checks.push(check);
      discrepancies.push(
        `PO Reference discrepancy (${documentType}): expected ${expectedPoNumber}, found ${actualReference || 'no purchase order reference'}`
      );
    }
  }

  const hasExplicitTotalDiscrepancy = discrepancies.some(issue => issue.startsWith('Total Amount discrepancy'));
  if (!hasExplicitTotalDiscrepancy && po.totalAmount !== null && invoice.totalAmount !== null) {
    const hasQuantityOrPriceMismatch =
      po.quantity !== invoice.quantity ||
      po.unitPrice !== invoice.unitPrice ||
      po.totalAmount !== invoice.totalAmount;

    if (hasQuantityOrPriceMismatch && Math.abs(po.totalAmount - invoice.totalAmount) > Number.EPSILON) {
      const totalVariance = percentDifference(invoice.totalAmount, po.totalAmount);
      discrepancies.push(
        `Total Amount discrepancy (${labels.purchaseOrder} vs ${labels.supplierInvoice}): ${po.totalAmount} vs ${invoice.totalAmount}${Number.isFinite(totalVariance) ? ` (${totalVariance.toFixed(2)}% variance)` : ''}`
      );
    }
  }

  const matchStatus = discrepancies.length ? 'Discrepancy' : 'Matched';

  return {
    match_status: matchStatus,
    tolerance_percent: tolerancePercent,
    checks,
    discrepancies,
    remarks: discrepancies.length
      ? discrepancies.join('; ')
      : 'PDF 3-Way Match passed within configured quantity, unit price, and total amount tolerance.',
    documents: {
      purchase_order: po,
      goods_receipt_note: grn,
      supplier_invoice: invoice
    }
  };
};

export { validatePdfThreeWayMatch };
