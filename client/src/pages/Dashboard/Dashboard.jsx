import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import StatCard from '../../components/Common/StatCard';
import Badge from '../../components/Common/Badge';
import { 
  Package, AlertTriangle, CalendarDays, IndianRupee, 
  Receipt, ShoppingCart, RefreshCw, ArrowRight 
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import api from '../../services/api';

const Dashboard = () => {
  const { user } = useSelector(state => state.auth);
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    nearExpiryCount: 0,
    totalSales: 0
  });
  const [salesTrend, setSalesTrend] = useState([]);
  const [lowStockList, setLowStockList] = useState([]);
  const [nearExpiryList, setNearExpiryList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [prodRes, lowRes, expRes, salesRes] = await Promise.all([
        api.get('/products?limit=1'),
        api.get('/reports/low-stock'),
        api.get('/reports/expiry?days=30'),
        api.get('/reports/sales')
      ]);

      const totalProd = prodRes.data.pagination?.total || 0;
      const lowCount = (lowRes.data.data || []).length;
      const expCount = (expRes.data.data || []).length;
      const totalRev = salesRes.data.data?.metrics?.totalRevenue || 0;

      setStats({
        totalProducts: totalProd,
        lowStockCount: lowCount,
        nearExpiryCount: expCount,
        totalSales: totalRev
      });

      setLowStockList((lowRes.data.data || []).slice(0, 5));
      setNearExpiryList((expRes.data.data || []).slice(0, 5));

      // Dummy sales trend data for chart visualization
      setSalesTrend([
        { date: 'Mon', revenue: 12400, profit: 3200 },
        { date: 'Tue', revenue: 18500, profit: 4800 },
        { date: 'Wed', revenue: 14200, profit: 3900 },
        { date: 'Thu', revenue: 22100, profit: 6100 },
        { date: 'Fri', revenue: 29800, profit: 8400 },
        { date: 'Sat', revenue: 38400, profit: 10200 },
        { date: 'Sun', revenue: 31200, profit: 8900 },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanExpiry = async () => {
    try {
      await api.post('/batches/scan-expiry');
      alert('Manual batch expiry scan completed!');
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Store Command Dashboard
          </h2>
          <p className="text-xs text-slate-500">
            Real-time inventory metrics, FEFO batch status & POS operations
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleScanExpiry}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            <span>Run Expiry Scan</span>
          </button>

          {(user?.roles?.includes('Cashier') || user?.roles?.includes('Super Admin') || user?.roles?.includes('Store Manager')) && (
            <Link
              to="/pos"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/25 flex items-center space-x-1.5 hover:from-blue-500 hover:to-indigo-500 transition-all"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Launch POS Billing</span>
            </Link>
          )}
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={Package}
          color="blue"
          trend="Active store SKUs"
        />
        <StatCard
          title="Low Stock Breach"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          color="amber"
          trend="Below reorder threshold"
        />
        <StatCard
          title="Near Expiry Batches"
          value={stats.nearExpiryCount}
          icon={CalendarDays}
          color="rose"
          trend="Expiring in < 30 days"
        />
        <StatCard
          title="Sales Revenue"
          value={`₹${stats.totalSales.toLocaleString('en-IN')}`}
          icon={IndianRupee}
          color="emerald"
          trend="FEFO Deducted Revenue"
        />
      </div>

      {/* Chart Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revenue & Gross Margin Trend</h3>
            <p className="text-xs text-slate-500">Real-time daily sales revenue vs batch profit margin</p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesTrend}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" fillOpacity={1} fill="url(#colorRev)" name="Revenue (₹)" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" name="Gross Profit (₹)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock Alerts
            </h3>
            <Link to="/reports" className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Stock</th>
                  <th className="pb-2">Threshold</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lowStockList.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">All products adequately stocked!</td></tr>
                ) : (
                  lowStockList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{item.product_name}</td>
                      <td className="py-2.5 font-bold text-rose-600">{item.current_stock}</td>
                      <td className="py-2.5 text-slate-500">{item.reorder_threshold}</td>
                      <td className="py-2.5"><Badge variant="warning">Low Stock</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Near Expiry Batches */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-rose-500" /> Expiry Risk Watchlist
            </h3>
            <Link to="/batches" className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="pb-2">Batch No</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Days Left</th>
                  <th className="pb-2">Markdown %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nearExpiryList.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">No near-expiry batches detected.</td></tr>
                ) : (
                  nearExpiryList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 font-mono text-slate-700 dark:text-slate-300">{item.batch_number}</td>
                      <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">{item.product_name}</td>
                      <td className="py-2.5 font-bold text-rose-500">{item.days_to_expiry} days</td>
                      <td className="py-2.5">
                        <Badge variant="danger">
                          {item.recommended_discount_pct}% OFF
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
