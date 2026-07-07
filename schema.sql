-- Esquema de Base de Datos para Control de Órdenes de Servicio

-- Habilitar extensión para UUIDs
create extension if not exists "uuid-ossp";

-- 1. Tabla de Perfiles de Usuario (Sincronizada con auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text,
  role text not null default 'tecnico' check (role in ('admin', 'tecnico')),
  created_at timestamptz default now()
);

-- Habilitar RLS para profiles
alter table public.profiles enable row level security;

-- 2. Tabla de Clientes
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  created_at timestamptz default now()
);

-- Habilitar RLS para clients
alter table public.clients enable row level security;

-- 3. Tabla de Órdenes de Servicio
create table public.service_orders (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  technician_id uuid references public.profiles(id) on delete set null,
  status text not null default 'Pendiente' check (status in ('Pendiente', 'Asignada', 'En progreso', 'Completada', 'Cancelada')),
  scheduled_at timestamptz not null,
  description text not null,
  created_at timestamptz default now()
);

-- Habilitar RLS para service_orders
alter table public.service_orders enable row level security;

-- 4. Tabla de Evidencias Fotográficas
create table public.evidences (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.service_orders(id) on delete cascade not null,
  url text not null, -- Ruta/URL en Supabase Storage
  is_reference boolean not null default false, -- true si es subida por el admin, false si es evidencia del técnico
  created_at timestamptz default now()
);

-- Habilitar RLS para evidences
alter table public.evidences enable row level security;

create table public.locations (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.service_orders(id) on delete cascade not null,
  latitude numeric not null,
  longitude numeric not null,
  address text,
  is_target boolean not null default false, -- true si es la ubicación objetivo del admin, false si es la registrada por el técnico
  recorded_at timestamptz default now()
);

-- Habilitar RLS para locations
alter table public.locations enable row level security;

-- 6. Tabla de Observaciones (Comentarios)
create table public.observations (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.service_orders(id) on delete cascade not null,
  comment text not null,
  created_at timestamptz default now()
);

-- Habilitar RLS para observations
alter table public.observations enable row level security;


-----------------
-- POLÍTICAS RLS (Row Level Security)
-----------------

-- Políticas para PROFILES
create policy "Cualquier usuario autenticado puede leer perfiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Los usuarios pueden actualizar su propio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Solo los admins pueden insertar perfiles"
  on public.profiles for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Solo los admins pueden borrar perfiles"
  on public.profiles for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Políticas para CLIENTS
create policy "Cualquier usuario autenticado puede ver clientes"
  on public.clients for select
  to authenticated
  using (true);

create policy "Solo los admins pueden modificar clientes"
  on public.clients for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Políticas para SERVICE_ORDERS
create policy "Los administradores pueden realizar todas las operaciones sobre órdenes"
  on public.service_orders for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Los técnicos pueden leer sus órdenes asignadas"
  on public.service_orders for select
  to authenticated
  using (technician_id = auth.uid());

create policy "Los técnicos pueden actualizar el estado de sus órdenes"
  on public.service_orders for update
  to authenticated
  using (technician_id = auth.uid())
  with check (technician_id = auth.uid());

-- Políticas para EVIDENCES
create policy "Los administradores tienen control total sobre evidencias"
  on public.evidences for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Los técnicos pueden ver evidencias de sus órdenes"
  on public.evidences for select
  to authenticated
  using (
    exists (
      select 1 from public.service_orders s
      where s.id = evidences.order_id and s.technician_id = auth.uid()
    )
  );

create policy "Los técnicos pueden subir evidencias de sus órdenes"
  on public.evidences for insert
  to authenticated
  with check (
    exists (
      select 1 from public.service_orders s
      where s.id = evidences.order_id and s.technician_id = auth.uid()
    )
  );

create policy "Los técnicos pueden borrar sus propias evidencias de sus órdenes"
  on public.evidences for delete
  to authenticated
  using (
    exists (
      select 1 from public.service_orders s
      where s.id = evidences.order_id and s.technician_id = auth.uid()
    )
    and is_reference = false
  );


-- Políticas para LOCATIONS
create policy "Los administradores tienen control total sobre ubicaciones"
  on public.locations for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Los técnicos pueden ver ubicaciones de sus órdenes"
  on public.locations for select
  to authenticated
  using (
    exists (
      select 1 from public.service_orders s
      where s.id = locations.order_id and s.technician_id = auth.uid()
    )
  );

create policy "Los técnicos pueden registrar ubicaciones de sus órdenes"
  on public.locations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.service_orders s
      where s.id = locations.order_id and s.technician_id = auth.uid()
    )
  );

create policy "Los técnicos pueden actualizar sus propias ubicaciones"
  on public.locations for update
  to authenticated
  using (
    exists (
      select 1 from public.service_orders s
      where s.id = locations.order_id and s.technician_id = auth.uid()
    )
    and is_target = false
  )
  with check (
    exists (
      select 1 from public.service_orders s
      where s.id = locations.order_id and s.technician_id = auth.uid()
    )
    and is_target = false
  );


-- Políticas para OBSERVATIONS
create policy "Los administradores tienen control total sobre observaciones"
  on public.observations for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Los técnicos pueden ver observaciones de sus órdenes"
  on public.observations for select
  to authenticated
  using (
    exists (
      select 1 from public.service_orders s
      where s.id = observations.order_id and s.technician_id = auth.uid()
    )
  );

create policy "Los técnicos pueden crear observaciones de sus órdenes"
  on public.observations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.service_orders s
      where s.id = observations.order_id and s.technician_id = auth.uid()
    )
  );


-----------------
-- Políticas para ALMACENAMIENTO DE EVIDENCIAS (storage.objects)
-----------------
alter table storage.objects enable row level security;

create policy "Cualquier usuario autenticado puede ver evidencias en storage"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'evidences');

create policy "Los usuarios autenticados pueden subir evidencias en storage"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'evidences');

create policy "Los usuarios autenticados pueden borrar evidencias en storage"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'evidences');


-----------------
-- TRIGGERS Y FUNCIONES DE SINCRONIZACIÓN
-----------------

-- Función para manejar nuevos registros en auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'tecnico') -- Por defecto se crea como técnico
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger para sincronizar auth.users con public.profiles
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-----------------
-- 7. TABLAS DE INVENTARIO Y CONSUMO DE MATERIALES
-----------------

-- Tabla de Ítems de Inventario (Insumos, materiales, repuestos)
create table if not exists public.inventory_items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  stock integer not null default 0,
  unit text not null default 'unidad',
  created_at timestamptz default now()
);

-- Habilitar RLS para la tabla de inventario
alter table public.inventory_items enable row level security;

-- Políticas de RLS para public.inventory_items
create policy "Cualquier usuario autenticado puede ver el inventario"
  on public.inventory_items for select
  to authenticated
  using (true);

create policy "Solo los administradores pueden gestionar el inventario"
  on public.inventory_items for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Tabla de Insumos/Materiales consumidos en las Órdenes de Servicio
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.service_orders(id) on delete cascade not null,
  item_id uuid references public.inventory_items(id) on delete cascade not null,
  quantity integer not null default 1,
  created_at timestamptz default now(),
  unique(order_id, item_id)
);

-- Habilitar RLS para la tabla de consumo
alter table public.order_items enable row level security;

-- Políticas de RLS para public.order_items
create policy "Cualquier usuario autenticado puede ver materiales de órdenes"
  on public.order_items for select
  to authenticated
  using (true);

create policy "Administradores pueden gestionar todos los materiales de órdenes"
  on public.order_items for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Técnicos pueden registrar consumos en sus órdenes asignadas"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.service_orders s
      where s.id = order_items.order_id and s.technician_id = auth.uid()
    )
  );

create policy "Técnicos pueden actualizar consumos en sus órdenes asignadas"
  on public.order_items for update
  to authenticated
  using (
    exists (
      select 1 from public.service_orders s
      where s.id = order_items.order_id and s.technician_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.service_orders s
      where s.id = order_items.order_id and s.technician_id = auth.uid()
    )
  );

create policy "Técnicos pueden eliminar consumos en sus órdenes asignadas"
  on public.order_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.service_orders s
      where s.id = order_items.order_id and s.technician_id = auth.uid()
    )
  );

