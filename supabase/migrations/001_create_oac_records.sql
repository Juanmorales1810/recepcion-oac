-- ============================================================
-- Script único: creación completa de oac_records + RLS
-- ============================================================
-- Best practices aplicadas (Supabase/Postgres):
--   - bigint identity PK (no serial, no uuid v4)
--   - text en lugar de varchar(n)
--   - timestamptz para timestamps
--   - jsonb para arrays variables
--   - check constraints para enums
--   - Índices parciales para columnas nullable de alta cardinalidad
--   - (select auth.uid()) en policies → evaluado una vez por query
--   - force row level security → el owner también queda sujeto a RLS
--   - Principio de mínimo privilegio: revoke public, grant explícito
-- ============================================================

-- ----------------------------------------------------------
-- 1. Tabla principal
-- ----------------------------------------------------------
create table if not exists public.oac_records (
  id bigint generated always as identity primary key,

  -- Estado de carga al endpoint externo
  estado_carga text not null default 'pendiente'
    check (estado_carga in ('pendiente', 'enviado', 'error_carga', 'revisar')),

  -- Sellado del PDF (null = no sellado)
  sellado text default null
    check (sellado is null or sellado in ('verde', 'rojo', 'negro')),

  -- Archivos
  archivo_origen text not null,
  archivo_destino text,

  -- Metadata IA
  confianza_global text,
  campos_dudosos jsonb not null default '[]'::jsonb,
  correcciones_realizadas jsonb not null default '[]'::jsonb,
  notas jsonb not null default '[]'::jsonb,

  -- Encabezado
  empresa text,
  numero_sac text,
  numero_ot text,
  numero_reclamo text,
  numero_oac text,
  fecha text,
  usuario_nombre text,
  suministro_nro text,
  tipo_orden text,

  -- Ubicación
  direccion text,
  barrio_villa text,
  departamento text,
  localidad text,
  latitud double precision,
  longitud double precision,

  -- Detalle técnico
  motivo_reclamo text,
  descripcion_falla text,
  ubicacion_falla text,
  codigo_falla text,
  codigo_trabajo text,
  tipo_instalacion text,
  elementos_afectados text,

  -- Informe de campo
  descripcion_manuscrita text,
  trabajos_realizados text,
  trabajos_pendientes text,
  materiales_utilizados text,
  apertura_puesto_medicion text,

  -- Cierre
  empresa_contratista text,
  operarios jsonb not null default '[]'::jsonb,
  hora_inicio text,
  hora_fin text,
  estado_cierre text,
  observaciones_cierre text,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- 2. Índices
-- ----------------------------------------------------------

-- Filtrado por estado de carga (query más frecuente)
create index if not exists idx_oac_records_estado_carga
  on public.oac_records (estado_carga);

-- Búsquedas por número (índices parciales → solo filas con valor)
create index if not exists idx_oac_records_numero_sac
  on public.oac_records (numero_sac) where numero_sac is not null;

create index if not exists idx_oac_records_numero_ot
  on public.oac_records (numero_ot) where numero_ot is not null;

create index if not exists idx_oac_records_numero_reclamo
  on public.oac_records (numero_reclamo) where numero_reclamo is not null;

-- ----------------------------------------------------------
-- 3. Trigger updated_at
-- ----------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger on_oac_records_updated
  before update on public.oac_records
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------
-- 4. Mínimo privilegio: revocar acceso público por defecto
-- ----------------------------------------------------------
revoke all on schema public from public;
revoke all on all tables in schema public from public;

-- Restaurar acceso al schema para los roles de Supabase
grant usage on schema public to anon, authenticated, service_role;

-- ----------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------
alter table public.oac_records enable row level security;
alter table public.oac_records force row level security;

-- SELECT: usuarios autenticados pueden leer todos los registros.
-- (select auth.uid()) se evalúa una sola vez por query → óptimo.
create policy oac_records_select_authenticated
  on public.oac_records
  for select
  to authenticated
  using ((select auth.uid()) is not null);

-- INSERT: usuarios autenticados pueden crear registros.
create policy oac_records_insert_authenticated
  on public.oac_records
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

-- UPDATE: usuarios autenticados pueden modificar registros.
create policy oac_records_update_authenticated
  on public.oac_records
  for update
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- DELETE: sin policy para authenticated → deny by default.
-- El service_role (backend/Tauri) bypasea RLS automáticamente.

-- ----------------------------------------------------------
-- 6. Grants explícitos por rol
-- ----------------------------------------------------------

-- authenticated: SELECT, INSERT, UPDATE (sin DELETE)
grant select, insert, update on public.oac_records to authenticated;
grant usage, select on sequence public.oac_records_id_seq to authenticated;

-- anon: sin acceso
revoke all on public.oac_records from anon;

-- service_role: acceso total
grant all on public.oac_records to service_role;
grant all on sequence public.oac_records_id_seq to service_role;
