import PDFDocument from 'pdfkit';

const getOrderSummary = po => {
  const items = po.items || [];
  const quantity = items.reduce((sum, item) => sum + Number(item.ordered_qty), 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + Number(item.ordered_qty) * Number(item.agreed_unit_price),
    0
  );

  return {
    quantity,
    totalAmount,
    unitPrice: quantity ? totalAmount / quantity : 0
  };
};

const renderPdf = render => new Promise((resolve, reject) => {
  const document = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks = [];
  document.on('data', chunk => chunks.push(chunk));
  document.on('error', reject);
  document.on('end', () => resolve(Buffer.concat(chunks)));
  render(document);
  document.end();
});

const createPurchaseOrderPdf = po => renderPdf(document => {
  const { quantity, totalAmount, unitPrice } = getOrderSummary(po);
  document.font('Helvetica-Bold').fontSize(20).text('PURCHASE ORDER');
  document.moveDown();
  document.font('Helvetica').fontSize(11)
    .text(`PO Number: ${po.po_number}`)
    .text(`Supplier: ${po.supplier?.name || 'Supplier'}`)
    .text(`Status: ${po.status}`)
    .text(`Created: ${new Date(po.createdAt || Date.now()).toLocaleDateString('en-IN')}`);
  document.moveDown();
  document.font('Helvetica-Bold').text('Order Items');
  document.moveDown(0.5);
  for (const item of po.items || []) {
    document.font('Helvetica-Bold').text(item.product?.name || `Product ${item.product_id}`);
    document.font('Helvetica').text(`SKU: ${item.product?.sku || 'N/A'}`);
    document.text(`Quantity: ${Number(item.ordered_qty)}`);
    document.text(`Unit Price: INR ${Number(item.agreed_unit_price).toFixed(2)}`);
    document.text(`Line Total: INR ${(Number(item.ordered_qty) * Number(item.agreed_unit_price)).toFixed(2)}`);
    document.moveDown(0.5);
  }
  document.moveDown();
  document.font('Helvetica-Bold').fontSize(12)
    .text(`Total Ordered Quantity: ${quantity}`)
    .text(`Weighted Average Unit Price: INR ${unitPrice.toFixed(2)}`)
    .text(`PO Total: INR ${totalAmount.toFixed(2)}`);
});

const createValidationSamplePdf = (po, documentType, scenario) => {
  const { quantity, totalAmount, unitPrice } = getOrderSummary(po);
  const isInvoice = documentType === 'invoice';
  const mismatch = scenario === 'mismatch';
  const sampleQuantity = mismatch && documentType === 'grn'
    ? quantity + 1
    : quantity;
  const samplePrice = mismatch && isInvoice ? unitPrice * 1.1 : unitPrice;
  const sampleTotal = isInvoice ? sampleQuantity * samplePrice : totalAmount;
  const lines = isInvoice
    ? [
      'SUPPLIER INVOICE',
      `Invoice Number: SAMPLE-${po.po_number}`,
      `Purchase Order Reference: ${po.po_number}`,
      `Billed Quantity: ${sampleQuantity}`,
      `Unit Price: INR ${samplePrice.toFixed(2)}`,
      `Invoice Total: INR ${sampleTotal.toFixed(2)}`
    ]
    : [
      'GOODS RECEIPT NOTE',
      `GRN Number: SAMPLE-${po.po_number}`,
      `Purchase Order Reference: ${po.po_number}`,
      `Received Quantity: ${sampleQuantity}`,
      `Purchase Price: INR ${unitPrice.toFixed(2)}`
    ];

  return renderPdf(document => {
    document.font('Helvetica-Bold').fontSize(18).text(lines[0]);
    document.moveDown();
    document.font('Helvetica').fontSize(12);
    for (const line of lines.slice(1)) document.text(line, { lineGap: 5 });
  });
};

export { createPurchaseOrderPdf, createValidationSamplePdf };
