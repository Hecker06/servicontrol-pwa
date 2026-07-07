import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryDb, type InventoryItem } from '../../lib/inventoryDb';
import { Navbar } from '../../components/Navbar';
import { 
  Plus, Search, Trash2, Edit, ChevronLeft, 
  Package, AlertTriangle, Minus, Save, X, RotateCcw
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'todos' | 'agotados' | 'bajo_stock' | 'disponibles'>('todos');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stock, setStock] = useState<number>(0);
  const [unit, setUnit] = useState('unidad');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await inventoryDb.getInventoryItems();
      setItems(data);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar el inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setDescription('');
    setStock(0);
    setUnit('unidades');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || '');
    setStock(item.stock);
    setUnit(item.unit);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('El nombre del producto es obligatorio.');
      return;
    }
    if (stock < 0) {
      setFormError('El stock no puede ser negativo.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingItem) {
        // Update
        const updated = await inventoryDb.updateInventoryItem(editingItem.id, {
          name,
          description: description || null,
          stock,
          unit
        });
        setItems(prev => prev.map(i => i.id === editingItem.id ? updated : i));
      } else {
        // Create
        const created = await inventoryDb.createInventoryItem({
          name,
          description: description || null,
          stock,
          unit
        });
        setItems(prev => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error al guardar el artículo.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar este artículo del inventario? Esta acción también eliminará sus consumos en las órdenes.')) {
      return;
    }

    try {
      await inventoryDb.deleteInventoryItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el artículo.');
    }
  };

  const handleQuickAdjustStock = async (item: InventoryItem, delta: number) => {
    const newStock = item.stock + delta;
    if (newStock < 0) return; // Prevent negative stock

    try {
      const updated = await inventoryDb.updateInventoryItem(item.id, { stock: newStock });
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch (err) {
      console.error(err);
      alert('Error al ajustar el stock.');
    }
  };

  // KPIs
  const totalItemsCount = items.length;
  const outOfStockCount = items.filter(i => i.stock === 0).length;
  const lowStockCount = items.filter(i => i.stock > 0 && i.stock < 5).length;
  const availableCount = items.filter(i => i.stock >= 5).length;

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStock = true;
    if (stockFilter === 'agotados') matchesStock = item.stock === 0;
    else if (stockFilter === 'bajo_stock') matchesStock = item.stock > 0 && item.stock < 5;
    else if (stockFilter === 'disponibles') matchesStock = item.stock >= 5;

    return matchesSearch && matchesStock;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 mt-8">
        {/* Title and navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-xs font-semibold mb-2 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Volver al Panel
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Control de Inventario
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Administración de insumos, herramientas y repuestos de servicio técnico.
            </p>
          </div>
          <div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all text-sm font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo Producto
            </button>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Insumos</span>
              <Package className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-3xl font-extrabold text-slate-100">{totalItemsCount}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Agotados</span>
              <AlertTriangle className="w-5 h-5 text-rose-450 animate-pulse" />
            </div>
            <p className="text-3xl font-extrabold text-rose-400">{outOfStockCount}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Bajo Stock</span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl font-extrabold text-amber-400">{lowStockCount}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Disponibles</span>
              <Package className="w-5 h-5 text-emerald-450" />
            </div>
            <p className="text-3xl font-extrabold text-emerald-400">{availableCount}</p>
          </div>
        </div>

        {/* Filters and List */}
        <div className="bg-slate-900/40 border border-slate-800/85 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            {/* Search Input */}
            <div className="w-full md:w-80 relative">
              <input
                type="text"
                placeholder="Buscar insumos por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-slate-150 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: 'todos', label: 'Todos' },
                { value: 'agotados', label: 'Agotados' },
                { value: 'bajo_stock', label: 'Bajo Stock' },
                { value: 'disponibles', label: 'Disponibles' }
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStockFilter(tab.value as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
                    stockFilter === tab.value
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                      : 'bg-slate-950/40 border-slate-800 text-slate-450 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl mb-6 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={fetchInventory} className="flex items-center gap-1 text-xs hover:underline text-rose-400">
                <RotateCcw className="w-3 h-3" /> Reintentar
              </button>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No se encontraron insumos de inventario que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-4 px-4">Material / Insumo</th>
                    <th className="py-4 px-4">Descripción</th>
                    <th className="py-4 px-4 text-center">Unidad</th>
                    <th className="py-4 px-4 text-center">Stock Disponible</th>
                    <th className="py-4 px-4 text-center">Estado</th>
                    <th className="py-4 px-4 text-center">Ajuste Rápido</th>
                    <th className="py-4 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredItems.map((item) => {
                    let statusLabel = 'Disponible';
                    let statusColor = 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20';
                    
                    if (item.stock === 0) {
                      statusLabel = 'Agotado';
                      statusColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    } else if (item.stock < 5) {
                      statusLabel = 'Bajo Stock';
                      statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                    }

                    return (
                      <tr key={item.id} className="hover:bg-slate-900/20 transition-colors">
                        <td className="py-4 px-4 font-semibold text-slate-205">
                          {item.name}
                        </td>
                        <td className="py-4 px-4 text-slate-400 max-w-xs truncate" title={item.description || ''}>
                          {item.description || <span className="text-slate-600 italic">Sin descripción</span>}
                        </td>
                        <td className="py-4 px-4 text-center text-slate-350">
                          {item.unit}
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-slate-200">
                          {item.stock}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 rounded-lg p-1">
                            <button
                              onClick={() => handleQuickAdjustStock(item, -1)}
                              disabled={item.stock === 0}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-850 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-all cursor-pointer"
                              title="Restar 1 unidad"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleQuickAdjustStock(item, 1)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                              title="Sumar 1 unidad"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 rounded-lg text-slate-450 hover:text-blue-400 hover:bg-blue-500/5 border border-transparent hover:border-blue-500/10 transition-all cursor-pointer"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 rounded-lg text-slate-450 hover:text-rose-450 hover:bg-rose-500/5 border border-transparent hover:border-rose-500/10 transition-all cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100">
                {editingItem ? 'Editar Insumo' : 'Registrar Nuevo Insumo'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-450 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Conector RJ45, Cable UTP..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2.5 px-4 text-slate-150 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles del insumo..."
                  rows={3}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2.5 px-4 text-slate-150 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Stock Disponible *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2.5 px-4 text-slate-150 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Unidad de Medida *
                  </label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Ej. unidades, metros..."
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2.5 px-4 text-slate-150 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white disabled:opacity-50 text-sm font-bold shadow-lg shadow-indigo-500/15 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {formSubmitting ? 'Guardando...' : 'Guardar Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
