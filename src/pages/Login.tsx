import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

import { KeyRound, Mail, User as UserIcon, Shield, Wrench, Eye, EyeOff } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [roleSelection, setRoleSelection] = useState<'tecnico' | 'admin'>('tecnico');

  const navigate = useNavigate();


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              role: roleSelection,
            },
          },
        });

        if (signUpError) throw signUpError;
        
        if (data.user) {
          setError('Registro exitoso. Iniciando sesión...');
          // Auto log in is default, but wait a bit to fetch profile
          setTimeout(() => {
            navigate(roleSelection === 'admin' ? '/admin' : '/tech');
          }, 1500);
        }
      } else {
        // Log In
        const { data, error: logInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (logInError) throw logInError;

        if (data.user) {
          // Fetch the profile to know where to redirect
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

          if (profileError) throw profileError;

          if (profileData.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/tech');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-md backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative">
        {/* Glow overlay */}
        <div className="absolute -inset-px bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-2xl pointer-events-none -z-10"></div>
        
        {/* Brand / Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3 animate-bounce">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
            ServiControl
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gestión Inteligente de Órdenes de Servicio
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 mb-6">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium transition-all relative ${
              !isSignUp ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setIsSignUp(false);
              setError(null);
            }}
          >
            Iniciar Sesión
            {!isSignUp && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></span>
            )}
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium transition-all relative ${
              isSignUp ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setIsSignUp(true);
              setError(null);
            }}
          >
            Registrarse
            {isSignUp && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-5">
          {error && (
            <div className={`p-3 rounded-lg text-sm transition-all border ${
              error.includes('exitoso') 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {error}
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Nombre Completo
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="email"
                required
                placeholder="usuario@universidad.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Contraseña
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-10 pr-10 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-350 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Selecciona tu Rol
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRoleSelection('tecnico')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${
                    roleSelection === 'tecnico'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-md shadow-indigo-500/5'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  Técnico
                </button>
                <button
                  type="button"
                  onClick={() => setRoleSelection('admin')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${
                    roleSelection === 'admin'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-md shadow-indigo-500/5'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Administrador
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/20 focus:outline-none hover:shadow-indigo-500/30 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : isSignUp ? (
              'Crear Cuenta'
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
