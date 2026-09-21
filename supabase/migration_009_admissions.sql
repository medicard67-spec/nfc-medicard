-- Migration 009: hospital admissions. A patient can be admitted (warded);
-- medical history records added while an admission is open (discharged_at
-- is null) get tagged with it, so the UI can group a whole stay into one
-- entry instead of showing every update individually.
-- Run this once in the Supabase SQL Editor (after schema.sql / earlier migrations have already been applied).

create table if not exists admissions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  admitted_by text not null,
  admitted_by_id uuid,
  ward text not null default '',
  reason text not null default '',
  admitted_at timestamptz not null default now(),
  discharged_at timestamptz,
  discharged_by text,
  created_at timestamptz not null default now()
);

alter table admissions enable row level security;
create index if not exists admissions_patient_id_idx on admissions(patient_id);

alter table medical_history add column if not exists admission_id uuid references admissions(id) on delete set null;
create index if not exists medical_history_admission_id_idx on medical_history(admission_id);
