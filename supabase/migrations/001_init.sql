-- ============================================================
-- MicroVest — Database Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Profiles (extends Supabase auth.users)
-- ─────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- 2. Assets (master data instrumen investasi)
-- ─────────────────────────────────────────────
create table if not exists assets (
  id          uuid primary key default gen_random_uuid(),
  symbol      text not null unique,   -- e.g. 'ANTAM_1GR', 'RDPT_MANULIFE'
  name        text not null,
  type        text not null check (type in ('emas', 'reksadana', 'obligasi')),
  unit        text not null default 'unit',
  description text,
  created_at  timestamptz default now()
);

-- Seed: default assets
insert into assets (symbol, name, type, unit, description) values
  ('ANTAM_1GR',    'Emas Antam 1 Gram',              'emas',      'gram',  'Harga emas Antam per gram'),
  ('ANTAM_5GR',    'Emas Antam 5 Gram',              'emas',      'gram',  'Harga emas Antam per 5 gram'),
  ('UBS_1GR',      'Emas UBS 1 Gram',                'emas',      'gram',  'Harga emas UBS per gram'),
  ('RDPT_MANULIFE','Manulife Dana Saham',             'reksadana', 'unit',  'Reksa dana saham Manulife'),
  ('RDPU_BNI',     'BNI Dana Lancar',                'reksadana', 'unit',  'Reksa dana pasar uang BNI'),
  ('RDPC_SCHRODER','Schroder Dana Campuran',         'reksadana', 'unit',  'Reksa dana campuran Schroder'),
  ('SBR012',       'Savings Bond Ritel 012',         'obligasi',  'lembar','Obligasi negara ritel SBR012'),
  ('ORI023',       'Obligasi Ritel Indonesia 023',   'obligasi',  'lembar','ORI seri 023')
on conflict (symbol) do nothing;

-- ─────────────────────────────────────────────
-- 3. Price History (hasil sinkronisasi harga)
-- ─────────────────────────────────────────────
create table if not exists price_history (
  id           bigserial primary key,
  asset_id     uuid references assets(id) on delete cascade not null,
  price        numeric(18,4) not null,
  recorded_at  date not null,
  source       text,               -- 'antam_api', 'manual_seed', dll.
  unique (asset_id, recorded_at)
);

create index if not exists idx_price_history_asset_date
  on price_history (asset_id, recorded_at desc);

-- Seed: data harga historis contoh (60 hari terakhir dari today)
-- Emas Antam 1gr: kisaran Rp 1.000.000 - 1.100.000
do $$
declare
  antam_id uuid;
  ubs_id   uuid;
  manu_id  uuid;
  bni_id   uuid;
  i        int;
begin
  select id into antam_id from assets where symbol = 'ANTAM_1GR';
  select id into ubs_id   from assets where symbol = 'UBS_1GR';
  select id into manu_id  from assets where symbol = 'RDPT_MANULIFE';
  select id into bni_id   from assets where symbol = 'RDPU_BNI';

  for i in 0..364 loop
    -- Emas Antam: base 1.050.000 + random walk
    insert into price_history (asset_id, price, recorded_at, source)
    values (
      antam_id,
      1050000 + (random() * 60000 - 30000),
      current_date - i,
      'manual_seed'
    ) on conflict (asset_id, recorded_at) do nothing;

    -- Emas UBS: sedikit lebih murah
    insert into price_history (asset_id, price, recorded_at, source)
    values (
      ubs_id,
      1040000 + (random() * 60000 - 30000),
      current_date - i,
      'manual_seed'
    ) on conflict (asset_id, recorded_at) do nothing;

    -- Reksadana Manulife NAB: base 20.000 + random walk
    insert into price_history (asset_id, price, recorded_at, source)
    values (
      manu_id,
      20000 + (random() * 4000 - 2000),
      current_date - i,
      'manual_seed'
    ) on conflict (asset_id, recorded_at) do nothing;

    -- Reksadana BNI: base 1200 (money market, stabil)
    insert into price_history (asset_id, price, recorded_at, source)
    values (
      bni_id,
      1200 + (random() * 20),
      current_date - i,
      'manual_seed'
    ) on conflict (asset_id, recorded_at) do nothing;
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- 4. Portfolios
-- ─────────────────────────────────────────────
create table if not exists portfolios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade not null,
  name        text not null,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 5. Portfolio Holdings
-- ─────────────────────────────────────────────
create table if not exists portfolio_holdings (
  id             uuid primary key default gen_random_uuid(),
  portfolio_id   uuid references portfolios(id) on delete cascade not null,
  asset_id       uuid references assets(id) not null,
  quantity       numeric(18,6) not null check (quantity > 0),
  avg_buy_price  numeric(18,4) not null check (avg_buy_price > 0),
  buy_date       date not null,
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists idx_holdings_portfolio
  on portfolio_holdings (portfolio_id);

-- ─────────────────────────────────────────────
-- 6. Simulations (hasil tersimpan)
-- ─────────────────────────────────────────────
create table if not exists simulations (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid references portfolios(id) on delete cascade not null,
  user_id      uuid references profiles(id) on delete cascade not null,
  type         text not null check (type in ('var', 'compound_interest')),
  params       jsonb not null,   -- { confidence: 0.95, period_days: 252, ... }
  result       jsonb not null,   -- { var_value: ..., projection: [...] }
  created_at   timestamptz default now()
);

create index if not exists idx_simulations_portfolio
  on simulations (portfolio_id, created_at desc);

-- ─────────────────────────────────────────────
-- 7. Row Level Security (RLS)
-- ─────────────────────────────────────────────

-- profiles: user hanya lihat/edit profil sendiri
alter table profiles enable row level security;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- portfolios: user hanya akses portofolio sendiri
alter table portfolios enable row level security;
create policy "portfolios_all_own" on portfolios
  for all using (auth.uid() = user_id);

-- portfolio_holdings: via portfolio ownership
alter table portfolio_holdings enable row level security;
create policy "holdings_all_own" on portfolio_holdings
  for all using (
    portfolio_id in (select id from portfolios where user_id = auth.uid())
  );

-- simulations: via user_id
alter table simulations enable row level security;
create policy "simulations_all_own" on simulations
  for all using (auth.uid() = user_id);

-- assets & price_history: data publik, semua user bisa baca
alter table assets enable row level security;
create policy "assets_select_all" on assets
  for select using (true);

alter table price_history enable row level security;
create policy "price_history_select_all" on price_history
  for select using (true);
