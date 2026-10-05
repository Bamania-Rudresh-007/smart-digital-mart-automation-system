import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Layout from './components/Layout/Layout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import Profile from './pages/Auth/Profile';
import Dashboard from './pages/Dashboard/Dashboard';
import ProductsList from './pages/Products/ProductsList';
import BatchesList from './pages/Batches/BatchesList';
import SuppliersList from './pages/Suppliers/SuppliersList';
import PurchaseOrdersList from './pages/Purchase/PurchaseOrdersList';
import POSBilling from './pages/Sales/POSBilling';
import SalesHistory from './pages/Sales/SalesHistory';
import StockLedger from './pages/Sales/StockLedger';
import ReportsPage from './pages/Reports/ReportsPage';
import AlertsPage from './pages/Alerts/AlertsPage';
import UsersPage from './pages/Users/UsersPage';
import AuditLogsPage from './pages/Audit/AuditLogsPage';
import { Forbidden, NotFound } from './pages/NotFound';
import { initSocket, disconnectSocket } from './services/socket';

const ProtectedRoute = ({ children }) => {
  const { user, token } = useSelector((state) => state.auth);
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App = () => {
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token) {
      initSocket(token);
    }
    return () => disconnectSocket();
  }, [token]);

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected Layout Routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<ProductsList />} />
        <Route path="batches" element={<BatchesList />} />
        <Route path="suppliers" element={<SuppliersList />} />
        <Route path="purchases" element={<PurchaseOrdersList />} />
        <Route path="pos" element={<POSBilling />} />
        <Route path="sales" element={<SalesHistory />} />
        <Route path="ledger" element={<StockLedger />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audits" element={<AuditLogsPage />} />
        <Route path="profile" element={<Profile />} />
        <Route path="forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default App;
