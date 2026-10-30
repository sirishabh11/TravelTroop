-- Phase 3A. No changes to the already-applied Phase 1 migration.
create table public.trip_decisions (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  option_id uuid not null references public.trip_options(id),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  source_version text not null,
  -- Authoritative immutable input snapshot: the shared Phase 2 engine renders
  -- the saved brief deterministically, without persisting untrusted AI prose.
  brief_snapshot jsonb not null
);
alter table public.trip_decisions enable row level security;
create policy "Owners read approved brief snapshots" on public.trip_decisions for select to authenticated
  using (exists(select 1 from public.trips t where t.id=trip_id and t.owner_id=(select auth.uid())));
revoke all on public.trip_decisions from anon,authenticated;
grant select on public.trip_decisions to authenticated;

create table public.assistant_usage (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  day date not null,
  minute timestamptz not null,
  daily_calls integer not null,
  minute_calls integer not null
);
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from anon,authenticated;

create function public.get_leader_context(target_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare payload jsonb;
begin
  if not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid()) then raise exception 'Trip unavailable or access denied' using errcode='42501'; end if;
  if (select count(*) from public.responses where trip_id=target_trip)>2000 then raise exception 'This assistant supports up to 2000 responses per trip'; end if;
  select jsonb_build_object(
    'trip',jsonb_build_object('id',t.id,'owner_id',t.owner_id,'name',t.name,'minimum_participants',t.minimum_participants),
    'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'destination',o.destination,'start_date',o.start_date,'end_date',o.end_date,'estimated_cost',o.estimated_cost) order by o.id),'[]'::jsonb) from public.trip_options o where o.trip_id=t.id),
    'responses',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'available_option_ids',r.available_option_ids,'max_budget',r.max_budget,'preferred_destinations',r.preferred_destinations,'interests',r.interests,'commitment',r.commitment,'invitation_id',r.invitation_id,'updated_at',r.updated_at) order by r.id),'[]'::jsonb) from public.responses r where r.trip_id=t.id),
    'invitees',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name) order by i.id),'[]'::jsonb) from public.invitations i where i.trip_id=t.id)
  ) into payload from public.trips t where t.id=target_trip;
  return payload || jsonb_build_object('version',encode(extensions.digest(payload::text,'sha256'),'hex'));
end; $$;

create function public.get_trip_decision(target_trip uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid()) then raise exception 'Trip unavailable or access denied' using errcode='42501'; end if;
  return (select to_jsonb(d) from public.trip_decisions d where d.trip_id=target_trip);
end; $$;

create function public.approve_trip_decision(target_trip uuid, selected_option uuid, expected_version text, approved boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; result public.trip_decisions%rowtype;
begin
  perform 1 from public.trips where id=target_trip and owner_id=auth.uid() for update;
  if not found then raise exception 'Trip unavailable or access denied' using errcode='42501'; end if;
  if approved is distinct from true then raise exception 'Explicit leader approval is required'; end if;
  if not exists(select 1 from public.trip_options where id=selected_option and trip_id=target_trip) then raise exception 'Choose an existing saved scenario'; end if;
  snapshot:=public.get_leader_context(target_trip);
  if expected_version is null or expected_version is distinct from snapshot->>'version' then raise exception 'Trip responses changed. Generate and review a new preview before approving.' using errcode='40001'; end if;
  insert into public.trip_decisions(trip_id,option_id,approved_by,approved_at,source_version,brief_snapshot)
    values(target_trip,selected_option,auth.uid(),now(),snapshot->>'version',snapshot)
    on conflict(trip_id) do update set option_id=excluded.option_id,approved_by=excluded.approved_by,approved_at=excluded.approved_at,source_version=excluded.source_version,brief_snapshot=excluded.brief_snapshot
    returning * into result;
  return to_jsonb(result);
end; $$;

create function public.reserve_assistant_call(target_trip uuid) returns void
language plpgsql security definer set search_path='' as $$
declare current_day date := (now() at time zone 'UTC')::date; current_minute timestamptz := date_trunc('minute',now());
begin
  if not exists(select 1 from public.trips where id=target_trip and owner_id=auth.uid()) then raise exception 'Trip unavailable or access denied' using errcode='42501'; end if;
  insert into public.assistant_usage(owner_id,day,minute,daily_calls,minute_calls) values(auth.uid(),current_day,current_minute,1,1)
  on conflict(owner_id) do update set day=current_day,minute=current_minute,
    daily_calls=case when assistant_usage.day=current_day then assistant_usage.daily_calls+1 else 1 end,
    minute_calls=case when assistant_usage.minute=current_minute then assistant_usage.minute_calls+1 else 1 end
  where (assistant_usage.day<>current_day or assistant_usage.daily_calls<100) and (assistant_usage.minute<>current_minute or assistant_usage.minute_calls<6);
  if not found then raise exception 'AI request limit reached. Use the rule-based explanation or try again later.'; end if;
end; $$;

revoke all on function public.get_leader_context(uuid),public.get_trip_decision(uuid),public.approve_trip_decision(uuid,uuid,text,boolean),public.reserve_assistant_call(uuid) from public,anon,authenticated;
grant execute on function public.get_leader_context(uuid),public.get_trip_decision(uuid),public.approve_trip_decision(uuid,uuid,text,boolean),public.reserve_assistant_call(uuid) to authenticated;
