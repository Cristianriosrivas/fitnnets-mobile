-- M3 · Peso usado, ejercicio y duración en cada registro de entrenamiento
-- Repetible: se puede correr varias veces sin error.
-- Estado previo (28-oct-2026): progress_logs ya tiene weight_used_kg numeric (sin precisión ni check,
-- 0 filas con valor) y no tiene exercise_id ni duration_seconds.

-- 1) Peso usado: precisión de 2 decimales y nunca negativo
alter table public.progress_logs
  alter column weight_used_kg type numeric(6,2);

alter table public.progress_logs
  drop constraint if exists progress_logs_weight_used_kg_check;

alter table public.progress_logs
  add constraint progress_logs_weight_used_kg_check
  check (weight_used_kg is null or weight_used_kg >= 0);

-- 2) Ejercicio directo: conserva el historial por ejercicio aunque se borre la rutina
--    (routine_exercise_id queda en null al borrar la rutina, exercise_id no)
alter table public.progress_logs
  add column if not exists exercise_id uuid references public.exercises(id) on delete set null;

-- 3) Tiempo que tardó el usuario en el ejercicio (series + descansos), en segundos
alter table public.progress_logs
  add column if not exists duration_seconds integer;

alter table public.progress_logs
  drop constraint if exists progress_logs_duration_seconds_check;

alter table public.progress_logs
  add constraint progress_logs_duration_seconds_check
  check (duration_seconds is null or duration_seconds >= 0);

-- 4) Rellenar exercise_id en los registros que ya existen y siguen ligados a su rutina
update public.progress_logs pl
set exercise_id = re.exercise_id
from public.routine_exercises re
where pl.routine_exercise_id = re.id
  and pl.exercise_id is null;

-- 5) Índice para "Última vez" y la gráfica de fuerza por ejercicio
create index if not exists progress_logs_user_exercise_created_idx
  on public.progress_logs (user_id, exercise_id, created_at desc);

-- Sin cambios de RLS: las políticas actuales de progress_logs (INSERT y SELECT propios)
-- cubren las columnas nuevas. delete_my_account ya borra progress_logs del usuario.
