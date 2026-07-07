import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Navbar } from '../../components/Navbar';
import { 
  Plus, Users, ClipboardList, CheckCircle2, AlertCircle, Clock, Eye, 
  MapPin, X, Calendar, User, Phone, FileText, Pencil, Package 
} from 'lucide-react';
import { inventoryDb, type OrderItem } from '../../lib/inventoryDb';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet Marker icon issue in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Order {
  id: string;
  client_id: string;
  technician_id: string | null;
  status: 'Pendiente' | 'Asignada' | 'En progreso' | 'Completada' | 'Cancelada';
  scheduled_at: string;
  description: string;
  created_at: string;
  clients: { name: string; phone: string } | null;
  technician: { name: string; email: string } | null;
}

interface Evidence {
  id: string;
  url: string;
  is_reference: boolean;
  created_at: string;
}

interface LocationCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

export const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected order details for modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedEvidences, setSelectedEvidences] = useState<Evidence[]>([]);
  const [selectedTargetLocation, setSelectedTargetLocation] = useState<LocationCoords | null>(null);
  const [selectedActualLocation, setSelectedActualLocation] = useState<LocationCoords | null>(null);
  const [selectedObservations, setSelectedObservations] = useState<{ comment: string; created_at: string }[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<OrderItem[]>([]);
  const [loadingModalData, setLoadingModalData] = useState(false);

  const navigate = useNavigate();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('service_orders')
        .select(`
          *,
          clients (name, phone),
          technician:profiles!service_orders_technician_id_fkey (name, email)
        `)
        .order('scheduled_at', { ascending: false });

      if (dbError) throw dbError;
      setOrders(data as Order[]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar las órdenes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleViewDetails = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingModalData(true);
    try {
      // Fetch evidences
      const { data: evidenceData } = await supabase
        .from('evidences')
        .select('*')
        .eq('order_id', order.id);
      setSelectedEvidences(evidenceData || []);

      // Fetch locations (target vs actual)
      const { data: locationData } = await supabase
        .from('locations')
        .select('*')
        .eq('order_id', order.id);
      
      const target = locationData?.find((l: any) => l.is_target === true);
      const actual = locationData?.find((l: any) => l.is_target === false);

      const targetCoordsObj = target ? { 
        latitude: Number(target.latitude), 
        longitude: Number(target.longitude),
        address: target.address || undefined
      } : null;
      
      const actualCoordsObj = actual ? { 
        latitude: Number(actual.latitude), 
        longitude: Number(actual.longitude),
        address: actual.address || undefined
      } : null;

      setSelectedTargetLocation(targetCoordsObj);
      setSelectedActualLocation(actualCoordsObj);

      const getAddressFromCoords = async (lat: number, lon: number): Promise<string> => {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=es`, {
            headers: { 'User-Agent': 'ServiControl-PWA/1.0' }
          });
          if (!response.ok) throw new Error();
          const data = await response.json();
          return data.display_name || 'Dirección desconocida';
        } catch {
          return 'No se pudo obtener la dirección exacta';
        }
      };

      if (targetCoordsObj && !targetCoordsObj.address) {
        getAddressFromCoords(targetCoordsObj.latitude, targetCoordsObj.longitude).then(addr => {
          setSelectedTargetLocation(prev => prev ? { ...prev, address: addr } : null);
        });
      }

      if (actualCoordsObj && !actualCoordsObj.address) {
        getAddressFromCoords(actualCoordsObj.latitude, actualCoordsObj.longitude).then(addr => {
          setSelectedActualLocation(prev => prev ? { ...prev, address: addr } : null);
        });
      }

      // Fetch observations
      const { data: obsData } = await supabase
        .from('observations')
        .select('comment, created_at')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      setSelectedObservations(obsData || []);

      // Fetch materials
      const materialsData = await inventoryDb.getOrderItems(order.id);
      setSelectedMaterials(materialsData || []);

    } catch (err) {
      console.error('Error fetching modal details:', err);
    } finally {
      setLoadingModalData(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completada':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'En progreso':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Asignada':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Cancelada':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  // KPI calculations
  const totalCount = orders.length;
  const pendingCount = orders.filter(o => o.status === 'Pendiente').length;
  const assignedCount = orders.filter(o => o.status === 'Asignada').length;
  const inProgressCount = orders.filter(o => o.status === 'En progreso').length;
  const completedCount = orders.filter(o => o.status === 'Completada').length;

  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === 'todos' || order.status === statusFilter;
    const matchesSearch = 
      order.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.clients?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.technician?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 mt-8">
        {/* Title and Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Panel del Administrador
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Supervisión de técnicos, asignaciones e historial de servicios.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/admin/clients')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-350 hover:text-slate-100 hover:border-slate-700 transition-all text-sm font-semibold cursor-pointer"
            >
              <Users className="w-4 h-4" />
              Ver Clientes
            </button>
            <button
              onClick={() => navigate('/admin/orders/new')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all text-sm font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nueva Orden
            </button>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Órdenes Totales</span>
              <ClipboardList className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-3xl font-extrabold text-slate-100">{totalCount}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pendientes</span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl font-extrabold text-slate-100">{pendingCount}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Asignadas</span>
              <AlertCircle className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-3xl font-extrabold text-slate-100">{assignedCount}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">En Curso</span>
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping"></div>
            </div>
            <p className="text-3xl font-extrabold text-slate-100">{inProgressCount}</p>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Completadas</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-3xl font-extrabold text-slate-100">{completedCount}</p>
          </div>
        </div>

        {/* Filters and List */}
        <div className="bg-slate-900/40 border border-slate-800/85 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            {/* Search Input */}
            <div className="w-full md:w-80">
              <input
                type="text"
                placeholder="Buscar por cliente, técnico, descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-4 text-slate-150 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {['todos', 'Pendiente', 'Asignada', 'En progreso', 'Completada', 'Cancelada'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize cursor-pointer transition-all ${
                    statusFilter === tab
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                      : 'bg-slate-950/40 border-slate-800 text-slate-450 hover:text-slate-200'
                  }`}
                >
                  {tab === 'todos' ? 'Todos' : tab}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl mb-6 text-sm">{error}</div>}

          {/* Orders Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No se encontraron órdenes de servicio que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-4 px-4">Cliente</th>
                    <th className="py-4 px-4">Técnico</th>
                    <th className="py-4 px-4">Descripción</th>
                    <th className="py-4 px-4">Fecha Programada</th>
                    <th className="py-4 px-4">Estado</th>
                    <th className="py-4 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-4 px-4 font-semibold text-slate-250">
                        {order.clients?.name || 'Cliente sin nombre'}
                      </td>
                      <td className="py-4 px-4 text-slate-350 flex items-center gap-2">
                        {order.technician ? (
                          <>
                            <User className="w-4 h-4 text-slate-500" />
                            <span>{order.technician.name}</span>
                          </>
                        ) : (
                          <span className="text-slate-550 italic">Sin asignar</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-400 max-w-xs truncate">
                        {order.description}
                      </td>
                      <td className="py-4 px-4 text-slate-350">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span>
                            {new Date(order.scheduled_at).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(order)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-950/20 hover:text-indigo-400 text-slate-350 border border-slate-750 hover:border-indigo-500/20 transition-all text-xs font-semibold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detalles
                        </button>
                        <button
                          onClick={() => navigate(`/admin/orders/edit/${order.id}`)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-950/20 hover:text-indigo-400 text-slate-300 border border-slate-750 hover:border-indigo-500/20 transition-all text-xs font-semibold cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Details & Evidence Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-400" />
                  Orden de Servicio
                </h3>
                <p className="text-slate-400 text-xs mt-1">ID: {selectedOrder.id}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setSelectedEvidences([]);
                  setSelectedTargetLocation(null);
                  setSelectedActualLocation(null);
                  setSelectedObservations([]);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-450 hover:text-slate-200 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {loadingModalData ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Info & Comments */}
                  <div className="space-y-6">
                    {/* General details */}
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-3.5">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">Información del Servicio</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2.5">
                          <User className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div>
                            <p className="text-slate-400 text-xs">Cliente</p>
                            <p className="font-semibold text-slate-200">{selectedOrder.clients?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Phone className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div>
                            <p className="text-slate-400 text-xs">Teléfono Cliente</p>
                            <p className="text-slate-250">{selectedOrder.clients?.phone || 'Sin teléfono'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <User className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div>
                            <p className="text-slate-400 text-xs">Técnico Asignado</p>
                            <p className="font-semibold text-slate-200">
                              {selectedOrder.technician?.name || 'Técnico no asignado'}
                            </p>
                            {selectedOrder.technician && <p className="text-slate-500 text-xs">{selectedOrder.technician.email}</p>}
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div>
                            <p className="text-slate-400 text-xs">Descripción</p>
                            <p className="text-slate-250 italic bg-slate-950/20 p-2.5 rounded-lg border border-slate-800/40 mt-1 whitespace-pre-wrap">
                              "{selectedOrder.description}"
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-850 pt-2.5 mt-2.5">
                          <span className="text-slate-400 text-xs">Estado de la Orden</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(selectedOrder.status)}`}>
                            {selectedOrder.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Observations */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">Historial de Observaciones</h4>
                      {selectedObservations.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No hay comentarios en esta orden.</p>
                      ) : (
                        <div className="space-y-3.5">
                          {selectedObservations.map((obs, idx) => (
                            <div key={idx} className="bg-slate-950/20 border border-slate-800/50 rounded-xl p-3.5 text-sm">
                              <p className="text-slate-200">{obs.comment}</p>
                              <p className="text-[10px] text-slate-550 mt-1.5">
                                {new Date(obs.created_at).toLocaleString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Materials utilized list */}
                    <div className="space-y-2 border-t border-slate-800/80 pt-4">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 font-sans">
                        <Package className="w-4 h-4" />
                        Insumos y Materiales Utilizados
                      </h4>
                      {selectedMaterials.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No se han registrado materiales consumidos en esta orden.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          {selectedMaterials.map((mat) => (
                            <div key={mat.id} className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <p className="font-semibold text-slate-200">{mat.inventory_items?.name || 'Insumo'}</p>
                                <p className="text-slate-500 text-[10px] mt-0.5">{mat.inventory_items?.unit || 'unidad'}</p>
                              </div>
                              <span className="font-bold text-indigo-400 text-sm">{mat.quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Evidences & Location Map */}
                  <div className="space-y-6">
                    {/* Photos Section */}
                    <div className="space-y-4">
                      {/* Reference Images */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">Imágenes de Referencia (Admin)</h4>
                        {selectedEvidences.filter(e => e.is_reference === true).length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No hay imágenes de referencia subidas por el administrador.</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {selectedEvidences.filter(e => e.is_reference === true).map((ev) => (
                              <div key={ev.id} className="relative group border border-slate-800 rounded-lg overflow-hidden shadow bg-slate-950 aspect-square">
                                <img
                                  src={ev.url}
                                  alt="Referencia"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-all"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Technician Evidences */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">Evidencias del Servicio (Técnico)</h4>
                        {selectedEvidences.filter(e => e.is_reference !== true).length === 0 ? (
                          <p className="text-xs text-slate-500 italic">El técnico aún no ha subido fotografías de evidencia.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            {selectedEvidences.filter(e => e.is_reference !== true).map((ev) => (
                              <div key={ev.id} className="relative group border border-slate-800 rounded-xl overflow-hidden shadow bg-slate-950 aspect-video">
                                <img
                                  src={ev.url}
                                  alt="Evidencia"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-all"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Map Pin */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-rose-500 animate-bounce" />
                        Ubicaciones del Servicio
                      </h4>
                      {selectedTargetLocation || selectedActualLocation ? (
                        <div className="space-y-3">
                          <div className="border border-slate-800 rounded-xl overflow-hidden h-60 bg-slate-950 relative z-10">
                            <MapContainer
                              center={
                                selectedActualLocation 
                                  ? [selectedActualLocation.latitude, selectedActualLocation.longitude] 
                                  : selectedTargetLocation 
                                    ? [selectedTargetLocation.latitude, selectedTargetLocation.longitude] 
                                    : [19.4326, -99.1332]
                              }
                              zoom={14}
                              scrollWheelZoom={false}
                              style={{ height: '100%', width: '100%' }}
                            >
                              <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              
                              {/* Target location marker */}
                              {selectedTargetLocation && (
                                <Marker position={[selectedTargetLocation.latitude, selectedTargetLocation.longitude]}>
                                  <Popup>
                                    <div className="text-slate-900 text-xs">
                                      <strong>Ubicación Objetivo (Admin)</strong>
                                      <p>Lat: {selectedTargetLocation.latitude}</p>
                                      <p>Lng: {selectedTargetLocation.longitude}</p>
                                    </div>
                                  </Popup>
                                </Marker>
                              )}

                              {/* Actual location marker */}
                              {selectedActualLocation && (
                                <Marker position={[selectedActualLocation.latitude, selectedActualLocation.longitude]}>
                                  <Popup>
                                    <div className="text-slate-900 text-xs">
                                      <strong>Ubicación de Visita (Técnico)</strong>
                                      <p>Lat: {selectedActualLocation.latitude}</p>
                                      <p>Lng: {selectedActualLocation.longitude}</p>
                                    </div>
                                  </Popup>
                                </Marker>
                              )}
                            </MapContainer>
                          </div>
                          
                          {/* Human-readable addresses display */}
                          <div className="space-y-2">
                            {selectedTargetLocation?.address && (
                              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl text-xs leading-relaxed text-slate-350">
                                <p className="font-semibold text-indigo-400">Dirección Objetivo (Cliente):</p>
                                <p className="text-slate-300 mt-1">{selectedTargetLocation.address}</p>
                              </div>
                            )}
                            {selectedActualLocation?.address && (
                              <div className="bg-slate-950/45 border border-emerald-950/30 bg-emerald-950/5 p-3 rounded-xl text-xs leading-relaxed text-slate-350">
                                <p className="font-semibold text-emerald-450">Dirección Registrada (Técnico):</p>
                                <p className="text-slate-300 mt-1">{selectedActualLocation.address}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-1">
                                  Coords: {selectedActualLocation.latitude.toFixed(6)}, {selectedActualLocation.longitude.toFixed(6)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 border border-slate-800 border-dashed rounded-xl bg-slate-950/20 text-slate-500">
                          <MapPin className="w-8 h-8 text-slate-650 mb-1.5" />
                          <p className="text-sm italic">Ubicaciones (objetivo o visita) no registradas.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setSelectedEvidences([]);
                  setSelectedTargetLocation(null);
                  setSelectedActualLocation(null);
                  setSelectedObservations([]);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 transition-all text-sm font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
