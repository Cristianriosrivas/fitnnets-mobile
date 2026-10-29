-- Carreras (correr / caminar con GPS) y pasos diarios. Repetible.
-- Privacidad: la RUTA GPS no se guarda en la base de datos; se queda solo en el teléfono.
-- Aquí van únicamente totales: distancia, tiempo, ritmo, parciales por km, pasos y calorías.
-- Las dos tablas cuelgan de profiles con "on delete cascade", así que delete_my_account las borra.

-- 1) Carreras
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity text not null default 'correr' check (activity in ('correr', 'caminar')),
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  distance_m numeric(9,1) not null check (distance_m >= 0),
  avg_pace_seconds integer check (avg_pace_seconds is null or avg_pace_seconds > 0), -- segundos por km
  best_km_seconds integer check (best_km_seconds is null or best_km_seconds > 0),
  splits_seconds integer[], -- segundos de cada km completo
  steps integer check (steps is null or steps >= 0),
  calories integer check (calories is null or calories >= 0),
  created_at timestamptz not null default now()
);

create index if not exists runs_user_started_idx on public.runs (user_id, started_at desc);

alter table public.runs enable row level security;

drop policy if exists "Ver mis carreras" on public.runs;
create policy "Ver mis carreras" on public.runs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Registrar mis carreras" on public.runs;
create policy "Registrar mis carreras" on public.runs
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Borrar mis carreras" on public.runs;
create policy "Borrar mis carreras" on public.runs
  for delete to authenticated using (auth.uid() = user_id);

-- 2) Pasos por día (fecha LOCAL del teléfono, que es como el usuario entiende "hoy").
--    El iPhone solo guarda 7 días de historial: esta tabla permite ver meses.
create table if not exists public.daily_steps (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  steps integer not null check (steps >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_steps enable row level security;

drop policy if exists "Ver mis pasos" on public.daily_steps;
create policy "Ver mis pasos" on public.daily_steps
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Registrar mis pasos" on public.daily_steps;
create policy "Registrar mis pasos" on public.daily_steps
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Actualizar mis pasos" on public.daily_steps;
create policy "Actualizar mis pasos" on public.daily_steps
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
