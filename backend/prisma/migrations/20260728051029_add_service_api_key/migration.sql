-- This migration was generated twice during a branch merge. The preceding
-- 20260728050000 migration already creates this nullable column and its unique
-- index. Keep this migration idempotent so existing and fresh databases share
-- the same migration history.
ALTER TABLE "servicios_externos" ADD COLUMN IF NOT EXISTS "api_key" TEXT;
