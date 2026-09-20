-- Medications a patient is currently taking or has taken in the past.
-- A null end_date means it's still current; setting one marks it past.
create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  name text not null,
  dosage text not null,
  frequency text not null default '',
  start_date date not null default current_date,
  end_date date,
  prescribed_by text not null,
  prescribed_by_id uuid,
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table medications enable row level security;
create index if not exists medications_patient_id_idx on medications(patient_id);
