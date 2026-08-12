-- NFC MediCard schema for Supabase (Postgres).
--
-- Auth is handled entirely by Supabase Auth (auth.users). This schema adds a
-- `profiles` table keyed on auth.users.id to store the app role (admin/doctor/
-- patient) plus role-specific detail tables.
--
-- All application access goes through the Express backend using the
-- service_role key, which bypasses Row Level Security entirely. RLS is enabled
-- on every table below with NO policies granted to the anon/authenticated
-- roles, so direct client-side access (e.g. from the browser's anon key) is
-- always denied -- mirroring the locked-down firestore.rules this project
-- used to ship with.

create extension if not exists "pgcrypto";

-- Drop any partial/stale tables from a previous run before recreating cleanly.
drop table if exists vitals cascade;
drop table if exists appointments cascade;
drop table if exists messages cascade;
drop table if exists radiology cascade;
drop table if exists lab_results cascade;
drop table if exists medical_history cascade;
drop table if exists patients cascade;
drop table if exists doctors cascade;
drop table if exists profiles cascade;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users row, carries the app role.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'doctor', 'patient')),
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- ---------------------------------------------------------------------------
-- doctors: role-specific detail for profiles.role = 'doctor'.
-- ---------------------------------------------------------------------------
create table if not exists doctors (
  id uuid primary key references profiles(id) on delete cascade,
  name text not null,
  email text not null,
  department text not null default 'General',
  hospital text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table doctors enable row level security;

-- ---------------------------------------------------------------------------
-- patients: role-specific detail for profiles.role = 'patient'.
-- card_uid is the physical NFC card's UID, unique and nullable (patients
-- registered manually may not have a card yet).
-- ---------------------------------------------------------------------------
create table if not exists patients (
  id uuid primary key references profiles(id) on delete cascade,
  name text not null,
  email text not null,
  ic text not null default '',
  dob date,
  age int,
  gender text not null default '',
  blood_type text not null default '',
  allergies text[] not null default '{}',
  chronic_illnesses text[] not null default '{}',
  height numeric,
  weight numeric,
  phone text not null default '',
  emergency_contact_name text not null default '',
  emergency_contact_phone text not null default '',
  card_uid text unique,
  registered_by text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table patients enable row level security;

-- ---------------------------------------------------------------------------
-- medical_history: past diagnoses / treatment notes per patient.
-- ---------------------------------------------------------------------------
create table if not exists medical_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  diagnosis text not null,
  date date not null default current_date,
  physician text not null,
  physician_id uuid,
  remarks text not null default '',
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table medical_history enable row level security;
create index if not exists medical_history_patient_id_idx on medical_history(patient_id);

-- ---------------------------------------------------------------------------
-- lab_results: diagnostic/lab test records, optional attached file.
-- ---------------------------------------------------------------------------
create table if not exists lab_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  test_name text not null,
  physician text not null,
  physician_id uuid,
  date date not null default current_date,
  flagged boolean not null default false,
  file_url text,
  file_name text,
  created_at timestamptz not null default now()
);

alter table lab_results enable row level security;
create index if not exists lab_results_patient_id_idx on lab_results(patient_id);

-- ---------------------------------------------------------------------------
-- radiology: imaging records (X-ray/MRI/CT) with attached file.
-- ---------------------------------------------------------------------------
create table if not exists radiology (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  type text not null,
  anatomy text not null default '',
  classification text not null default '',
  file_url text,
  file_name text,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

alter table radiology enable row level security;
create index if not exists radiology_patient_id_idx on radiology(patient_id);

-- ---------------------------------------------------------------------------
-- messages: doctor <-> patient messaging thread, keyed by patient.
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  doctor_id uuid,
  sender_role text not null,
  sender_name text not null,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;
create index if not exists messages_patient_id_idx on messages(patient_id);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  doctor_id uuid,
  doctor_name text,
  date date not null,
  notes text not null default '',
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

alter table appointments enable row level security;
create index if not exists appointments_patient_id_idx on appointments(patient_id);

-- ---------------------------------------------------------------------------
-- vitals: inpatient ward tracking (e.g. heart rate readings).
-- ---------------------------------------------------------------------------
create table if not exists vitals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  heart_rate int not null,
  note text not null default '',
  recorded_at timestamptz not null default now()
);

alter table vitals enable row level security;
create index if not exists vitals_patient_id_idx on vitals(patient_id);

-- ---------------------------------------------------------------------------
-- audit_log: records key mutating actions taken across the app (who did what,
-- when, to which record) for accountability / compliance tracking.
-- ---------------------------------------------------------------------------
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
