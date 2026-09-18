-- Registration-desk check-in queue: scanning a patient's card at the front
-- desk assigns a ticket number (resets daily) and a room, instead of opening
-- their full record. Run this against an existing project; fresh setups get
-- it via schema.sql directly.

create table if not exists queue_tickets (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  patient_name text not null,
  number int not null,
  room text not null,
  checked_in_by text,
  created_at timestamptz not null default now()
);

alter table queue_tickets enable row level security;
create index if not exists queue_tickets_patient_id_idx on queue_tickets(patient_id);
create index if not exists queue_tickets_created_at_idx on queue_tickets(created_at desc);
