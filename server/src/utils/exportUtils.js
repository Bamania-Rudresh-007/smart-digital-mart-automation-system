const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');

class ExportUtils {
  static async exportToExcel(res, filename, columns, data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 20
    }));

    // Header styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A8A' } // Dark blue
    };

    data.forEach(item => worksheet.addRow(item));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  }

  static generatePDFReport(res, title, headers, rows) {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${title.replace(/\s+/g, '_')}.pdf"`);

    doc.pipe(res);

    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
    doc.moveDown(1.5);

    const table = {
      headers: headers.map(h => ({ label: h, property: h.toLowerCase().replace(/\s+/g, '_') })),
      datas: rows
    };

    doc.table(table, {
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        doc.font('Helvetica').fontSize(9);
      }
    });

    doc.end();
  }
}

module.exports = ExportUtils;
