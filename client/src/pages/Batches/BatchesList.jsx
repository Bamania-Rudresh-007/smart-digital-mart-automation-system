import React, { useState, useEffect } from 'react';
import { CalendarDays, RefreshCw, AlertTriangle, CheckCircle, Tag } from 'lucide-react';
import Badge from '../../components/Common/Badge';
import api from '../../services/api';

const BatchesList = () => {
  const [batches, setBatches] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, [statusFilter]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      let url = '/batches';
      if (statusFilter) url += `?status=${statusFilter}`;
      const res = await api.get(url);
      if (res.data.success) {
        setBatches(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    try {
      await api.post('/batches/scan-expiry');
      alert('Expiry scan execution completed!');
      fetchBatches();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Batch & Expiry Control Center</h2>
          <p className="text-xs text-slate-500">Track manufacturing lots, expiry status, purchase & selling price (MRP)</p>
        </div>
        <button
          onClick={handleScan}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-blue-600/20 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Trigger Daily Expiry Job</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { label: 'All Batches', value: '' },
          { label: 'Healthy', value: 'Healthy' },
          { label: 'Near Expiry', value: 'Near Expiry' },
          { label: 'Expired', value: 'Expired' }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === tab.value
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Batches Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">Batch No</th>
                <th className="p-4">Product Name</th>
                <th className="p-4">Mfg Date</th>
                <th className="p-4">Expiry Date</th>
                <th className="p-4">Purchase Price</th>
                <th className="p-4">MRP / Selling Price</th>
                <th className="p-4">Qty Remaining</th>
                <th className="p-4">Status & Markdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">Loading batch records...</td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">No batch records found.</td></tr>
              ) : (
                batches.map((b) => {
                  const isExpired = b.expiry_status === 'Expired';
                  const isNear = b.expiry_status === 'Near Expiry';
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">{b.batch_number}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{b.product?.name || 'N/A'}</td>
                      <td className="p-4 text-slate-500">{b.mfg_date || 'N/A'}</td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{b.expiry_date}</td>
                      <td className="p-4 text-slate-500">₹{parseFloat(b.purchase_price).toFixed(2)}</td>
                      <td className="p-4 font-bold text-emerald-600">₹{parseFloat(b.selling_price).toFixed(2)}</td>
                      <td className="p-4 font-extrabold text-slate-900 dark:text-white">{b.qty_remaining} / {b.qty_received}</td>
                      <td className="p-4">
                        {isExpired && <Badge variant="danger">EXPIRED (Write-Off)</Badge>}
                        {isNear && <Badge variant="warning">NEAR EXPIRY (Markdown Discount Suggested)</Badge>}
                        {!isExpired && !isNear && <Badge variant="success">Healthy</Badge>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BatchesList;
