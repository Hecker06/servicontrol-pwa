# Recorrido Técnico: MVP PWA Control de Órdenes de Servicio

¡El MVP de la PWA para control de órdenes de servicio ha sido completamente implementado y empaquetado con éxito! A continuación se detalla lo que hemos construido, cómo funciona la arquitectura y los pasos para conectarla a tu entorno de producción de Supabase y Vercel.

---

## Logotipo del Proyecto (PWA App Icon)

El siguiente es el logotipo generado por IA que se configuró como el ícono principal de la PWA:

![Logo de la PWA](/C:/Users/USUARIO/.gemini/antigravity/brain/de4348cf-0200-447c-9567-309fab6df3d1/app_logo_pwa_1782508998649.jpg)

---

## Estructura del Proyecto e Historial de Cambios

Se crearon y configuraron todos los componentes necesarios para habilitar el backend relacional con seguridad robusta RLS, la lógica offline PWA y la interfaz premium interactiva para administradores y técnicos:

### Base de Datos y Backend (Supabase)
* **[schema.sql](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/schema.sql):** Define las tablas relacionales (`profiles`, `clients`, `service_orders`, `evidences`, `locations`, `observations`), políticas de seguridad a nivel de fila (RLS) para aislamiento de técnicos, e incluye un disparador (trigger) en la base de datos que sincroniza automáticamente nuevos registros de `auth.users` a `public.profiles`.

### Configuración del Frontend PWA (Vite + React)
* **[vite.config.ts](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/vite.config.ts):** Configurado con `@tailwindcss/vite` para procesamiento instantáneo de estilos y `vite-plugin-pwa` para generar automáticamente el manifiesto de la aplicación (`manifest.webmanifest`) y empaquetar el Service Worker para almacenamiento en caché offline de recursos estáticos.
* **[index.html](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/index.html):** Configura metadatos PWA móviles, tipografía premium de Google Fonts (Inter y Outfit) y hojas de estilo externas para mapas interactivos (Leaflet CSS).
* **[src/index.css](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/index.css):** Integra Tailwind CSS v4 e incluye sobrescrituras de estilos personalizados en modo oscuro para los popups y marcadores del mapa de Leaflet, y personaliza las barras de desplazamiento (scrollbars) globales.

### Componentes de Control y Estado
* **[src/lib/supabase.ts](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/lib/supabase.ts):** Inicialización del cliente de Supabase usando variables de entorno seguras.
* **[src/context/AuthContext.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/context/AuthContext.tsx):** Contexto global que monitorea el estado de autenticación y carga el perfil extendido del usuario (incluyendo rol `admin` o `tecnico`) en tiempo real.
* **[src/components/ProtectedRoute.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%2520Prod/src/components/ProtectedRoute.tsx):** Habilita rutas protegidas según la sesión del usuario y redirige automáticamente de acuerdo a los roles autorizados.
* **[src/components/Navbar.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/components/Navbar.tsx):** Cabecera premium responsiva que muestra el nombre del usuario logueado con un distintivo visual de su rol (badge) y botón de cierre de sesión.
* **[src/App.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/App.tsx):** Enrutador centralizado del sistema.

### Vistas y Pantallas Premium
* **[src/pages/Login.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/pages/Login.tsx):** Formulario de inicio de sesión y registro de cuentas. Permite a los técnicos y administradores registrarse asignándoles por defecto el rol de `tecnico` en su perfil, con un fondo de gradiente animado y orbes flotantes.
* **[src/pages/admin/Dashboard.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/pages/admin/Dashboard.tsx):** Dashboard del administrador con métricas (KPIs) en tiempo real, búsquedas con filtros rápidos y un modal interactivo para consultar evidencias fotográficas y la geolocalización exacta mediante mapas de Leaflet (OpenStreetMap).
* **[src/pages/admin/OrderForm.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/pages/admin/OrderForm.tsx):** Formulario dinámico para registrar o editar órdenes asignando clientes y técnicos de campo.
* **[src/pages/admin/Clients.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/pages/admin/Clients.tsx):** Gestión CRUD de los datos de contacto de clientes de servicio.
* **[src/pages/tech/Dashboard.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/pages/tech/Dashboard.tsx):** Interfaz optimizada para móviles para los técnicos que lista únicamente sus servicios activos y tareas finalizadas.
* **[src/pages/tech/OrderDetail.tsx](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/src/pages/tech/OrderDetail.tsx):** Ficha del servicio para técnicos, donde pueden iniciar la orden, tomar fotos de evidencia (dispara la cámara del celular), obtener coordenadas GPS mediante la API de geolocalización del navegador, redactar comentarios técnicos y marcar el servicio como completado.

---

## Guía de Configuración Paso a Paso

### 1. Preparación de Supabase

> [!IMPORTANT]
> Debes crear un proyecto en Supabase (tier gratuito) y seguir estos dos pasos en su panel de administración:
>
> **Paso A: Ejecutar el Esquema de Base de Datos**
> 1. Ve a la sección **SQL Editor** en Supabase.
> 2. Haz clic en "New Query".
> 3. Copia y pega el contenido completo de tu archivo local [schema.sql](file:///c:/Users/USUARIO/Desktop/Estadias%20Prod/schema.sql) (el cual ya incluye las políticas RLS corregidas y divididas para evitar el error de violación de seguridad al subir evidencias/ubicaciones).
> 4. Haz clic en **Run** para crear todas las tablas, relaciones, triggers de sincronización y políticas RLS.
>
> **Paso B: Crear el Bucket de Almacenamiento**
> 1. Ve a la pestaña **Storage** en la barra lateral de Supabase.
> 2. Haz clic en **New Bucket**.
> 3. Nómbralo exactamente `evidences` (en minúsculas).
> 4. Configúralo como **público** para permitir la carga y lectura de fotos de evidencias fotográficas.

### 2. Configurar Variables de Entorno del Proyecto

Crea un archivo llamado `.env` en la raíz de tu proyecto local (`c:\Users\USUARIO\Desktop\Estadias Prod\.env`) y añade las credenciales de tu proyecto Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto-supabase.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica-de-supabase
```

### 3. Servidor de Desarrollo y Pruebas

Para ejecutar el servidor de desarrollo y empezar a interactuar con ServiControl:

```bash
# Instalar paquetes (por si acaso no se han ejecutado)
npm install

# Iniciar servidor local
npm run dev
```

### 4. Compilar y Probar la PWA localmente

Para probar el comportamiento de PWA y la descarga del Service Worker en local:

```bash
# Compilar bundle de producción y Service Worker
npm run build

# Previsualizar el build de producción en un servidor local
npm run preview
```

Visita la dirección que te provea el comando `npm run preview` desde Google Chrome o Microsoft Edge, y verás un icono de descarga (pantalla con flecha) en la barra de direcciones que te permitirá **Instalar ServiControl** como aplicación nativa en tu ordenador o dispositivo móvil.
