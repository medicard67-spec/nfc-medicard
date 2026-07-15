-- Migration 002: audit log + unread message flag.
-- Run this once in the Supabase SQL Editor (after schema.sql has already been applied).

alter table messages add column if not exists read boolean not null default false;

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);
