import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/Navbar';
import { 
  ChevronLeft, Play, CheckCircle, Camera, MapPin, 
  User, Phone, FileText, AlertTriangle, Trash2, Package 
} from 'lucide-react';
import { inventoryDb, type InventoryItem, type OrderItem } from '../../lib/inventoryDb';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet Marker icon
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
  technician_id: string;
  status: 'Pendiente' | 'Asignada' | 'En progreso' | 'Completada' | 'Cancelada';
  scheduled_at: string;
  description: string;
  created_at: string;
  clients: { name: string; phone: string } | null;
}

interface Evidence {
  id: string;
  url: string;
  is_reference: boolean;
  created_at: string;
}

export const TechOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form inputs for Technician
  const [comment, setComment] = useState('');
  
  // Inventory state
  const [materials, setMaterials] = useState<OrderItem[]>([]);
  const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
  const [matSelectId, setMatSelectId] = useState('');
  const [matQty, setMatQty] = useState(1);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  
  // Geolocation state
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [targetCoords, setTargetCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [targetAddress, setTargetAddress] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

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
      return data.display_name || 'Dirección desconocida';
    } catch (err) {
      console.error('Error reverse geocoding:', err);
      return 'No se pudo obtener la dirección exacta';
    }
  };

  // Camera upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchOrderDetails = async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from('service_orders')
        .select(`
          *,
          clients (name, phone)
        `)
        .eq('id', id)
        .eq('technician_id', user.id)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData as Order);

      // Fetch evidences
      const { data: evidenceData, error: evError } = await supabase
        .from('evidences')
        .select('*')
        .eq('order_id', id);
      if (evError) throw evError;
      setEvidences(evidenceData || []);

      // Fetch existing locations (both target and actual)
      const { data: locationData } = await supabase
        .from('locations')
        .select('*')
        .eq('order_id', id);
      
      if (locationData) {
        const target = locationData.find((l: any) => l.is_target === true);
        const actual = locationData.find((l: any) => l.is_target === false);

        setTargetCoords(target ? { latitude: Number(target.latitude), longitude: Number(target.longitude) } : null);
        setTargetAddress(target?.address || null);
        setCoords(actual ? { latitude: Number(actual.latitude), longitude: Number(actual.longitude) } : null);
        setAddress(actual?.address || null);

        // If target exists but doesn't have an address in DB, we can reverse geocode it to show in UI
        if (target && !target.address) {
          getAddressFromCoords(Number(target.latitude), Number(target.longitude)).then(addr => {
            setTargetAddress(addr);
          });
        }
        // If actual exists but doesn't have an address in DB, we can reverse geocode it
        if (actual && !actual.address) {
          getAddressFromCoords(Number(actual.latitude), Number(actual.longitude)).then(addr => {
            setAddress(addr);
          });
        }
      }

      // Fetch existing observations
      const { data: obsData } = await supabase
        .from('observations')
        .select('comment')
        .eq('order_id', id)
        .order('created_at', { ascending: false });
      if (obsData && obsData.length > 0) {
        setComment(obsData[0].comment);
      }

      // Fetch materials and available inventory
      const itemsData = await inventoryDb.getOrderItems(id);
      setMaterials(itemsData);
      const invData = await inventoryDb.getInventoryItems();
      setAvailableInventory(invData);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar los detalles de la orden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id, user]);

  const handleAddMaterial = async () => {
    if (!order || !matSelectId || !id) return;
    const item = availableInventory.find(i => i.id === matSelectId);
    if (!item) return;

    if (item.stock < matQty) {
      alert(`Stock insuficiente. Solo hay ${item.stock} ${item.unit} disponibles.`);
      return;
    }

    setLoadingMaterials(true);
    try {
      await inventoryDb.addOrderItem(id, matSelectId, matQty);
      
      // Refresh list
      const itemsData = await inventoryDb.getOrderItems(id);
      setMaterials(itemsData);
      const invData = await inventoryDb.getInventoryItems();
      setAvailableInventory(invData);
      setMatSelectId('');
      setMatQty(1);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al agregar el material');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleRemoveMaterial = async (itemId: string) => {
    if (!order || !id) return;
    if (!window.confirm('¿Deseas eliminar este registro de material consumido?')) return;
    
    setLoadingMaterials(true);
    try {
      await inventoryDb.removeOrderItem(id, itemId);
      
      // Refresh list
      const itemsData = await inventoryDb.getOrderItems(id);
      setMaterials(itemsData);
      const invData = await inventoryDb.getInventoryItems();
      setAvailableInventory(invData);
    } catch (err: any) {
      console.error(err);
      alert('Error al quitar el material');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleStartService = async () => {
    if (!order) return;
    setUpdating(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({ status: 'En progreso' })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // Capture geolocation when starting the service
      getGeolocation();
      
      fetchOrderDetails();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al iniciar el servicio');
    } finally {
      setUpdating(false);
    }
  };

  const getGeolocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocalización no soportada por este navegador');
      return;
    }

    setLocLoading(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({
          latitude: lat,
          longitude: lng,
        });

        // Reverse geocoding
        const resolvedAddress = await getAddressFromCoords(lat, lng);
        setAddress(resolvedAddress);

        setLocLoading(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocError('No se pudo obtener la ubicación. Activa el GPS y otorga permisos.');
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/jpeg',
            0.75
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !order) return;
    const file = files[0];

    setUploadingImage(true);
    setError(null);

    try {
      // Compresión de imagen en el cliente
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
        type: 'image/jpeg',
        lastModified: Date.now()
      });

      // 1. Upload to Supabase Storage Bucket
      const fileName = `${order.id}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('evidences')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('evidences')
        .getPublicUrl(filePath);

      // 3. Save reference in DB (is_reference = false for technician upload)
      const { error: dbError } = await supabase
        .from('evidences')
        .insert([{ 
          order_id: order.id, 
          url: publicUrl,
          is_reference: false
        }]);

      if (dbError) throw dbError;

      fetchOrderDetails();

      // Automatically capture GPS coords if not captured yet
      if (!coords) {
        getGeolocation();
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al subir la imagen de evidencia');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string, url: string) => {
    if (!window.confirm('¿Deseas eliminar esta foto de evidencia?')) return;
    setError(null);

    try {
      const urlParts = url.split('/evidences/');
      if (urlParts.length < 2) throw new Error('URL de evidencia inválida');
      const filePath = urlParts[1];

      await supabase.storage.from('evidences').remove([filePath]);
      await supabase.from('evidences').delete().eq('id', evidenceId);

      fetchOrderDetails();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al eliminar la evidencia');
    }
  };

  const handleCompleteService = async () => {
    if (!order) return;
    
    const techPhotos = evidences.filter(e => e.is_reference !== true);
    if (techPhotos.length === 0) {
      setError('Debes subir al menos una foto de evidencia para poder completar el servicio.');
      return;
    }
    if (!comment.trim()) {
      setError('Debes agregar observaciones o descripción del trabajo realizado.');
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      // 1. Guardar la observación / comentario
      const { error: obsError } = await supabase
        .from('observations')
        .insert([{ order_id: order.id, comment: comment.trim() }]);
      if (obsError) throw obsError;

      // 2. Guardar ubicación GPS si existe
      if (coords) {
        // Check if location already saved
        const { data: existingLoc } = await supabase
          .from('locations')
          .select('id')
          .eq('order_id', order.id)
          .eq('is_target', false)
          .maybeSingle();

        const locPayload = {
          order_id: order.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          address: address,
          is_target: false
        };

        if (existingLoc) {
          await supabase.from('locations').update(locPayload).eq('id', existingLoc.id);
        } else {
          await supabase.from('locations').insert([locPayload]);
        }
      }

      // 3. Actualizar estado de la orden a "Completada"
      const { error: statusError } = await supabase
        .from('service_orders')
        .update({ status: 'Completada' })
        .eq('id', order.id);
      if (statusError) throw statusError;

      navigate('/tech');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al completar el servicio');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completada':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'En progreso':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    }
  };

  const refImages = evidences.filter(e => e.is_reference === true);
  const techEvidences = evidences.filter(e => e.is_reference !== true);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <Navbar />

      <div className="max-w-md mx-auto px-4 mt-6 sm:max-w-2xl">
        {/* Navigation Button */}
        <button
          onClick={() => navigate('/tech')}
          className="flex items-center gap-1.5 text-slate-450 hover:text-slate-200 transition-all text-xs mb-5 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver a Mis Servicios
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-3 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : !order ? (
          <div className="text-center py-12 text-slate-500 bg-slate-900 border border-slate-850 rounded-2xl">
            No se encontró la orden de servicio.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header / Info */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-blue-600 to-indigo-600"></div>

              <div className="flex items-center justify-between mb-4">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
                <span className="text-slate-400 text-xs font-semibold">
                  Programado:{' '}
                  {new Date(order.scheduled_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-100 flex items-start gap-2">
                <User className="w-5 h-5 text-indigo-400 mt-0.5" />
                {order.clients?.name || 'Cliente sin nombre'}
              </h2>

              <div className="mt-3.5 space-y-2.5 text-sm text-slate-350">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span>{order.clients?.phone || 'Sin teléfono registrado'}</span>
                </div>
                
                {/* Description */}
                <div className="flex items-start gap-2 border-t border-slate-850 pt-3 mt-3">
                  <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 uppercase font-semibold">Descripción del Trabajo</p>
                    <p className="text-slate-200 mt-0.5 whitespace-pre-wrap leading-relaxed">
                      {order.description}
                    </p>
                  </div>
                </div>

                {/* Reference Images from Admin */}
                {refImages.length > 0 && (
                  <div className="border-t border-slate-850 pt-3 mt-3 space-y-2">
                    <p className="text-xs text-slate-500 uppercase font-semibold">Imágenes de Referencia (Admin)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {refImages.map((ev) => (
                        <div key={ev.id} className="border border-slate-800 rounded-lg overflow-hidden aspect-square bg-slate-950">
                          <a href={ev.url} target="_blank" rel="noreferrer">
                            <img src={ev.url} alt="Referencia Admin" className="w-full h-full object-cover hover:opacity-85 transition-opacity" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl text-xs">
                {error}
              </div>
            )}

            {/* Target Location Map (Displays destination to Technician) */}
            {targetCoords && (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-md space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  Ubicación del Destino (Cliente)
                </h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden h-48 bg-slate-950 relative z-10">
                  <MapContainer
                    center={[targetCoords.latitude, targetCoords.longitude]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[targetCoords.latitude, targetCoords.longitude]}>
                      <Popup>
                        <span className="text-slate-900 text-xs">Lugar de Destino del Servicio</span>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
                {targetAddress && (
                  <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl text-xs text-slate-350 leading-relaxed">
                    <span className="font-semibold text-slate-200">Dirección de Destino: </span>
                    <span>{targetAddress}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions Panel */}
            {order.status === 'Asignada' && (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-md text-center">
                <p className="text-sm text-slate-400 mb-4">
                  Presiona el botón para iniciar la orden de servicio y habilitar el registro de evidencias.
                </p>
                <button
                  onClick={handleStartService}
                  disabled={updating}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {updating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      Iniciar Servicio
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Evidences, Geolocation, Comments and Complete button (Only in progress or completed) */}
            {(order.status === 'En progreso' || order.status === 'Completada') && (
              <div className="space-y-6">
                
                {/* 1. Evidence Photos */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-md space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
                    <span>Fotos de Evidencia</span>
                    {order.status === 'En progreso' && (
                      <span className="text-[10px] text-slate-500 normal-case">* Al menos 1 foto requerida</span>
                    )}
                  </h3>

                  {/* Evidence list / previews */}
                  {techEvidences.length === 0 ? (
                    <div className="border border-slate-850 border-dashed rounded-xl p-8 text-center text-slate-555 text-sm">
                      No hay fotos de evidencia cargadas por ti.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {techEvidences.map((ev) => (
                        <div key={ev.id} className="relative group border border-slate-800 rounded-xl overflow-hidden aspect-video bg-slate-950">
                          <img
                            src={ev.url}
                            alt="Evidencia"
                            className="w-full h-full object-cover"
                          />
                          {order.status === 'En progreso' && (
                            <button
                              onClick={() => handleDeleteEvidence(ev.id, ev.url)}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600/90 text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add photo button */}
                  {order.status === 'En progreso' && (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={triggerFileInput}
                        disabled={uploadingImage}
                        className="w-full py-3.5 border border-slate-800 hover:border-slate-700 bg-slate-950/45 hover:bg-slate-950/70 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        {uploadingImage ? (
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 text-indigo-400" />
                            Tomar / Subir Foto de Evidencia
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. Materials Consumption */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-md space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 font-sans">
                    <Package className="w-4 h-4 text-indigo-400" />
                    Materiales e Insumos Utilizados
                  </h3>

                  {/* List of registered materials for this order */}
                  {materials.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No se han registrado materiales consumidos para este servicio.</p>
                  ) : (
                    <div className="space-y-2">
                      {materials.map((mat) => (
                        <div key={mat.id} className="bg-slate-950/45 border border-slate-800/80 px-3.5 py-3 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-slate-200">{mat.inventory_items?.name || 'Insumo'}</p>
                            <p className="text-slate-500 text-[10px] mt-0.5">{mat.inventory_items?.unit || 'unidad'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-indigo-400 text-sm">{mat.quantity}</span>
                            {order.status === 'En progreso' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial(mat.item_id)}
                                disabled={loadingMaterials}
                                className="text-slate-550 hover:text-rose-450 p-1 rounded transition-colors disabled:opacity-30 cursor-pointer"
                                title="Quitar material"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add material form (only if order is En progreso) */}
                  {order.status === 'En progreso' && (
                    <div className="border-t border-slate-800/80 pt-4 mt-2 space-y-3">
                      <p className="text-xs text-slate-400 font-semibold">Registrar consumo de material:</p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <select
                            value={matSelectId}
                            onChange={(e) => setMatSelectId(e.target.value)}
                            disabled={loadingMaterials}
                            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                          >
                            <option value="" className="bg-slate-900">-- Selecciona Material --</option>
                            {availableInventory.map((item) => (
                              <option key={item.id} value={item.id} className="bg-slate-900" disabled={item.stock <= 0}>
                                {item.name} ({item.stock} en stock)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-16">
                          <input
                            type="number"
                            min={1}
                            value={matQty}
                            onChange={(e) => setMatQty(Math.max(1, parseInt(e.target.value) || 1))}
                            disabled={loadingMaterials || !matSelectId}
                            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-slate-250 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddMaterial}
                          disabled={loadingMaterials || !matSelectId}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Registrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Geolocation Info */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-md space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
                    <span>Geolocalización GPS</span>
                    {order.status === 'En progreso' && (
                      <button
                        onClick={getGeolocation}
                        disabled={locLoading}
                        className="text-xs text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <MapPin className="w-3 h-3" />
                        Obtener Ubicación
                      </button>
                    )}
                  </h3>

                  {locLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>Obteniendo coordenadas GPS...</span>
                    </div>
                  )}

                  {locError && (
                    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/25 text-amber-450 rounded-xl text-xs leading-relaxed">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{locError}</span>
                    </div>
                  )}

                  {coords ? (
                    <div className="bg-slate-950/45 border border-slate-850 p-4 rounded-xl space-y-2.5 text-xs text-slate-300">
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-rose-500 animate-pulse mt-0.5 shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <p className="font-semibold text-slate-200">Ubicación Obtenida (Visita)</p>
                          {address ? (
                            <p className="text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/40 text-[11px] leading-relaxed">
                              {address}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-500 italic">Obteniendo dirección exacta...</p>
                          )}
                          <p className="text-[10px] text-slate-500 font-mono">
                            Coordenadas: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    !locLoading && (
                      <p className="text-xs text-slate-500 italic">
                        Coordenadas GPS de la visita no capturadas todavía.
                      </p>
                    )
                  )}
                </div>

                {/* 3. Observations / Comments */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-md space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
                    Observaciones y Reporte
                  </h3>
                  {order.status === 'En progreso' ? (
                    <textarea
                      rows={4}
                      placeholder="Detalla las actividades realizadas en este servicio..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs transition-all"
                    />
                  ) : (
                    <p className="text-sm text-slate-250 italic bg-slate-950/20 p-4 rounded-xl border border-slate-850/60">
                      "{comment || 'Sin comentarios registrados.'}"
                    </p>
                  )}
                </div>

                {/* 4. Complete Action Button */}
                {order.status === 'En progreso' && (
                  <button
                    onClick={handleCompleteService}
                    disabled={updating}
                    className="w-full bg-gradient-to-r from-emerald-650 to-teal-650 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {updating ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Completar Servicio
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
