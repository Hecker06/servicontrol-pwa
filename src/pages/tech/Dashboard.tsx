import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { Clock, ClipboardList, ChevronRight } from 'lucide-react';

interface Order {
  id: string;
  client_id: string;
  technician_id: string;
  status: 'Pendiente' | 'Asignada' | 'En progreso' | 'Completada' | 'Cancelada';
  scheduled_at: string;
  description: string;
  created_at: string;
  clients: { name: string; phone: string } | null;
}

export const TechDashboard: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'activas' | 'completadas'>('activas');

  const navigate = useNavigate();

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('service_orders')
        .select(`
          *,
          clients (name, phone)
        `)
        .eq('technician_id', user.id)
        .order('scheduled_at', { ascending: true });

      if (dbError) throw dbError;
      setOrders(data as Order[]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar tus órdenes de servicio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completada':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'En progreso':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Asignada':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  // KPI Calculations
  const activeOrders = orders.filter(o => o.status !== 'Completada' && o.status !== 'Cancelada');
  const completedOrders = orders.filter(o => o.status === 'Completada');
  const enProgresoOrders = orders.filter(o => o.status === 'En progreso');

  const displayedOrders = filter === 'activas' ? activeOrders : completedOrders;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <Navbar />

      <div className="max-w-md mx-auto px-4 mt-6 sm:max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Mis Servicios
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Consulta y gestiona las órdenes de servicio que tienes asignadas.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm text-center">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block">Asignadas</span>
            <span className="text-xl font-extrabold text-slate-100 mt-1 block">
              {activeOrders.filter(o => o.status === 'Asignada').length}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm text-center relative overflow-hidden">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block">En Curso</span>
            <span className="text-xl font-extrabold text-blue-400 mt-1 block">
              {enProgresoOrders.length}
            </span>
            {enProgresoOrders.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm text-center">
            <span className="text-slate-400 text-[10px] uppercase font-semibold block">Completadas</span>
            <span className="text-xl font-extrabold text-emerald-450 mt-1 block">
              {completedOrders.length}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-900/60 p-1 border border-slate-800/80 rounded-xl mb-5">
          <button
            onClick={() => setFilter('activas')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filter === 'activas'
                ? 'bg-slate-800 text-slate-100 border border-slate-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Servicios Activos ({activeOrders.length})
          </button>
          <button
            onClick={() => setFilter('completadas')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filter === 'completadas'
                ? 'bg-slate-800 text-slate-100 border border-slate-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Completados ({completedOrders.length})
          </button>
        </div>

        {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl mb-6 text-sm">{error}</div>}

        {/* Order List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-slate-850 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="bg-slate-900/20 border border-slate-900/60 border-dashed rounded-2xl py-12 text-center text-slate-500">
            <ClipboardList className="w-10 h-10 text-slate-700 mx-auto mb-2" />
            <p className="text-sm">No tienes órdenes en esta sección.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/tech/orders/${order.id}`)}
                className="bg-slate-900/65 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 shadow transition-all cursor-pointer group relative overflow-hidden"
              >
                {/* Glow strip */}
                <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-blue-600 to-indigo-600"></div>

                <div className="flex items-start justify-between mb-3.5 pl-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                    {order.status === 'En progreso' && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {new Date(order.scheduled_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="pl-2 space-y-2">
                  <h3 className="font-bold text-slate-150 text-base group-hover:text-indigo-400 transition-colors">
                    {order.clients?.name || 'Cliente sin nombre'}
                  </h3>
                  <p className="text-slate-450 text-xs line-clamp-2 italic leading-relaxed">
                    "{order.description}"
                  </p>
                </div>

                <div className="flex justify-end items-center mt-4 pt-3 border-t border-slate-850/60 text-indigo-400 text-xs font-semibold pl-2">
                  <span className="group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Ver Detalles
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
