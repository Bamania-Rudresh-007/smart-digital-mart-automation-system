import React, { useState, useEffect } from 'react';
import { Shield, Search, Eye } from 'lucide-react';
import Modal from '../../components/Common/Modal';
import api from '../../services/api';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audits');
      if (res.data.success) setLogs(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs & Compliance Trail</h2>
        <p className="text-xs text-slate-500">Immutable, filterable audit records of all system mutations and user actions</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b text-slate-500 font-bold uppercase">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Action</th>
                <th className="p-4">User</th>
                <th className="p-4">Target Table</th>
                <th className="p-4">Record ID</th>
                <th className="p-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading audit trail...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No audit logs logged yet.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-4 font-bold text-blue-600">{log.action}</td>
                    <td className="p-4 font-medium text-slate-900 dark:text-white">{log.user?.name || `User #${log.user_id}`}</td>
                    <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{log.table_name}</td>
                    <td className="p-4 font-mono text-slate-500">{log.record_id || 'N/A'}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-bold"
                      >
                        Inspect Payload
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Audit Log Payload Inspection">
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-slate-400 uppercase">Old Value (Before):</label>
            <pre className="p-3 bg-slate-900 text-amber-400 rounded-xl font-mono overflow-x-auto mt-1">
              {selectedLog?.old_value ? JSON.stringify(JSON.parse(selectedLog.old_value), null, 2) : 'null'}
            </pre>
          </div>
          <div>
            <label className="font-bold text-slate-400 uppercase">New Value (After):</label>
            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono overflow-x-auto mt-1">
              {selectedLog?.new_value ? JSON.stringify(JSON.parse(selectedLog.new_value), null, 2) : 'null'}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AuditLogsPage;
