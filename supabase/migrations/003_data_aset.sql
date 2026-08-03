-- ============================================================
-- Migration 003: Data Aset & Sinkronisasi
-- ============================================================

-- 1. Pastikan tabel assets sudah dibuat (Penjaga Skema)
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  symbol text unique not null,
  name text not null,
  type text check (type in ('emas', 'reksadana', 'obligasi')) not null,
  unit text not null,
  description text
);

-- 2. Pastikan tabel price_history sudah dibuat (Penjaga Skema)
create table if not exists price_history (
  id bigserial primary key,
  asset_id uuid references assets(id) on delete cascade not null,
  price numeric(18,4) not null,
  recorded_at date not null,
  source text,
  unique (asset_id, recorded_at)
);

-- 3. Tambahkan Index untuk Performa Pencarian (sesuai instruksi)
create index if not exists idx_assets_symbol on assets (symbol);
create index if not exists idx_price_history_asset_id on price_history (asset_id);

-- 4. Buat Fungsi RPC untuk Mengambil Data Aset beserta Harga Terkini dan Sebelumnya
-- Menggunakan JOIN LATERAL agar efisien dan dapat dipanggil lewat Supabase-js
create or replace function get_asset_prices()
returns table (
  id uuid,
  symbol text,
  name text,
  type text,
  unit text,
  harga_terkini numeric,
  tanggal_terkini date,
  harga_sebelumnya numeric
)
language sql
stable
as $$
  select
    a.id,
    a.symbol,
    a.name,
    a.type,
    a.unit,
    p_now.price as harga_terkini,
    p_now.recorded_at as tanggal_terkini,
    p_prev.price as harga_sebelumnya
  from assets a
  join lateral (
    select price, recorded_at from price_history
    where asset_id = a.id
    order by recorded_at desc
    limit 1
  ) p_now on true
  left join lateral (
    select price from price_history
    where asset_id = a.id and recorded_at < p_now.recorded_at
    order by recorded_at desc
    limit 1
  ) p_prev on true
  order by a.type, a.name;
$$;

-- 5. Menyiapkan Ekstensi pg_cron (hanya jalan jika menggunakan database berbayar / self-hosted dengan akses)
-- Note: Pada Supabase Cloud Free/Pro, pg_cron seringkali dikelola melalui dashboard UI (pg_cron extension).
-- Instruksi berikut sebagai panduan:
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'sync-asset-prices',
--   '*/15 * * * *',
--   $$
--     select net.http_post(
--         url:='https://[PROJECT_REF].supabase.co/functions/v1/sync-asset-prices',
--         headers:='{"Authorization": "Bearer [ANON_KEY]"}'::jsonb
--     );
--   $$
-- );
