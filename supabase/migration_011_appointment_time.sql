-- Migration 011: appointment times. An appointment can now have a start time
-- as well as a date. Older appointments keep no time (shown as date only).
-- Run this once in the Supabase SQL Editor (after schema.sql / earlier migrations have already been applied).

alter table appointments add column if not exists start_time time;
