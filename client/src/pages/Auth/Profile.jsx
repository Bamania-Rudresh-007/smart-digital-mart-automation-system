import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { User, Shield, Store, Mail, Phone, CheckCircle } from 'lucide-react';
import api from '../../services/api';

const Profile = () => {
  const { user } = useSelector(state => state.auth);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await api.put('/auth/profile', { name, phone });
      setMessage('Profile updated successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">User Profile</h2>
          <p className="text-xs text-slate-500">Manage your account details and security settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Summary Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-black mb-4 shadow-lg shadow-blue-600/30">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{user?.name}</h3>
          <p className="text-xs text-slate-500">{user?.email}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {user?.roles?.map(r => (
              <span key={r} className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-full text-xs font-bold">
                {r}
              </span>
            ))}
          </div>

          <div className="w-full mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3 text-left text-xs">
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
              <Store className="w-4 h-4 text-blue-600" />
              <span>Assigned Store: <strong>{user?.store?.name || 'All Stores (Super Admin)'}</strong></span>
            </div>
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Status: <strong className="uppercase text-emerald-600">{user?.status}</strong></span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Edit Personal Information</h3>

          {message && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> {message}
            </div>
          )}

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Email (Read Only)</label>
              <input
                type="email"
                readOnly
                value={user?.email || ''}
                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors"
            >
              {loading ? 'Saving...' : 'Update Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
