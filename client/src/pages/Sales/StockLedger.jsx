import React, { useState, useEffect } from 'react';
import { History, Shield, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import Badge from '../../components/Common/Badge';
import api from '../../services/api';

const StockLedger = () => {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales/ledger');
      if (res.data.success) setLedger(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getTxnBadge = (type) => {
    switch (type) {
      case 'purchase': return <Badge variant="success">Purchase Receipt</Badge>;
      case 'sale': return <Badge variant="info">Sale Deduction</Badge>;
      case 'damage': return <Badge variant="danger">Damage Write-Off</Badge>;
      default: return <Badge variant="default">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Real-Time Stock Ledger (Immutable Audit Trail)</h2>
        <p className="text-xs text-slate-500">Every inventory event automatically appends an audit-proof ledger row with balance calculation</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Txn Type</th>
                <th className="p-4">Product Name</th>
                <th className="p-4">Batch Number</th>
                <th className="p-4">Quantity Change</th>
                <th className="p-4">Balance After</th>
                <th className="p-4">Reference ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Loading stock ledger trail...</td></tr>
              ) : ledger.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No stock ledger entries found.</td></tr>
              ) : (
                ledger.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-mono text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="p-4">{getTxnBadge(row.txn_type)}</td>
                    <td className="p-4 font-bold text-slate-900 dark:text-white">{row.product?.name || 'N/A'}</td>
                    <td className="p-4 font-mono text-slate-500">{row.batch?.batch_number || 'N/A'}</td>
                    <td className={`p-4 font-extrabold flex items-center gap-1 ${row.qty > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {row.qty > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                      {row.qty > 0 ? `+${row.qty}` : row.qty}
                    </td>
                    <td className="p-4 font-extrabold text-slate-900 dark:text-white">{row.balance_after}</td>
                    <td className="p-4 font-mono text-slate-500">{row.ref_id || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockLedger;
