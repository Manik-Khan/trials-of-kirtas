-- Remove retired structural.spells from rows with modern spellcasting data (2026-07-22).
-- Supabase structural JSON remains otherwise byte-for-byte unchanged. Future
-- reforges enforce the same rule in shards.html before saving.

update public.characters
set structural = structural - 'spells'
where jsonb_typeof(structural -> 'spellcasting') = 'object'
  and structural ? 'spells';
