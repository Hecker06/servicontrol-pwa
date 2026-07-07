import { supabase } from './supabase';

export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  stock: number;
  unit: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  quantity: number;
  created_at: string;
  inventory_items?: InventoryItem | null;
}

// Fallback status
let useLocalStorage = false;
let isInitialized = false;

const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-item-1',
    name: 'Cable UTP Categoría 6',
    description: 'Cable de red ethernet para instalaciones de red interna.',
    stock: 120,
    unit: 'metros',
    created_at: new Date().toISOString()
  },
  {
    id: 'inv-item-2',
    name: 'Conector RJ45 Cat 6',
    description: 'Conectores modulares para ponchado de cable UTP.',
    stock: 75,
    unit: 'unidades',
    created_at: new Date().toISOString()
  },
  {
    id: 'inv-item-3',
    name: 'Canaleta de Superficie 20x10mm (2m)',
    description: 'Canaleta plástica para ocultar cableado en paredes.',
    stock: 35,
    unit: 'piezas',
    created_at: new Date().toISOString()
  },
  {
    id: 'inv-item-4',
    name: 'Cinta Aislante Negra 18mm',
    description: 'Cinta de PVC para aislamiento eléctrico y sujeción.',
    stock: 20,
    unit: 'rollos',
    created_at: new Date().toISOString()
  },
  {
    id: 'inv-item-5',
    name: 'Jack RJ45 Categoría 6',
    description: 'Módulo Keystone RJ45 hembra para placas de pared.',
    stock: 30,
    unit: 'unidades',
    created_at: new Date().toISOString()
  }
];

// Initialize LocalStorage if empty
function initLocalDb() {
  if (!localStorage.getItem('servicontrol_inventory')) {
    localStorage.setItem('servicontrol_inventory', JSON.stringify(DEFAULT_INVENTORY));
  }
  if (!localStorage.getItem('servicontrol_order_items')) {
    localStorage.setItem('servicontrol_order_items', JSON.stringify([]));
  }
}

// Helper to check if a DB error points to a missing table
function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const message = error.message || '';
  const code = error.code || '';
  return (
    message.includes('does not exist') ||
    message.includes('no existe la relación') ||
    code === '42P01' ||
    code === 'PGRST116'
  );
}

// Check database status
async function checkDbConnection() {
  if (isInitialized) return;
  try {
    const { error } = await supabase.from('inventory_items').select('id').limit(1);
    if (error && isMissingTableError(error)) {
      console.warn("Tabla 'inventory_items' no encontrada en Supabase. Cambiando a almacenamiento LocalStorage para demostración.");
      useLocalStorage = true;
    }
  } catch (e) {
    console.error("Error al conectar con Supabase para inventario, usando LocalStorage:", e);
    useLocalStorage = true;
  } finally {
    if (useLocalStorage) {
      initLocalDb();
    }
    isInitialized = true;
  }
}

// --- LOCAL STORAGE IMPLEMENTATIONS ---

const localInventory = {
  getItems: (): InventoryItem[] => {
    initLocalDb();
    return JSON.parse(localStorage.getItem('servicontrol_inventory') || '[]');
  },
  
  saveItems: (items: InventoryItem[]) => {
    localStorage.setItem('servicontrol_inventory', JSON.stringify(items));
  },

  getOrderItems: (orderId: string): OrderItem[] => {
    initLocalDb();
    const allOrderItems: OrderItem[] = JSON.parse(localStorage.getItem('servicontrol_order_items') || '[]');
    const inventory = localInventory.getItems();
    
    return allOrderItems
      .filter(oi => oi.order_id === orderId)
      .map(oi => ({
        ...oi,
        inventory_items: inventory.find(i => i.id === oi.item_id) || null
      }));
  },

  saveOrderItems: (items: OrderItem[]) => {
    localStorage.setItem('servicontrol_order_items', JSON.stringify(items));
  },

  createItem: (item: Omit<InventoryItem, 'id' | 'created_at'>): InventoryItem => {
    const items = localInventory.getItems();
    const newItem: InventoryItem = {
      ...item,
      id: 'inv-' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString()
    };
    items.unshift(newItem);
    localInventory.saveItems(items);
    return newItem;
  },

  updateItem: (id: string, updates: Partial<InventoryItem>): InventoryItem => {
    const items = localInventory.getItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) throw new Error("Artículo no encontrado en el inventario local");
    
    items[index] = { ...items[index], ...updates };
    localInventory.saveItems(items);
    return items[index];
  },

  deleteItem: (id: string) => {
    const items = localInventory.getItems();
    const filtered = items.filter(i => i.id !== id);
    localInventory.saveItems(filtered);

    // Also remove from order items
    const orderItems: OrderItem[] = JSON.parse(localStorage.getItem('servicontrol_order_items') || '[]');
    const filteredOrderItems = orderItems.filter(oi => oi.item_id !== id);
    localInventory.saveOrderItems(filteredOrderItems);
  },

  addOrderItem: (orderId: string, itemId: string, quantity: number): OrderItem => {
    const inventory = localInventory.getItems();
    const item = inventory.find(i => i.id === itemId);
    if (!item) throw new Error("Artículo no encontrado");
    if (item.stock < quantity) throw new Error("Stock insuficiente");

    // Deduct stock
    item.stock -= quantity;
    localInventory.saveItems(inventory);

    const orderItems: OrderItem[] = JSON.parse(localStorage.getItem('servicontrol_order_items') || '[]');
    
    // Check if already exists in order
    const existingIndex = orderItems.findIndex(oi => oi.order_id === orderId && oi.item_id === itemId);
    
    if (existingIndex > -1) {
      orderItems[existingIndex].quantity += quantity;
      localInventory.saveOrderItems(orderItems);
      return {
        ...orderItems[existingIndex],
        inventory_items: item
      };
    } else {
      const newOrderItem: OrderItem = {
        id: 'oi-' + Math.random().toString(36).substr(2, 9),
        order_id: orderId,
        item_id: itemId,
        quantity: quantity,
        created_at: new Date().toISOString()
      };
      orderItems.push(newOrderItem);
      localInventory.saveOrderItems(orderItems);
      return {
        ...newOrderItem,
        inventory_items: item
      };
    }
  },

  removeOrderItem: (orderId: string, itemId: string) => {
    const orderItems: OrderItem[] = JSON.parse(localStorage.getItem('servicontrol_order_items') || '[]');
    const itemIndex = orderItems.findIndex(oi => oi.order_id === orderId && oi.item_id === itemId);
    if (itemIndex === -1) return;

    const quantityToRestore = orderItems[itemIndex].quantity;
    
    // Restore stock
    const inventory = localInventory.getItems();
    const item = inventory.find(i => i.id === itemId);
    if (item) {
      item.stock += quantityToRestore;
      localInventory.saveItems(inventory);
    }

    orderItems.splice(itemIndex, 1);
    localInventory.saveOrderItems(orderItems);
  },

  updateOrderItemQuantity: (orderId: string, itemId: string, newQuantity: number) => {
    const orderItems: OrderItem[] = JSON.parse(localStorage.getItem('servicontrol_order_items') || '[]');
    const oi = orderItems.find(o => o.order_id === orderId && o.item_id === itemId);
    if (!oi) throw new Error("Artículo no encontrado en la orden");

    const diff = newQuantity - oi.quantity; // positive if we need more, negative if we release some
    
    const inventory = localInventory.getItems();
    const item = inventory.find(i => i.id === itemId);
    if (!item) throw new Error("Artículo no encontrado en inventario");
    
    if (diff > 0 && item.stock < diff) {
      throw new Error("Stock insuficiente para aumentar la cantidad");
    }

    // Update stock
    item.stock -= diff;
    localInventory.saveItems(inventory);

    // Update order item
    oi.quantity = newQuantity;
    localInventory.saveOrderItems(orderItems);
  }
};

// --- EXPORTED API WRAPPER ---

export const inventoryDb = {
  async getInventoryItems(): Promise<InventoryItem[]> {
    await checkDbConnection();
    if (useLocalStorage) return localInventory.getItems();

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        if (isMissingTableError(error)) {
          useLocalStorage = true;
          initLocalDb();
          return localInventory.getItems();
        }
        throw error;
      }
      return data || [];
    } catch (err) {
      console.error("Error al obtener inventario de Supabase, recurriendo a LocalStorage:", err);
      useLocalStorage = true;
      initLocalDb();
      return localInventory.getItems();
    }
  },

  async createInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at'>): Promise<InventoryItem> {
    await checkDbConnection();
    if (useLocalStorage) return localInventory.createItem(item);

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert(item)
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) {
          useLocalStorage = true;
          initLocalDb();
          return localInventory.createItem(item);
        }
        throw error;
      }
      return data;
    } catch (err) {
      console.error("Error al crear artículo en Supabase, recurriendo a LocalStorage:", err);
      useLocalStorage = true;
      initLocalDb();
      return localInventory.createItem(item);
    }
  },

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    await checkDbConnection();
    if (useLocalStorage) return localInventory.updateItem(id, updates);

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) {
          useLocalStorage = true;
          initLocalDb();
          return localInventory.updateItem(id, updates);
        }
        throw error;
      }
      return data;
    } catch (err) {
      console.error("Error al actualizar artículo en Supabase, recurriendo a LocalStorage:", err);
      useLocalStorage = true;
      initLocalDb();
      return localInventory.updateItem(id, updates);
    }
  },

  async deleteInventoryItem(id: string): Promise<void> {
    await checkDbConnection();
    if (useLocalStorage) {
      localInventory.deleteItem(id);
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) {
        if (isMissingTableError(error)) {
          useLocalStorage = true;
          localInventory.deleteItem(id);
          return;
        }
        throw error;
      }
    } catch (err) {
      console.error("Error al eliminar artículo de Supabase, recurriendo a LocalStorage:", err);
      useLocalStorage = true;
      localInventory.deleteItem(id);
    }
  },

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    await checkDbConnection();
    if (useLocalStorage) return localInventory.getOrderItems(orderId);

    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*, inventory_items(*)')
        .eq('order_id', orderId);

      if (error) {
        if (isMissingTableError(error)) {
          useLocalStorage = true;
          initLocalDb();
          return localInventory.getOrderItems(orderId);
        }
        throw error;
      }
      return data || [];
    } catch (err) {
      console.error("Error al obtener materiales de orden de Supabase, recurriendo a LocalStorage:", err);
      useLocalStorage = true;
      initLocalDb();
      return localInventory.getOrderItems(orderId);
    }
  },

  async addOrderItem(orderId: string, itemId: string, quantity: number): Promise<OrderItem> {
    await checkDbConnection();
    if (useLocalStorage) return localInventory.addOrderItem(orderId, itemId, quantity);

    try {
      // First, get the current item stock to check and update it
      const { data: itemData, error: itemErr } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', itemId)
        .single();
      
      if (itemErr) throw itemErr;
      if (itemData.stock < quantity) throw new Error("Stock insuficiente");

      // Deduct stock in Supabase
      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update({ stock: itemData.stock - quantity })
        .eq('id', itemId);
      
      if (updateErr) throw updateErr;

      // Check if already in order
      const { data: existing } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .eq('item_id', itemId)
        .maybeSingle();

      let result;
      if (existing) {
        // Update quantity
        const { data, error } = await supabase
          .from('order_items')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id)
          .select('*, inventory_items(*)')
          .single();
        if (error) throw error;
        result = data;
      } else {
        // Insert new order item
        const { data, error } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            item_id: itemId,
            quantity: quantity
          })
          .select('*, inventory_items(*)')
          .single();
        if (error) throw error;
        result = data;
      }

      return result;
    } catch (err: any) {
      if (isMissingTableError(err)) {
        useLocalStorage = true;
        initLocalDb();
        return localInventory.addOrderItem(orderId, itemId, quantity);
      }
      throw err;
    }
  },

  async removeOrderItem(orderId: string, itemId: string): Promise<void> {
    await checkDbConnection();
    if (useLocalStorage) {
      localInventory.removeOrderItem(orderId, itemId);
      return;
    }

    try {
      // Find the order item to know what quantity to restore
      const { data: oiData, error: oiErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .eq('item_id', itemId)
        .maybeSingle();
      
      if (oiErr) throw oiErr;
      if (!oiData) return;

      const qtyToRestore = oiData.quantity;

      // Get item to restore stock
      const { data: itemData, error: itemErr } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', itemId)
        .single();
      
      if (!itemErr && itemData) {
        await supabase
          .from('inventory_items')
          .update({ stock: itemData.stock + qtyToRestore })
          .eq('id', itemId);
      }

      // Delete order item
      const { error: delErr } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)
        .eq('item_id', itemId);
      
      if (delErr) throw delErr;
    } catch (err: any) {
      if (isMissingTableError(err)) {
        useLocalStorage = true;
        localInventory.removeOrderItem(orderId, itemId);
        return;
      }
      throw err;
    }
  },

  async updateOrderItemQuantity(orderId: string, itemId: string, newQuantity: number): Promise<void> {
    await checkDbConnection();
    if (useLocalStorage) {
      localInventory.updateOrderItemQuantity(orderId, itemId, newQuantity);
      return;
    }

    try {
      // Find current order item quantity
      const { data: oiData, error: oiErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .eq('item_id', itemId)
        .single();
      
      if (oiErr) throw oiErr;

      const diff = newQuantity - oiData.quantity;
      if (diff === 0) return;

      // Get inventory item
      const { data: itemData, error: itemErr } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', itemId)
        .single();
      
      if (itemErr) throw itemErr;
      if (diff > 0 && itemData.stock < diff) {
        throw new Error("Stock insuficiente para aumentar la cantidad");
      }

      // Update inventory stock
      const { error: upItemErr } = await supabase
        .from('inventory_items')
        .update({ stock: itemData.stock - diff })
        .eq('id', itemId);
      
      if (upItemErr) throw upItemErr;

      // Update order item quantity
      const { error: upOiErr } = await supabase
        .from('order_items')
        .update({ quantity: newQuantity })
        .eq('id', oiData.id);
      
      if (upOiErr) throw upOiErr;
    } catch (err: any) {
      if (isMissingTableError(err)) {
        useLocalStorage = true;
        localInventory.updateOrderItemQuantity(orderId, itemId, newQuantity);
        return;
      }
      throw err;
    }
  }
};
