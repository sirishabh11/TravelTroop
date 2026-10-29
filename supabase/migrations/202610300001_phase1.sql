-- Phase 1: owner-only rows, public invitation metadata, and private response capabilities.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  minimum_participants integer not null check (minimum_participants between 2 and 1000),
  invitation_token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
create index trips_owner_idx on public.trips(owner_id);
create table public.trip_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  destination text not null check (length(btrim(destination)) between 1 and 100),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  estimated_cost numeric(11,2) not null check (estimated_cost between 0 and 100000000)
);
create index trip_options_trip_idx on public.trip_options(trip_id);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
create unique index invitation_name_idx on public.invitations(trip_id, lower(btrim(name)));
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  invitation_id uuid unique references public.invitations(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  available_option_ids uuid[] not null check (cardinality(available_option_ids) between 1 and 20),
  max_budget numeric(11,2) not null check (max_budget between 0 and 100000000),
  preferred_destinations text[] not null check (cardinality(preferred_destinations) between 1 and 20),
  interests text[] not null check (cardinality(interests) between 1 and 6 and interests <@ array['Adventure','Sightseeing','Nightlife','Relaxation','Food','Culture']),
  commitment text not null check (commitment in ('Confirmed','Interested','Unsure')),
  edit_token_hash bytea not null unique,
  updated_at timestamptz not null default now()
);
create index responses_trip_idx on public.responses(trip_id);

alter table public.trips enable row level security;
alter table public.trip_options enable row level security;
alter table public.invitations enable row level security;
alter table public.responses enable row level security;
create policy "Leaders read their trips" on public.trips for select to authenticated using (owner_id = (select auth.uid()));
create policy "Leaders read their options" on public.trip_options for select to authenticated using (exists(select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));
create policy "Leaders read their invitation list" on public.invitations for select to authenticated using (exists(select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));
create policy "Leaders read their responses" on public.responses for select to authenticated using (exists(select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));
-- Never grant public table access. All mutations have bounded, validated RPC entry points.
revoke all on public.trips, public.trip_options, public.invitations, public.responses from anon, authenticated;
grant select on public.trips, public.trip_options, public.invitations to authenticated;
grant select (id,trip_id,invitation_id,name,available_option_ids,max_budget,preferred_destinations,interests,commitment,updated_at) on public.responses to authenticated;

create function public.add_invitees(target_trip uuid, names text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Lock the trip so concurrent additions cannot exceed the invitation cap.
  perform 1 from public.trips where id = target_trip and owner_id = auth.uid() for update;
  if not found then raise exception 'Trip unavailable or access denied'; end if;
  if names is null or cardinality(names) < 1 or cardinality(names) > 100
    or exists(select 1 from unnest(names) n where n is null or length(btrim(n)) not between 1 and 120)
    or (select count(*) from public.invitations where trip_id = target_trip) + cardinality(names) > 100 then
    raise exception 'Provide 1 to 100 valid invitation names; at most 100 per trip';
  end if;
  insert into public.invitations(trip_id,name) select target_trip,btrim(n) from unnest(names) n;
end; $$;

create function public.create_trip(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; option jsonb; names text[];
begin
  if auth.uid() is null then raise exception 'Sign in to create a trip'; end if;
  if jsonb_typeof(payload) is distinct from 'object'
    or jsonb_typeof(payload->'name') is distinct from 'string'
    or jsonb_typeof(payload->'description') is distinct from 'string'
    or jsonb_typeof(payload->'options') is distinct from 'array'
    or jsonb_typeof(payload->'invitees') is distinct from 'array' then raise exception 'Invalid trip data'; end if;
  if jsonb_array_length(payload->'options') not between 1 and 20 then raise exception 'Add 1 to 20 travel options'; end if;
  if jsonb_typeof(payload->'minimum_participants') is distinct from 'number'
    or (payload->>'minimum_participants')::numeric <> trunc((payload->>'minimum_participants')::numeric) then raise exception 'Minimum participants must be a whole number'; end if;
  insert into public.trips(owner_id,name,description,minimum_participants)
  values(auth.uid(),btrim(payload->>'name'),payload->>'description',(payload->>'minimum_participants')::integer) returning id into new_id;
  for option in select value from jsonb_array_elements(payload->'options') loop
    if jsonb_typeof(option->'destination') is distinct from 'string'
      or jsonb_typeof(option->'estimated_cost') is distinct from 'number'
      or (option->>'start_date') !~ '^\d{4}-\d{2}-\d{2}$' or (option->>'end_date') !~ '^\d{4}-\d{2}-\d{2}$'
      or (option->>'estimated_cost')::numeric <> round((option->>'estimated_cost')::numeric,2) then raise exception 'Invalid travel option'; end if;
    insert into public.trip_options(trip_id,destination,start_date,end_date,estimated_cost)
    values(new_id,btrim(option->>'destination'),(option->>'start_date')::date,(option->>'end_date')::date,(option->>'estimated_cost')::numeric);
  end loop;
  if exists(select 1 from jsonb_array_elements(payload->'invitees') n where jsonb_typeof(n) <> 'string') then raise exception 'Invitation names must be text'; end if;
  select coalesce(array_agg(value),'{}') into names from jsonb_array_elements_text(payload->'invitees');
  if cardinality(names) > 0 then perform public.add_invitees(new_id,names); end if;
  return new_id;
end; $$;

-- Both shared and named links expose only trip metadata, never response rows or the invitation list.
create function public.get_invitation(invitation_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',t.id,'name',t.name,'description',t.description,'minimum_participants',t.minimum_participants,
    'invited_name',i.name,'invitation_id',i.id,
    'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'destination',o.destination,'start_date',o.start_date,'end_date',o.end_date,'estimated_cost',o.estimated_cost) order by o.start_date,o.id),'[]'::jsonb) from public.trip_options o where o.trip_id=t.id))
  from public.trips t left join public.invitations i on i.trip_id=t.id and i.token=$1
  where t.invitation_token=$1 or i.id is not null limit 1;
$$;

create function public.get_own_response(edit_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',r.id,'name',r.name,'available_option_ids',r.available_option_ids,'max_budget',r.max_budget,
    'preferred_destinations',r.preferred_destinations,'interests',r.interests,'commitment',r.commitment,'invitation_id',r.invitation_id,'updated_at',r.updated_at)
  from public.responses r where length($1)=64 and r.edit_token_hash=extensions.digest($1,'sha256');
$$;

create function public.submit_response(invitation_token text, payload jsonb, edit_token text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare target_trip uuid; named_id uuid; available uuid[]; destinations text[]; hobbies text[]; capability text; budget numeric; existing public.responses%rowtype;
begin
  select t.id,i.id into target_trip,named_id from public.trips t
    left join public.invitations i on i.trip_id=t.id and i.token=submit_response.invitation_token
    where t.invitation_token=submit_response.invitation_token or i.id is not null limit 1;
  if target_trip is null then raise exception 'Invalid invitation'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or jsonb_typeof(payload->'name') is distinct from 'string'
    or jsonb_typeof(payload->'available_option_ids') is distinct from 'array'
    or jsonb_typeof(payload->'preferred_destinations') is distinct from 'array'
    or jsonb_typeof(payload->'interests') is distinct from 'array'
    or jsonb_typeof(payload->'max_budget') is distinct from 'number'
    or jsonb_typeof(payload->'commitment') is distinct from 'string' then raise exception 'Invalid response data'; end if;
  if jsonb_array_length(payload->'available_option_ids') not between 1 and 20
    or jsonb_array_length(payload->'preferred_destinations') not between 1 and 20
    or jsonb_array_length(payload->'interests') not between 1 and 6 then raise exception 'Choose available options, destinations and interests'; end if;
  if exists(select 1 from jsonb_array_elements(payload->'preferred_destinations') n where jsonb_typeof(n)<>'string')
    or exists(select 1 from jsonb_array_elements(payload->'interests') n where jsonb_typeof(n)<>'string') then raise exception 'Choices must be text'; end if;
  select array_agg(value::uuid) into available from jsonb_array_elements_text(payload->'available_option_ids');
  select array_agg(value) into destinations from jsonb_array_elements_text(payload->'preferred_destinations');
  select array_agg(value) into hobbies from jsonb_array_elements_text(payload->'interests');
  if exists(select 1 from unnest(available) a where a is null or not exists(select 1 from public.trip_options o where o.id=a and o.trip_id=target_trip))
    or exists(select 1 from unnest(destinations) d where d is null or not exists(select 1 from public.trip_options o where o.destination=d and o.trip_id=target_trip))
    or exists(select 1 from unnest(hobbies) h where h is null or h not in ('Adventure','Sightseeing','Nightlife','Relaxation','Food','Culture')) then
    raise exception 'Choose options belonging to this trip and valid interests';
  end if;
  budget := (payload->>'max_budget')::numeric;
  if budget <> round(budget,2) then raise exception 'Use at most two decimal places for your budget'; end if;
  if edit_token is not null then
    if length(edit_token) <> 64 then raise exception 'Invalid private edit link'; end if;
    select * into existing from public.responses r where r.edit_token_hash=extensions.digest(edit_token,'sha256') for update;
    if existing.id is null or existing.trip_id<>target_trip or existing.invitation_id is distinct from named_id then raise exception 'Invalid private edit link for this invitation'; end if;
    update public.responses set name=btrim(payload->>'name'),available_option_ids=available,max_budget=budget,
      preferred_destinations=destinations,interests=hobbies,commitment=payload->>'commitment',updated_at=now() where id=existing.id;
    return edit_token;
  end if;
  if named_id is not null and exists(select 1 from public.responses where invitation_id=named_id) then
    raise exception 'A response already exists for this personal invitation. Use the private edit link saved after submitting.';
  end if;
  capability := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.responses(trip_id,invitation_id,name,available_option_ids,max_budget,preferred_destinations,interests,commitment,edit_token_hash)
    values(target_trip,named_id,btrim(payload->>'name'),available,budget,destinations,hobbies,payload->>'commitment',extensions.digest(capability,'sha256'));
  return capability;
end; $$;

-- PostgreSQL grants function execution to PUBLIC by default: explicitly close every entry point.
revoke all on function public.create_trip(jsonb), public.add_invitees(uuid,text[]), public.get_invitation(text), public.get_own_response(text), public.submit_response(text,jsonb,text) from public, anon, authenticated;
grant execute on function public.create_trip(jsonb), public.add_invitees(uuid,text[]) to authenticated;
grant execute on function public.get_invitation(text), public.get_own_response(text), public.submit_response(text,jsonb,text) to anon, authenticated;
