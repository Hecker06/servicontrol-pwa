import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Shield, Wrench, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { profile, logout } = useAuth();

  if (!profile) return null;

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            {profile.role === 'admin' ? (
              <Shield className="w-5 h-5 text-white" />
            ) : (
              <Wrench className="w-5 h-5 text-white" />
            )}
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            ServiControl
          </span>
        </div>

        {/* User Info & Action */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <User className="w-4 h-4 text-slate-350" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-slate-200">{profile.name || 'Usuario'}</p>
              <p className="text-xs text-slate-400 capitalize">{profile.role}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize border ${
                profile.role === 'admin'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}
            >
              {profile.role === 'admin' ? 'Admin' : 'Técnico'}
            </span>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/20 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-500/20 transition-all text-xs font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </nav>
  );
};
