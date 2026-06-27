import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'tecnico')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="relative">
          {/* Outer glow ring */}
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur opacity-40 animate-pulse"></div>
          {/* Inner spinner */}
          <div className="relative w-16 h-16 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // If user is a technician, send to tech dashboard, else admin dashboard
    const redirectPath = profile.role === 'tecnico' ? '/tech' : '/admin';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};
