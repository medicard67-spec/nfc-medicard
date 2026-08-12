-- Migration 005: doctor's hospital of origin (Malaysia only, enforced in the app layer).
-- Run this once in the Supabase SQL Editor (after schema.sql / earlier migrations have already been applied).

alter table doctors add column if not exists hospital text not null default '';
