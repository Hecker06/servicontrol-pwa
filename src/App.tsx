import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/admin/Dashboard';
import { OrderForm } from './pages/admin/OrderForm';
import { Clients } from './pages/admin/Clients';
import { Inventory } from './pages/admin/Inventory';
import { TechDashboard } from './pages/tech/Dashboard';
import { TechOrderDetail } from './pages/tech/OrderDetail';

const RoleBasedRedirect: React.FC = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur opacity-40 animate-pulse"></div>
          <div className="relative w-16 h-16 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return profile?.role === 'admin' ? (
    <Navigate to="/admin" replace />
  ) : (
    <Navigate to="/tech" replace />
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders/new"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OrderForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders/edit/:id"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OrderForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/clients"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/inventory"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Inventory />
              </ProtectedRoute>
            }
          />

          {/* Technician Protected Routes */}
          <Route
            path="/tech"
            element={
              <ProtectedRoute allowedRoles={['tecnico']}>
                <TechDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tech/orders/:id"
            element={
              <ProtectedRoute allowedRoles={['tecnico']}>
                <TechOrderDetail />
              </ProtectedRoute>
            }
          />

          {/* Default Redirection */}
          <Route path="/" element={<RoleBasedRedirect />} />
          <Route path="*" element={<RoleBasedRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
