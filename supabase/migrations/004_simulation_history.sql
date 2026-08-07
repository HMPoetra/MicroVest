-- ─────────────────────────────────────────────
-- Migration 004: Simulation History Support
-- ─────────────────────────────────────────────
-- Allows saving custom (non-portfolio) simulations and adds labeling support.

-- 1. Ubah portfolio_id menjadi nullable (mendukung simulasi custom)
ALTER TABLE public.simulations 
  ALTER COLUMN portfolio_id DROP NOT NULL;

-- 2. Tambah kolom label opsional untuk penamaan simulasi
ALTER TABLE public.simulations 
  ADD COLUMN IF NOT EXISTS label text;

-- 3. Index tambahan untuk query riwayat per user berdasarkan tipe
CREATE INDEX IF NOT EXISTS idx_simulations_user_type 
  ON public.simulations (user_id, type, created_at DESC);
