const { Op } = require('sequelize');
const { Sale, SaleItem, Product, Batch, Category, Store, sequelize } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const ExportUtils = require('../utils/exportUtils');

class ReportController {
  // --- DAILY / PERIODIC SALES REPORT ---
  static async getSalesReport(req, res, next) {
    try {
      const { startDate, endDate, format } = req.query;
      const where = {};
      if (req.targetStoreId) where.store_id = req.targetStoreId;

      if (startDate && endDate) {
        where.sale_date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      }

      const sales = await Sale.findAll({
        where,
        include: [
          { model: Store, as: 'store' },
          { 
            model: SaleItem, 
            as: 'items', 
            include: [{ model: Product, as: 'product' }] 
          }
        ],
        order: [['sale_date', 'DESC']]
      });

      let totalRevenue = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      let totalTransactions = sales.length;

      const itemsSummary = {};

      sales.forEach(s => {
        totalRevenue += parseFloat(s.net_amount || 0);
        totalDiscount += parseFloat(s.discount_amount || 0);
        totalTax += parseFloat(s.tax_amount || 0);

        s.items.forEach(si => {
          const pname = si.product ? si.product.name : `Product ${si.product_id}`;
          if (!itemsSummary[pname]) {
            itemsSummary[pname] = { product_name: pname, qty_sold: 0, revenue: 0 };
          }
          itemsSummary[pname].qty_sold += si.qty_sold;
          itemsSummary[pname].revenue += si.qty_sold * parseFloat(si.unit_selling_price);
        });
      });

      const summaryList = Object.values(itemsSummary);

      if (format === 'excel') {
        const columns = [
          { header: 'Product Name', key: 'product_name', width: 30 },
          { header: 'Qty Sold', key: 'qty_sold', width: 15 },
          { header: 'Total Revenue (₹)', key: 'revenue', width: 20 }
        ];
        return ExportUtils.exportToExcel(res, 'Sales_Report', columns, summaryList);
      }

      return ApiResponse.success(res, 'Sales Report Summary', {
        metrics: {
          totalTransactions,
          totalRevenue,
          totalDiscount,
          totalTax
        },
        itemsSummary: summaryList,
        sales
      });
    } catch (error) {
      next(error);
    }
  }

  // --- GROSS PROFIT REPORT (FR-21) ---
  static async getGrossProfitReport(req, res, next) {
    try {
      const { startDate, endDate, format } = req.query;
      const where = {};
      if (req.targetStoreId) where.store_id = req.targetStoreId;

      if (startDate && endDate) {
        where.sale_date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
      }

      const saleItems = await SaleItem.findAll({
        include: [
          { model: Sale, as: 'Sale', where },
          { model: Product, as: 'product' },
          { model: Batch, as: 'batch' }
        ]
      });

      let totalSalesValue = 0;
      let totalCostValue = 0;
      const productMargins = {};

      saleItems.forEach(item => {
        const sellingPrice = parseFloat(item.unit_selling_price);
        const costPrice = parseFloat(item.unit_cost_price);
        const qty = item.qty_sold;

        const saleValue = sellingPrice * qty;
        const costValue = costPrice * qty;
        const profit = saleValue - costValue;

        totalSalesValue += saleValue;
        totalCostValue += costValue;

        const pname = item.product ? item.product.name : `Product ${item.product_id}`;
        if (!productMargins[pname]) {
          productMargins[pname] = { product_name: pname, qty_sold: 0, sale_value: 0, cost_value: 0, profit: 0, margin_pct: 0 };
        }

        productMargins[pname].qty_sold += qty;
        productMargins[pname].sale_value += saleValue;
        productMargins[pname].cost_value += costValue;
        productMargins[pname].profit += profit;
      });

      const reportRows = Object.values(productMargins).map(p => {
        p.margin_pct = p.sale_value > 0 ? ((p.profit / p.sale_value) * 100).toFixed(2) : 0;
        return p;
      });

      const totalProfit = totalSalesValue - totalCostValue;
      const overallMarginPct = totalSalesValue > 0 ? ((totalProfit / totalSalesValue) * 100).toFixed(2) : 0;

      if (format === 'excel') {
        const columns = [
          { header: 'Product Name', key: 'product_name', width: 30 },
          { header: 'Qty Sold', key: 'qty_sold', width: 12 },
          { header: 'Sales Revenue (₹)', key: 'sale_value', width: 18 },
          { header: 'Batch Cost (₹)', key: 'cost_value', width: 18 },
          { header: 'Gross Profit (₹)', key: 'profit', width: 18 },
          { header: 'Margin (%)', key: 'margin_pct', width: 15 }
        ];
        return ExportUtils.exportToExcel(res, 'Gross_Profit_Report', columns, reportRows);
      }

      return ApiResponse.success(res, 'Gross Profit Report', {
        summary: {
          totalSalesValue,
          totalCostValue,
          totalProfit,
          overallMarginPct: `${overallMarginPct}%`
        },
        productMargins: reportRows
      });
    } catch (error) {
      next(error);
    }
  }

  // --- NEAR-EXPIRY & EXPIRED REPORT (FR-19) ---
  static async getExpiryReport(req, res, next) {
    try {
      const { days, status, format } = req.query;
      const daysThreshold = parseInt(days || '30', 10);
      const today = new Date();

      const where = {};
      if (status) {
        where.expiry_status = status;
      } else {
        where.expiry_status = { [Op.in]: ['Near Expiry', 'Expired'] };
      }

      const batches = await Batch.findAll({
        where: {
          ...where,
          qty_remaining: { [Op.gt]: 0 }
        },
        include: [
          { model: Product, as: 'product', include: [{ model: Category, as: 'category' }] }
        ],
        order: [['expiry_date', 'ASC']]
      });

      const reportRows = batches.map(b => {
        const expDate = new Date(b.expiry_date);
        const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        const estimatedLoss = (parseFloat(b.purchase_price) * b.qty_remaining).toFixed(2);
        
        let recommendedDiscount = 0;
        if (diffDays > 0 && diffDays <= 15) recommendedDiscount = 40;
        else if (diffDays > 15 && diffDays <= 30) recommendedDiscount = 20;

        return {
          batch_number: b.batch_number,
          product_name: b.product ? b.product.name : 'N/A',
          category: b.product?.category ? b.product.category.name : 'N/A',
          expiry_date: b.expiry_date,
          days_to_expiry: diffDays,
          qty_remaining: b.qty_remaining,
          purchase_price: b.purchase_price,
          estimated_loss: estimatedLoss,
          expiry_status: b.expiry_status,
          recommended_discount_pct: recommendedDiscount
        };
      });

      if (format === 'excel') {
        const columns = [
          { header: 'Batch No', key: 'batch_number', width: 20 },
          { header: 'Product Name', key: 'product_name', width: 30 },
          { header: 'Expiry Date', key: 'expiry_date', width: 15 },
          { header: 'Days to Expiry', key: 'days_to_expiry', width: 15 },
          { header: 'Qty Remaining', key: 'qty_remaining', width: 15 },
          { header: 'Status', key: 'expiry_status', width: 15 },
          { header: 'Recommended Discount (%)', key: 'recommended_discount_pct', width: 25 }
        ];
        return ExportUtils.exportToExcel(res, 'Expiry_Risk_Report', columns, reportRows);
      }

      return ApiResponse.success(res, 'Expiry Risk Report', reportRows);
    } catch (error) {
      next(error);
    }
  }

  // --- LOW STOCK REPORT (FR-22) ---
  static async getLowStockReport(req, res, next) {
    try {
      const { format } = req.query;
      const where = {};
      if (req.targetStoreId) where.store_id = req.targetStoreId;

      const products = await Product.findAll({
        where,
        include: [{ model: Batch, as: 'batches' }, { model: Category, as: 'category' }]
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const lowStockProducts = [];

      products.forEach(p => {
        const currentStock = p.batches
          .filter(b => b.expiry_status !== 'Expired' && b.expiry_date >= todayStr)
          .reduce((sum, b) => sum + b.qty_remaining, 0);

        if (currentStock <= p.reorder_threshold) {
          lowStockProducts.push({
            sku: p.sku,
            product_name: p.name,
            category: p.category ? p.category.name : 'N/A',
            current_stock: currentStock,
            reorder_threshold: p.reorder_threshold,
            max_stock_level: p.max_stock_level,
            suggested_reorder_qty: Math.max(p.max_stock_level - currentStock, 10)
          });
        }
      });

      if (format === 'excel') {
        const columns = [
          { header: 'SKU', key: 'sku', width: 15 },
          { header: 'Product Name', key: 'product_name', width: 30 },
          { header: 'Current Stock', key: 'current_stock', width: 15 },
          { header: 'Threshold', key: 'reorder_threshold', width: 15 },
          { header: 'Suggested Reorder Qty', key: 'suggested_reorder_qty', width: 20 }
        ];
        return ExportUtils.exportToExcel(res, 'Low_Stock_Report', columns, lowStockProducts);
      }

      return ApiResponse.success(res, 'Low Stock Products List', lowStockProducts);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReportController;
