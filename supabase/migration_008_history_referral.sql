-- Migration 008: department on each history record, and optional referral
-- to another doctor (by name) or another department when a record is added.
-- Run this once in the Supabase SQL Editor (after schema.sql / earlier migrations have already been applied).

alter table medical_history add column if not exists physician_department text not null default 'General';
alter table medical_history add column if not exists referred_to_doctor_id uuid;
alter table medical_history add column if not exists referred_to_doctor_name text;
alter table medical_history add column if not exists referred_to_doctor_department text;
alter table medical_history add column if not exists referred_to_department text;
