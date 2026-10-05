import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice';
import { Bell, User, LogOut, Sun, Moon, Store as StoreIcon, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import { getSocket } from '../../services/socket';

const Navbar = () => {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const [darkMode, setDarkMode] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showAlertMenu, setShowAlertMenu] = useState(false);

  useEffect(() => {
    fetchAlerts();
    const socket = getSocket();
    if (socket) {
      socket.on('alert:new', (newAlert) => {
        setAlerts(prev => [newAlert, ...prev]);
      });
    }
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts?status=new');
      if (res.data.success) {
        setAlerts(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const unreadAlerts = alerts.filter(a => a.status === 'new').length;

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center space-x-3">
        <h1 className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          SDMAS <span className="text-xs text-slate-500 font-normal">v1.0</span>
        </h1>
        {user?.store && (
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300">
            <StoreIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>{user.store.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlertMenu(!showAlertMenu)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadAlerts > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadAlerts}
              </span>
            )}
          </button>

          {showAlertMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Alerts & Notifications</span>
                <span className="text-xs text-blue-600 font-medium">{unreadAlerts} new</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {alerts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No new alerts</div>
                ) : (
                  alerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="p-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        {alert.type.toUpperCase()}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">{alert.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile / User */}
        <div className="flex items-center space-x-3 pl-3 border-l border-slate-200 dark:border-slate-800">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.name}</p>
            <p className="text-[10px] font-medium text-slate-500 uppercase">{user?.roles?.join(', ')}</p>
          </div>
          <button
            onClick={() => dispatch(logout())}
            title="Logout"
            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
