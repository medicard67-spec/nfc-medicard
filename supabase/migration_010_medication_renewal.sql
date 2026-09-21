-- Migration 010: medication renewal cycles. A medication can be given a
-- renewal frequency (weekly/monthly/quarterly/yearly); its end_date is then
-- computed from that cycle instead of being set manually via "Stop", and
-- the app flags it once that date passes without being renewed.
-- Run this once in the Supabase SQL Editor (after schema.sql / earlier migrations have already been applied).

alter table medications add column if not exists renewal_frequency text not null default 'none';
alter table medications add constraint medications_renewal_frequency_check
  check (renewal_frequency in ('none', 'weekly', 'monthly', 'quarterly', 'yearly'));
