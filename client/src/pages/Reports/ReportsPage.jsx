import React, { useState, useEffect } from 'react';
import { FileText, Download, FileSpreadsheet, File } from 'lucide-react';
import Badge from '../../components/Common/Badge';
import api from '../../services/api';

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesReport, setSalesReport] = useState(null);
  const [profitReport, setProfitReport] = useState(null);
  const [expiryReport, setExpiryReport] = useState([]);
  const [lowStockReport, setLowStockReport] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [activeTab]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        const res = await api.get('/reports/sales');
        setSalesReport(res.data.data);
      } else if (activeTab === 'profit') {
        const res = await api.get('/reports/profit');
        setProfitReport(res.data.data);
      } else if (activeTab === 'expiry') {
        const res = await api.get('/reports/expiry');
        setExpiryReport(res.data.data || []);
      } else if (activeTab === 'lowstock') {
        const res = await api.get('/reports/low-stock');
        setLowStockReport(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    window.open(`/api/reports/${activeTab === 'lowstock' ? 'low-stock' : activeTab}?format=excel`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Business Intelligence & Reports</h2>
          <p className="text-xs text-slate-500">Gross profit margins, FEFO sales analysis, and stock risk auditing</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export to Excel (.xlsx)</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: 'sales', label: 'Daily Sales Report' },
          { key: 'profit', label: 'Gross Profit Report (FR-21)' },
          { key: 'expiry', label: 'Near-Expiry Risk Report' },
          { key: 'lowstock', label: 'Low-Stock Report' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        {loading ? (
          <p className="text-center text-xs text-slate-400 py-8">Generating report dataset...</p>
        ) : (
          <>
            {activeTab === 'sales' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-blue-50/50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Transactions</span>
                    <h4 className="text-xl font-black">{salesReport?.metrics?.totalTransactions || 0}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Revenue</span>
                    <h4 className="text-xl font-black text-emerald-600">₹{salesReport?.metrics?.totalRevenue?.toFixed(2) || 0}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Discounts</span>
                    <h4 className="text-xl font-black text-amber-600">₹{salesReport?.metrics?.totalDiscount?.toFixed(2) || 0}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Tax (GST)</span>
                    <h4 className="text-xl font-black text-blue-600">₹{salesReport?.metrics?.totalTax?.toFixed(2) || 0}</h4>
                  </div>
                </div>

                <h4 className="font-bold text-xs uppercase text-slate-400 pt-2">Product Revenue Breakdown</h4>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-2">Product Name</th>
                      <th className="py-2 text-center">Qty Sold</th>
                      <th className="py-2 text-right">Revenue (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesReport?.itemsSummary?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-bold">{item.product_name}</td>
                        <td className="py-2 text-center">{item.qty_sold}</td>
                        <td className="py-2 text-right font-extrabold text-slate-900 dark:text-white">₹{item.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'profit' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-emerald-50/50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Sales Value</span>
                    <h4 className="text-xl font-black">₹{profitReport?.summary?.totalSalesValue?.toFixed(2) || 0}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Batch Cost</span>
                    <h4 className="text-xl font-black text-slate-500">₹{profitReport?.summary?.totalCostValue?.toFixed(2) || 0}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Gross Profit</span>
                    <h4 className="text-xl font-black text-emerald-600">₹{profitReport?.summary?.totalProfit?.toFixed(2) || 0}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Overall Margin %</span>
                    <h4 className="text-xl font-black text-blue-600">{profitReport?.summary?.overallMarginPct}</h4>
                  </div>
                </div>

                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-2">Product Name</th>
                      <th className="py-2 text-center">Qty Sold</th>
                      <th className="py-2 text-right">Sales Revenue</th>
                      <th className="py-2 text-right">Batch Cost</th>
                      <th className="py-2 text-right">Gross Profit</th>
                      <th className="py-2 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profitReport?.productMargins?.map((p, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-bold">{p.product_name}</td>
                        <td className="py-2 text-center">{p.qty_sold}</td>
                        <td className="py-2 text-right">₹{p.sale_value.toFixed(2)}</td>
                        <td className="py-2 text-right text-slate-500">₹{p.cost_value.toFixed(2)}</td>
                        <td className="py-2 text-right font-bold text-emerald-600">₹{p.profit.toFixed(2)}</td>
                        <td className="py-2 text-right font-extrabold text-blue-600">{p.margin_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'expiry' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2">Batch No</th>
                    <th className="py-2">Product</th>
                    <th className="py-2">Expiry Date</th>
                    <th className="py-2">Days Left</th>
                    <th className="py-2">Qty Remaining</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Markdown Discount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expiryReport.map((b, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-mono font-bold">{b.batch_number}</td>
                      <td className="py-2 font-bold">{b.product_name}</td>
                      <td className="py-2">{b.expiry_date}</td>
                      <td className="py-2 font-bold text-rose-500">{b.days_to_expiry} days</td>
                      <td className="py-2">{b.qty_remaining}</td>
                      <td className="py-2"><Badge variant={b.expiry_status === 'Expired' ? 'danger' : 'warning'}>{b.expiry_status}</Badge></td>
                      <td className="py-2 font-bold text-emerald-600">{b.recommended_discount_pct}% OFF</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'lowstock' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2">SKU</th>
                    <th className="py-2">Product Name</th>
                    <th className="py-2">Current Stock</th>
                    <th className="py-2">Reorder Threshold</th>
                    <th className="py-2">Suggested Reorder Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockReport.map((p, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-mono font-bold">{p.sku}</td>
                      <td className="py-2 font-bold">{p.product_name}</td>
                      <td className="py-2 font-bold text-rose-600">{p.current_stock}</td>
                      <td className="py-2">{p.reorder_threshold}</td>
                      <td className="py-2 font-bold text-blue-600">{p.suggested_reorder_qty} units</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
