import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const Forbidden = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
    <div className="p-4 bg-rose-500/10 text-rose-500 rounded-full">
      <ShieldAlert className="w-12 h-12" />
    </div>
    <h2 className="text-2xl font-black text-slate-900 dark:text-white">403 - Permission Denied</h2>
    <p className="text-xs text-slate-500 max-w-sm">
      Your user account role lacks explicit RBAC permission to access this module. Contact your Store Administrator.
    </p>
    <Link to="/dashboard" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5">
      <ArrowLeft className="w-4 h-4" /> Back to Dashboard
    </Link>
  </div>
);

export const NotFound = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
    <h2 className="text-4xl font-black text-slate-900 dark:text-white">404</h2>
    <p className="text-xs text-slate-500">The requested page or resource could not be found.</p>
    <Link to="/dashboard" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5">
      <ArrowLeft className="w-4 h-4" /> Back to Dashboard
    </Link>
  </div>
);
