-- Migration 004: doctor profile picture.
-- Run this once in the Supabase SQL Editor (after schema.sql / earlier migrations have already been applied).

alter table doctors add column if not exists avatar_url text;
