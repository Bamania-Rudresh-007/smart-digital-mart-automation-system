import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  LayoutDashboard, Package, CalendarDays, Truck, ShoppingCart, 
  Receipt, History, FileText, Bell, Users, Shield, User, Settings
} from 'lucide-react';

const Sidebar = () => {
  const { user } = useSelector(state => state.auth);
  const roles = user?.roles || [];
  const isSuperAdmin = roles.includes('Super Admin');
  const isManager = roles.includes('Store Manager');
  const isInventory = roles.includes('Inventory Staff');
  const isProcurement = roles.includes('Procurement Officer');
  const isCashier = roles.includes('Cashier');
  const isAuditor = roles.includes('Auditor');

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, show: true },
    { label: 'Products & Categories', path: '/products', icon: Package, show: isSuperAdmin || isManager || isInventory || isProcurement || isAuditor },
    { label: 'Batches & Expiry', path: '/batches', icon: CalendarDays, show: isSuperAdmin || isManager || isInventory || isAuditor },
    { label: 'Suppliers', path: '/suppliers', icon: Truck, show: isSuperAdmin || isManager || isProcurement || isAuditor },
    { label: 'Purchase Orders (3-Way)', path: '/purchases', icon: ShoppingCart, show: isSuperAdmin || isManager || isProcurement || isInventory || isAuditor },
    { label: 'POS Billing', path: '/pos', icon: Receipt, show: isSuperAdmin || isManager || isCashier },
    { label: 'Sales History', path: '/sales', icon: History, show: isSuperAdmin || isManager || isCashier || isAuditor },
    { label: 'Stock Ledger', path: '/ledger', icon: History, show: isSuperAdmin || isManager || isInventory || isAuditor },
    { label: 'Reports & Analytics', path: '/reports', icon: FileText, show: isSuperAdmin || isManager || isProcurement || isAuditor },
    { label: 'Alerts & Rules', path: '/alerts', icon: Bell, show: true },
    { label: 'Users & Custom Roles', path: '/users', icon: Users, show: isSuperAdmin || isManager },
    { label: 'Audit Logs', path: '/audits', icon: Shield, show: isSuperAdmin || isAuditor },
    { label: 'My Profile', path: '/profile', icon: User, show: true },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 flex-1 space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Navigation Menu</div>
        {navItems.filter(i => i.show).map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;
