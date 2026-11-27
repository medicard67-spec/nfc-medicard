-- Migration 016: the online MediCard — a patient's phone acting as their card.
-- Run this once in the Supabase SQL Editor (after migration 015).

-- One row per phone the card was added to. The phone keeps the token and
-- hands it to the staff reader when tapped; only its SHA-256 is stored here.
-- A phone card follows the physical card it was added from: when that card
-- is reported lost or replaced, the phone card stops working too.
create table if not exists online_cards (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  card_uid text not null,
  token_hash text not null unique,
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table online_cards enable row level security;
create index if not exists online_cards_patient_id_idx on online_cards(patient_id);
