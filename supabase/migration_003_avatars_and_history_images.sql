-- Migration 003: patient avatar photo + images attached to medical history entries.
-- Run this once in the Supabase SQL Editor (after schema.sql / migration_002 have already been applied).

alter table patients add column if not exists avatar_url text;
alter table medical_history add column if not exists image_urls text[] not null default '{}';
