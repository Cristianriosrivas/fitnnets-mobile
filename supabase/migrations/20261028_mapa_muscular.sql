-- Mapa muscular: compartir con amigos (opt-in) y estadísticas agregadas por ejercicio.
-- Repetible: se puede correr varias veces sin error.

-- 1) Permiso explícito del usuario. Por defecto NO se comparte (Ley 1581: el usuario decide).
alter table public.profiles
  add column if not exists share_muscle_map boolean not null default false;

-- 2) Estadísticas agregadas por ejercicio de un usuario: series totales y de los últimos 30 días,
--    sesiones y pesos (primero, último y máximo). Nunca devuelve medidas corporales ni registros sueltos.
--    Responde para uno mismo, o para un amigo ACEPTADO que activó share_muscle_map.
create or replace function public.get_muscle_stats(p_user_id uuid)
returns table (
  exercise_id uuid,
  name text,
  muscle_group text,
  sets_total bigint,
  sets_recent bigint,
  sessions bigint,
  first_weight numeric,
  last_weight numeric,
  max_weight numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_user_id <> v_uid then
    if not exists (
      select 1 from friendships f
      where f.status = 'aceptado'
        and ((f.user_id = v_uid and f.friend_id = p_user_id) or (f.user_id = p_user_id and f.friend_id = v_uid))
    ) then
      raise exception 'Solo puedes ver el mapa muscular de tus amigos';
    end if;

    if not exists (select 1 from profiles p where p.id = p_user_id and p.share_muscle_map) then
      raise exception 'Tu amigo no comparte su mapa muscular';
    end if;
  end if;

  return query
  select
    e.id,
    e.name,
    e.muscle_group,
    coalesce(sum(pl.sets_completed), 0)::bigint,
    coalesce(sum(pl.sets_completed) filter (where pl.date >= current_date - 30), 0)::bigint,
    count(distinct pl.date)::bigint,
    (array_agg(pl.weight_used_kg order by pl.created_at) filter (where pl.weight_used_kg is not null))[1],
    (array_agg(pl.weight_used_kg order by pl.created_at desc) filter (where pl.weight_used_kg is not null))[1],
    max(pl.weight_used_kg)
  from progress_logs pl
  join exercises e on e.id = pl.exercise_id
  where pl.user_id = p_user_id
  group by e.id, e.name, e.muscle_group;
end;
$$;

revoke all on function public.get_muscle_stats(uuid) from public;
revoke all on function public.get_muscle_stats(uuid) from anon;
grant execute on function public.get_muscle_stats(uuid) to authenticated;

-- 3) Seguridad de amistades: hoy cualquiera de los dos puede actualizar la fila, así que quien ENVÍA
--    una solicitud podría aceptarla él mismo por API y ganar acceso de "amigo" (assign_routine y este
--    mapa). Con esto solo quien RECIBE la solicitud puede aceptarla. Rechazar sigue siendo un delete
--    (la política de borrado no cambia). La app solo actualiza solicitudes recibidas.
drop policy if exists "Actualizar amistad" on public.friendships;
create policy "Actualizar amistad" on public.friendships
  for update to authenticated
  using (auth.uid() = friend_id)
  with check (auth.uid() = friend_id);
