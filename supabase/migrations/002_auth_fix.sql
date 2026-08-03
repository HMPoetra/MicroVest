-- ============================================================
-- MicroVest — SQL Setup untuk Auth & Login
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- ─────────────────────────────────────────────
-- STEP 1: Buat tabel profiles (kalau belum ada)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- STEP 2: Trigger — auto-create profile saat user register
-- (INI YANG PALING PENTING untuk login & dashboard bisa jalan)
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 1. Auto-create data di tabel public.profiles
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, profiles.full_name);
    
  -- 2. HACK: Bypass Konfirmasi Email dengan langsung meng-update tabel auth.users
  update auth.users
  set email_confirmed_at = now()
  where id = new.id;

  return new;
end;
$$;

-- Drop trigger lama kalau ada, lalu buat ulang
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- STEP 3: Tabel assets (instrumen investasi)
-- ─────────────────────────────────────────────
create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  symbol      text not null unique,
  name        text not null,
  type        text not null check (type in ('emas', 'reksadana', 'obligasi')),
  unit        text not null default 'unit',
  description text,
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- STEP 4: Tabel price_history
-- ─────────────────────────────────────────────
create table if not exists public.price_history (
  id           bigserial primary key,
  asset_id     uuid references public.assets(id) on delete cascade not null,
  price        numeric(18,4) not null,
  recorded_at  date not null,
  source       text,
  unique (asset_id, recorded_at)
);

create index if not exists idx_price_history_asset_date
  on public.price_history (asset_id, recorded_at desc);

-- ─────────────────────────────────────────────
-- STEP 5: Tabel portfolios
-- ─────────────────────────────────────────────
create table if not exists public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  name        text not null,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- STEP 6: Tabel portfolio_holdings
-- ─────────────────────────────────────────────
create table if not exists public.portfolio_holdings (
  id             uuid primary key default gen_random_uuid(),
  portfolio_id   uuid references public.portfolios(id) on delete cascade not null,
  asset_id       uuid references public.assets(id) not null,
  quantity       numeric(18,6) not null check (quantity > 0),
  avg_buy_price  numeric(18,4) not null check (avg_buy_price > 0),
  buy_date       date not null,
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists idx_holdings_portfolio
  on public.portfolio_holdings (portfolio_id);

-- ─────────────────────────────────────────────
-- STEP 7: Tabel simulations
-- ─────────────────────────────────────────────
create table if not exists public.simulations (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  type         text not null check (type in ('var', 'compound_interest')),
  params       jsonb not null,
  result       jsonb not null,
  created_at   timestamptz default now()
);

create index if not exists idx_simulations_portfolio
  on public.simulations (portfolio_id, created_at desc);

-- ─────────────────────────────────────────────
-- STEP 8: Row Level Security (RLS)
-- ─────────────────────────────────────────────

-- profiles
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- portfolios
alter table public.portfolios enable row level security;
drop policy if exists "portfolios_all_own" on public.portfolios;
create policy "portfolios_all_own" on public.portfolios
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- portfolio_holdings
alter table public.portfolio_holdings enable row level security;
drop policy if exists "holdings_all_own" on public.portfolio_holdings;
create policy "holdings_all_own" on public.portfolio_holdings
  for all using (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  )
  with check (
    portfolio_id in (select id from public.portfolios where user_id = auth.uid())
  );

-- simulations
alter table public.simulations enable row level security;
drop policy if exists "simulations_all_own" on public.simulations;
create policy "simulations_all_own" on public.simulations
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- assets & price_history: data publik (baca semua, insert hanya service role)
alter table public.assets enable row level security;
drop policy if exists "assets_select_all" on public.assets;
create policy "assets_select_all" on public.assets for select using (true);

alter table public.price_history enable row level security;
drop policy if exists "price_history_select_all" on public.price_history;
create policy "price_history_select_all" on public.price_history for select using (true);

-- Izinkan service role insert ke assets & price_history (untuk sync harga)
drop policy if exists "assets_insert_service" on public.assets;
create policy "assets_insert_service" on public.assets
  for insert with check (true);

drop policy if exists "price_history_upsert_service" on public.price_history;
create policy "price_history_upsert_service" on public.price_history
  for all using (true) with check (true);

-- ─────────────────────────────────────────────
-- STEP 9: Seed data aset (kalau belum ada)
-- ─────────────────────────────────────────────
insert into public.assets (symbol, name, type, unit, description) values
  ('ANTAM_1GR',    'Emas Antam 1 Gram',           'emas',      'gram',  'Harga emas Antam per gram'),
  ('ANTAM_5GR',    'Emas Antam 5 Gram',            'emas',      'gram',  'Harga emas Antam per 5 gram'),
  ('UBS_1GR',      'Emas UBS 1 Gram',              'emas',      'gram',  'Harga emas UBS per gram'),
  ('RDPT_MANULIFE','Manulife Dana Saham',          'reksadana', 'unit',  'Reksa dana saham Manulife'),
  ('RDPU_BNI',     'BNI Dana Lancar',              'reksadana', 'unit',  'Reksa dana pasar uang BNI'),
  ('RDPC_SCHRODER','Schroder Dana Campuran',       'reksadana', 'unit',  'Reksa dana campuran Schroder'),
  ('SBR012',       'Savings Bond Ritel 012',       'obligasi',  'lembar','Obligasi negara ritel SBR012'),
  ('ORI023',       'Obligasi Ritel Indonesia 023', 'obligasi',  'lembar','ORI seri 023')
on conflict (symbol) do nothing;

-- ─────────────────────────────────────────────
-- STEP 10: Seed harga historis 365 hari
-- ─────────────────────────────────────────────
do $$
declare
  antam_id uuid;
  ubs_id   uuid;
  manu_id  uuid;
  bni_id   uuid;
  i        int;
begin
  select id into antam_id from public.assets where symbol = 'ANTAM_1GR';
  select id into ubs_id   from public.assets where symbol = 'UBS_1GR';
  select id into manu_id  from public.assets where symbol = 'RDPT_MANULIFE';
  select id into bni_id   from public.assets where symbol = 'RDPU_BNI';

  for i in 0..364 loop
    insert into public.price_history (asset_id, price, recorded_at, source) values
      (antam_id, 1050000 + (random() * 60000 - 30000), current_date - i, 'seed')
    on conflict (asset_id, recorded_at) do nothing;

    insert into public.price_history (asset_id, price, recorded_at, source) values
      (ubs_id, 1040000 + (random() * 60000 - 30000), current_date - i, 'seed')
    on conflict (asset_id, recorded_at) do nothing;

    insert into public.price_history (asset_id, price, recorded_at, source) values
      (manu_id, 20000 + (random() * 4000 - 2000), current_date - i, 'seed')
    on conflict (asset_id, recorded_at) do nothing;

    insert into public.price_history (asset_id, price, recorded_at, source) values
      (bni_id, 1200 + (random() * 20), current_date - i, 'seed')
    on conflict (asset_id, recorded_at) do nothing;
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- STEP 11: Update full_name untuk user yang sudah ada
-- (Fix untuk user yang sudah register sebelum trigger dibuat)
-- ─────────────────────────────────────────────
update public.profiles p
set full_name = coalesce(
  (select raw_user_meta_data->>'full_name' from auth.users u where u.id = p.id),
  split_part((select email from auth.users u where u.id = p.id), '@', 1)
)
where full_name is null or full_name = '';

-- Selesai! Cek hasilnya:
select 'profiles' as tabel, count(*) from public.profiles
union all
select 'assets', count(*) from public.assets
union all
select 'price_history', count(*) from public.price_history;
