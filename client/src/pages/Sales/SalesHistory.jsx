import React, { useState, useEffect } from 'react';
import { History, Eye, Receipt, Calendar } from 'lucide-react';
import Badge from '../../components/Common/Badge';
import Modal from '../../components/Common/Modal';
import api from '../../services/api';

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales');
      if (res.data.success) setSales(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sales & POS History</h2>
        <p className="text-xs text-slate-500">Historical records of sales invoices and item batch deductions</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">Invoice #</th>
                <th className="p-4">Sale Date & Time</th>
                <th className="p-4">Cashier</th>
                <th className="p-4">Payment Mode</th>
                <th className="p-4">Total Items</th>
                <th className="p-4">Net Amount</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Loading sales records...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No sales transactions found.</td></tr>
              ) : (
                sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-mono font-bold text-blue-600">{s.invoice_no}</td>
                    <td className="p-4 text-slate-500">{new Date(s.sale_date).toLocaleString()}</td>
                    <td className="p-4 font-medium text-slate-900 dark:text-white">{s.cashier?.name || 'N/A'}</td>
                    <td className="p-4"><Badge variant="info">{s.payment_mode}</Badge></td>
                    <td className="p-4 text-slate-500">{s.items?.length || 0} items</td>
                    <td className="p-4 font-extrabold text-slate-900 dark:text-white">₹{parseFloat(s.net_amount).toFixed(2)}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedSale(s)}
                        className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title={`Invoice ${selectedSale?.invoice_no}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
            <div><strong>Cashier:</strong> {selectedSale?.cashier?.name}</div>
            <div><strong>Payment Mode:</strong> {selectedSale?.payment_mode}</div>
            <div><strong>Subtotal:</strong> ₹{selectedSale?.total_amount}</div>
            <div><strong>Net Amount Paid:</strong> <span className="text-emerald-600 font-bold">₹{selectedSale?.net_amount}</span></div>
          </div>

          <h4 className="font-bold text-xs uppercase text-slate-400">Items Sold & FEFO Cost Allocation</h4>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-1">Product</th>
                <th className="py-1">Batch</th>
                <th className="py-1">Qty</th>
                <th className="py-1">Unit Price</th>
                <th className="py-1">Batch Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedSale?.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 font-bold">{item.product?.name}</td>
                  <td className="py-2 font-mono text-slate-500">{item.batch?.batch_number}</td>
                  <td className="py-2">{item.qty_sold}</td>
                  <td className="py-2">₹{item.unit_selling_price}</td>
                  <td className="py-2 text-slate-500">₹{item.unit_cost_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
};

export default SalesHistory;
