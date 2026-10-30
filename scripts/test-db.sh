#!/usr/bin/env bash
# Isolated PostgreSQL integration tests. No production connection or exposed ports.
set -euo pipefail
cd "$(dirname "$0")/.."
container="traveltroop-db-test-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# No password is used because this throwaway instance has no network or host port.
docker run --rm -d --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
ready=false
for _ in $(seq 1 30); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then docker logs "$container"; exit 1; fi
docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 <<'SQL'
-- Minimal Supabase Auth contract for PostgreSQL/RLS tests only.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema public,auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
SQL
for migration in supabase/migrations/*.sql; do
  docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 < "$migration"
done
docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 < supabase/tests/access.sql

docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 < supabase/tests/assistant.sql
