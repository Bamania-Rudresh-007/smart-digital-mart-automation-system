import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Shield, Plus, Check } from 'lucide-react';
import Badge from '../../components/Common/Badge';
import Modal from '../../components/Common/Modal';
import api from '../../services/api';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [isRoleModal, setIsRoleModal] = useState(false);
  const [newRole, setNewRole] = useState({ role_name: '', description: '', permission_ids: [] });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'users') {
        const res = await api.get('/users');
        if (res.data.success) setUsers(res.data.data);
      } else {
        const [rRes, pRes] = await Promise.all([
          api.get('/users/meta/roles'),
          api.get('/users/meta/permissions')
        ]);
        setRoles(rRes.data.data || []);
        setPermissions(pRes.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (userId) => {
    try {
      await api.put(`/users/${userId}/status`, { status: 'active' });
      fetchData();
    } catch (err) {
      alert('Error approving user');
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users/meta/roles', newRole);
      setIsRoleModal(false);
      setNewRole({ role_name: '', description: '', permission_ids: [] });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating role');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">User Accounts & RBAC Permission Matrix</h2>
          <p className="text-xs text-slate-500">Approve pending registrations, manage custom roles, and assign module permissions</p>
        </div>
        {activeTab === 'roles' && (
          <button
            onClick={() => setIsRoleModal(true)}
            className="px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" /> <span>Create Custom Role</span>
          </button>
        )}
      </div>

      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
        >
          Staff Directory & Approvals
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'roles' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
        >
          Roles & Granular Permissions
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {activeTab === 'users' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Assigned Store</th>
                  <th className="p-4">Roles</th>
                  <th className="p-4">Account Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">{u.name}</td>
                    <td className="p-4 text-slate-500">{u.email}</td>
                    <td className="p-4 text-slate-700 font-medium">{u.store?.name || 'All Stores'}</td>
                    <td className="p-4">
                      {u.roles?.map(r => <span key={r.id} className="mr-1 text-[11px] font-bold text-blue-600">{r.role_name}</span>)}
                    </td>
                    <td className="p-4">
                      <Badge variant={u.status === 'active' ? 'success' : u.status === 'pending' ? 'warning' : 'danger'}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      {u.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(u.id)}
                          className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-500"
                        >
                          Approve Registration
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Active System & Custom Roles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map(r => (
                <div key={r.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{r.role_name}</h4>
                    {r.is_custom ? <Badge variant="info">Custom Role</Badge> : <Badge variant="default">System Default</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">{r.description}</p>
                  <div className="pt-2 flex flex-wrap gap-1">
                    {r.permissions?.map(p => (
                      <span key={p.id} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 rounded">
                        {p.module}:{p.action}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isRoleModal} onClose={() => setIsRoleModal(false)} title="Create Custom Role with Granular Permissions">
        <form onSubmit={handleCreateRole} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Role Name</label>
            <input
              type="text"
              required
              value={newRole.role_name}
              onChange={(e) => setNewRole({ ...newRole, role_name: e.target.value })}
              placeholder="e.g. Senior Shift Lead"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Description</label>
            <input
              type="text"
              value={newRole.description}
              onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">Select Granular Permissions</label>
            <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-2 border p-3 rounded-xl">
              {permissions.map(p => (
                <label key={p.id} className="flex items-center space-x-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRole.permission_ids.includes(p.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...newRole.permission_ids, p.id]
                        : newRole.permission_ids.filter(id => id !== p.id);
                      setNewRole({ ...newRole, permission_ids: next });
                    }}
                    className="rounded border-slate-300"
                  />
                  <span>{p.module} ({p.action})</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl text-xs">
            Save Custom Role
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default UsersPage;
