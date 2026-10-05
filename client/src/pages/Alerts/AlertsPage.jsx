import React, { useState, useEffect } from 'react';
import { Bell, ShieldAlert, CheckCircle, Settings } from 'lucide-react';
import Badge from '../../components/Common/Badge';
import api from '../../services/api';

const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [activeTab, setActiveTab] = useState('alerts');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'alerts') {
        const res = await api.get('/alerts');
        if (res.data.success) setAlerts(res.data.data);
      } else {
        const res = await api.get('/alerts/rules');
        if (res.data.success) setRules(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await api.put(`/alerts/${id}/read`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Alerts & Notification Dispatcher</h2>
        <p className="text-xs text-slate-500">Real-time alerts for expiry breaches, low stock, and 3-way match discrepancies</p>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'alerts' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
        >
          All System Alerts
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'rules' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
        >
          Per-Store Alert Rules
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        {activeTab === 'alerts' ? (
          <div className="space-y-3">
            {alerts.map(a => (
              <div key={a.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
                <div className="flex items-start space-x-3">
                  <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs uppercase">{a.type}</span>
                      <Badge variant={a.status === 'new' ? 'danger' : 'default'}>{a.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{a.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                {a.status === 'new' && (
                  <button onClick={() => markRead(a.id)} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">Configure email and notification dispatch targets per alert trigger type.</p>
            {rules.map(r => (
              <div key={r.id} className="p-4 border rounded-xl flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold uppercase text-slate-900 dark:text-white">{r.alert_type}</h4>
                  <p className="text-slate-500">Recipients: {r.recipient_emails}</p>
                  <p className="text-slate-500">Channels: {r.notification_channels}</p>
                </div>
                <Badge variant="info">Configured</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
