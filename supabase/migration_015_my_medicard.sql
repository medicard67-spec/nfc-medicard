-- Migration 015: "My MediCard" — lost cards, replaced cards and patients
-- linking their own card with an emailed code.
-- Run this once in the Supabase SQL Editor (after schema.sql / earlier migrations have already been applied).

-- A lost card stays on the patient (so scanning it can warn "reported lost")
-- until it is found again or replaced.
alter table patients add column if not exists card_status text not null default 'active';
alter table patients drop constraint if exists patients_card_status_check;
alter table patients add constraint patients_card_status_check check (card_status in ('active', 'lost'));
alter table patients add column if not exists card_lost_at timestamptz;

-- Cards that were replaced. They stay blocked for good and form the
-- patient's card history.
create table if not exists retired_cards (
  card_uid text primary key,
  patient_id uuid references patients(id) on delete cascade,
  reason text not null default 'lost',
  linked_at timestamptz,
  retired_at timestamptz not null default now()
);

alter table retired_cards enable row level security;
create index if not exists retired_cards_patient_id_idx on retired_cards(patient_id);

-- A patient waiting to type the emailed code that links a card they tapped.
-- One at a time per patient; the code itself is checked by Supabase Auth.
create table if not exists card_link_requests (
  patient_id uuid primary key references patients(id) on delete cascade,
  card_uid text not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table card_link_requests enable row level security;
