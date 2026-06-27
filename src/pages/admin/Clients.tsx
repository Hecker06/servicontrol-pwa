import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Navbar } from '../../components/Navbar';
import { ChevronLeft, Plus, UserPlus, Phone, User, Trash2, Save } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
}

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New client form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const navigate = useNavigate();

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (dbError) throw dbError;
      setClients(data as Client[]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setAdding(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from('clients')
        .insert([{ name, phone: phone || null }]);

      if (insertError) throw insertError;
      
      setName('');
      setPhone('');
      setShowAddForm(false);
      fetchClients();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al agregar cliente');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este cliente? Se eliminarán todas sus órdenes asociadas.')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchClients();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al eliminar cliente');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 mt-8">
        {/* Navigation & Header */}
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-slate-450 hover:text-slate-200 transition-all text-sm mb-6 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver al Panel
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              <User className="w-8 h-8 text-indigo-400" />
              Gestión de Clientes
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Registra y administra las cuentas de clientes asociadas a los servicios.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all text-sm font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>

        {/* Add Client Form */}
        {showAddForm && (
          <div className="bg-slate-900/40 border border-slate-800/85 rounded-2xl p-6 shadow-xl mb-8 relative">
            <div className="absolute -inset-px bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-2xl pointer-events-none -z-10"></div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-400">
              <UserPlus className="w-5 h-5" />
              Registrar Nuevo Cliente
            </h3>
            <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Institución o Persona"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Teléfono / Contacto
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="+52 555-5555"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 md:col-span-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-slate-200 transition-all text-sm font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all text-sm cursor-pointer"
                >
                  {adding ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Registrar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl mb-6 text-sm">{error}</div>}

        {/* Clients List */}
        <div className="bg-slate-900/40 border border-slate-800/85 rounded-2xl p-6 shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No hay clientes registrados en el sistema. Registra uno usando el botón superior.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-3 px-4">Nombre del Cliente</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Fecha de Registro</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-200">{client.name}</td>
                      <td className="py-3.5 px-4 text-slate-350">
                        {client.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            {client.phone}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">No registrado</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(client.created_at).toLocaleDateString('es-ES')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-800/50 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 border border-slate-750 hover:border-rose-500/20 transition-all cursor-pointer"
                          title="Eliminar Cliente"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
};
