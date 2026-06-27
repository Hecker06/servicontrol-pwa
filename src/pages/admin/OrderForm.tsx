import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Navbar } from '../../components/Navbar';
import { 
  ChevronLeft, Save, Calendar, User, FileText, 
  ClipboardList, MapPin, Camera, Trash2, Upload, X 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet Marker icon issue in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Client {
  id: string;
  name: string;
}

interface Technician {
  id: string;
  name: string;
  email: string;
}

interface ExistingRefImage {
  id: string;
  url: string;
}

export const OrderForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  // Form fields
  const [clientId, setClientId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Pendiente' | 'Asignada' | 'En progreso' | 'Completada' | 'Cancelada'>('Pendiente');

  // Map Picker State
  const [targetLat, setTargetLat] = useState<number | null>(null);
  const [targetLng, setTargetLng] = useState<number | null>(null);
  const [targetAddress, setTargetAddress] = useState<string | null>(null);
  
  // Reference Images State
  const [tempImages, setTempImages] = useState<{ file: File; preview: string }[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingRefImage[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAddressFromCoords = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=es`,
        {
          headers: {
            'User-Agent': 'ServiControl-PWA/1.0'
          }
        }
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      return data.display_name || 'Dirección de destino desconocida';
    } catch {
      return 'No se pudo obtener la dirección exacta';
    }
  };

  // Default map center (Mexico City or general coordinates, let's use 19.4326, -99.1332)
  const defaultCenter: [number, number] = [19.4326, -99.1332];

  // Leaflet click handler component
  const MapClickHandler = () => {
    useMapEvents({
      async click(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        setTargetLat(lat);
        setTargetLng(lng);
        setTargetAddress('Obteniendo dirección...');
        const addr = await getAddressFromCoords(lat, lng);
        setTargetAddress(addr);
      },
    });
    return null;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch clients
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name')
          .order('name');
        if (clientsError) throw clientsError;
        setClients(clientsData || []);

        // Fetch technicians
        const { data: techsData, error: techsError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('role', 'tecnico')
          .order('name');
        if (techsError) throw techsError;
        setTechnicians(techsData || []);

        // If editing, fetch order data
        if (isEdit) {
          const { data: orderData, error: orderError } = await supabase
            .from('service_orders')
            .select('*')
            .eq('id', id)
            .single();

          if (orderError) throw orderError;
          if (orderData) {
            setClientId(orderData.client_id);
            setTechnicianId(orderData.technician_id || '');
            setDescription(orderData.description);
            setStatus(orderData.status);
            
            // Format date for datetime-local input (YYYY-MM-DDTHH:MM)
            const dateObj = new Date(orderData.scheduled_at);
            const offset = dateObj.getTimezoneOffset();
            const adjustedDate = new Date(dateObj.getTime() - offset * 60 * 1000);
            setScheduledAt(adjustedDate.toISOString().slice(0, 16));

            // Fetch target location if it exists
            const { data: locationData } = await supabase
              .from('locations')
              .select('latitude, longitude, address')
              .eq('order_id', id)
              .eq('is_target', true)
              .maybeSingle();
            
            if (locationData) {
              setTargetLat(Number(locationData.latitude));
              setTargetLng(Number(locationData.longitude));
              setTargetAddress(locationData.address || null);

              if (locationData.latitude && locationData.longitude && !locationData.address) {
                getAddressFromCoords(Number(locationData.latitude), Number(locationData.longitude)).then(addr => {
                  setTargetAddress(addr);
                });
              }
            }

            // Fetch existing reference images
            const { data: imagesData } = await supabase
              .from('evidences')
              .select('id, url')
              .eq('order_id', id)
              .eq('is_reference', true);
            setExistingImages(imagesData || []);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error al cargar los datos de la orden');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEdit]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setTempImages(prev => [...prev, ...newImages]);
  };

  const handleRemoveTempImage = (index: number) => {
    setTempImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleDeleteExistingImage = async (imgId: string, url: string) => {
    if (!window.confirm('¿Deseas eliminar esta imagen de referencia?')) return;
    try {
      // Extract file path from URL
      const urlParts = url.split('/evidences/');
      if (urlParts.length >= 2) {
        const filePath = urlParts[1];
        await supabase.storage.from('evidences').remove([filePath]);
      }
      
      // Delete from DB
      await supabase.from('evidences').delete().eq('id', imgId);
      
      // Update state
      setExistingImages(prev => prev.filter(img => img.id !== imgId));
    } catch (err: any) {
      console.error('Error deleting image:', err);
      setError(err.message || 'Error al eliminar la imagen de referencia');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !scheduledAt || !description) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    setSaving(true);
    setError(null);

    // Determine state
    let orderStatus = status;
    if (!isEdit) {
      orderStatus = technicianId ? 'Asignada' : 'Pendiente';
    } else {
      if (technicianId && orderStatus === 'Pendiente') {
        orderStatus = 'Asignada';
      } else if (!technicianId) {
        orderStatus = 'Pendiente';
      }
    }

    const payload = {
      client_id: clientId,
      technician_id: technicianId || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      description,
      status: orderStatus,
    };

    try {
      let orderId = id;

      // 1. Save or Update Order
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('service_orders')
          .update(payload)
          .eq('id', id);
        if (updateError) throw updateError;
      } else {
        const { data: insertedOrder, error: insertError } = await supabase
          .from('service_orders')
          .insert([payload])
          .select('id')
          .single();
        if (insertError) throw insertError;
        orderId = insertedOrder.id;
      }

      if (!orderId) throw new Error('No se pudo resolver el ID de la orden de servicio');

      // 2. Save target location
      if (targetLat !== null && targetLng !== null) {
        const { data: existingLoc } = await supabase
          .from('locations')
          .select('id')
          .eq('order_id', orderId)
          .eq('is_target', true)
          .maybeSingle();

        const locPayload = {
          order_id: orderId,
          latitude: targetLat,
          longitude: targetLng,
          address: targetAddress,
          is_target: true
        };

        if (existingLoc) {
          await supabase.from('locations').update(locPayload).eq('id', existingLoc.id);
        } else {
          await supabase.from('locations').insert([locPayload]);
        }
      } else if (isEdit) {
        // If edit and coordinates are cleared, delete target location
        await supabase.from('locations').delete().eq('order_id', orderId).eq('is_target', true);
      }

      // 3. Upload Reference Images
      for (const tempImg of tempImages) {
        const file = tempImg.file;
        const fileExt = file.name.split('.').pop();
        const fileName = `${orderId}/ref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = fileName;

        // Upload to Storage
        const { error: uploadError } = await supabase.storage
          .from('evidences')
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('evidences')
          .getPublicUrl(filePath);

        // Save DB Reference
        const { error: dbError } = await supabase
          .from('evidences')
          .insert([{ 
            order_id: orderId, 
            url: publicUrl, 
            is_reference: true 
          }]);
        if (dbError) throw dbError;
      }

      // Cleanup revokes
      tempImages.forEach(img => URL.revokeObjectURL(img.preview));

      navigate('/admin');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al guardar la orden de servicio');
    } finally {
      setSaving(false);
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

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-indigo-400" />
            {isEdit ? 'Editar Orden de Servicio' : 'Nueva Orden de Servicio'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Diseña los parámetros, adjunta imágenes de referencia y define la ubicación objetivo del servicio.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900/40 border border-slate-800/85 rounded-2xl p-8 shadow-xl relative">
          <div className="absolute -inset-px bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-2xl pointer-events-none -z-10"></div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Column: Fields */}
                <div className="space-y-5">
                  {/* Client Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      Cliente *
                    </label>
                    <select
                      required
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all cursor-pointer"
                    >
                      <option value="" className="bg-slate-900">-- Selecciona un Cliente --</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id} className="bg-slate-900">
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Technician Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      Asignar Técnico
                    </label>
                    <select
                      value={technicianId}
                      onChange={(e) => setTechnicianId(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all cursor-pointer"
                    >
                      <option value="" className="bg-slate-900">-- Sin Asignar (Pendiente) --</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id} className="bg-slate-900">
                          {tech.name} ({tech.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Scheduled Date */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Fecha y Hora Programada *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all cursor-pointer"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      Descripción del Trabajo *
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Describe el trabajo a realizar..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all whitespace-pre-wrap"
                    />
                  </div>

                  {/* Status (Only on Edit) */}
                  {isEdit && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Estado de la Orden
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all cursor-pointer"
                      >
                        <option value="Pendiente" className="bg-slate-900">Pendiente</option>
                        <option value="Asignada" className="bg-slate-900">Asignada</option>
                        <option value="En progreso" className="bg-slate-900">En progreso</option>
                        <option value="Completada" className="bg-slate-900">Completada</option>
                        <option value="Cancelada" className="bg-slate-900">Cancelada</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Right Column: Reference Images & Map picker */}
                <div className="space-y-5">
                  
                  {/* Reference Images */}
                  <div className="space-y-2 bg-slate-950/20 border border-slate-850 p-4 rounded-2xl">
                    <label className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      Imágenes de Referencia (Opcional)
                    </label>

                    {/* Previews / Gallery */}
                    {(existingImages.length > 0 || tempImages.length > 0) ? (
                      <div className="grid grid-cols-3 gap-2 py-2">
                        {existingImages.map((img) => (
                          <div key={img.id} className="relative group border border-slate-800 rounded-lg overflow-hidden aspect-square bg-slate-950">
                            <img src={img.url} alt="Referencia" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleDeleteExistingImage(img.id, img.url)}
                              className="absolute top-1 right-1 p-1 rounded-md bg-black/60 hover:bg-rose-600/90 text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {tempImages.map((img, idx) => (
                          <div key={idx} className="relative group border border-indigo-950 rounded-lg overflow-hidden aspect-square bg-slate-950">
                            <img src={img.preview} alt="Nueva" className="w-full h-full object-cover border-2 border-indigo-500/20" />
                            <button
                              type="button"
                              onClick={() => handleRemoveTempImage(idx)}
                              className="absolute top-1 right-1 p-1 rounded-md bg-black/60 hover:bg-rose-600/90 text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No hay imágenes adjuntas.</p>
                    )}

                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 border border-slate-800 hover:border-slate-700 bg-slate-950/45 hover:bg-slate-950/75 text-xs font-semibold rounded-xl text-slate-350 hover:text-slate-100 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-indigo-400" />
                      Adjuntar Imágenes
                    </button>
                  </div>

                  {/* Target Location Map Picker */}
                  <div className="space-y-2 bg-slate-950/20 border border-slate-850 p-4 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        Ubicación Objetivo (Opcional)
                      </label>
                      {(targetLat !== null || targetLng !== null) && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetLat(null);
                            setTargetLng(null);
                          }}
                          className="text-[10px] text-rose-400 hover:underline font-semibold cursor-pointer"
                        >
                          Limpiar ubicación
                        </button>
                      )}
                    </div>

                    {targetLat !== null && targetLng !== null ? (
                      <div className="space-y-1.5">
                        {targetAddress && (
                          <p className="text-xs text-slate-350 bg-slate-950/45 p-2 rounded-lg border border-slate-850/50 leading-relaxed">
                            {targetAddress}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500 font-mono">
                          Coordenadas: {targetLat.toFixed(6)}, {targetLng.toFixed(6)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Haz clic en el mapa para marcar la ubicación del servicio.</p>
                    )}

                    <div className="border border-slate-800 rounded-xl overflow-hidden h-48 bg-slate-950 z-10 relative">
                      <MapContainer
                        center={targetLat !== null && targetLng !== null ? [targetLat, targetLng] : defaultCenter}
                        zoom={targetLat !== null && targetLng !== null ? 14 : 11}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler />
                        {targetLat !== null && targetLng !== null && (
                          <Marker position={[targetLat, targetLng]} />
                        )}
                      </MapContainer>
                    </div>
                  </div>

                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 transition-all text-sm font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all text-sm cursor-pointer"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Guardar Orden
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
