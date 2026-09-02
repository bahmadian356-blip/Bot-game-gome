-- supabase/schema.sql
-- Database schema for BEHI PLAY

-- Profiles table for users
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  telegram_id bigint unique not null,
  username text,
  first_name text,
  score integer default 0,
  wins integer default 0,
  losses integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Games sessions table
create table if not exists games (
  id uuid default gen_random_uuid() primary key,
  code varchar(10) unique not null,
  game_type text not null,
  host_telegram_id bigint not null,
  max_players integer default 2,
  status text default 'waiting',
  winner_telegram_id bigint,
  result_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Game players table
create table if not exists game_players (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references games(id) on delete cascade,
  telegram_id bigint,
  is_bot boolean default false,
  bot_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Battleship boards table
create table if not exists battleship_boards (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references games(id) on delete cascade,
  telegram_id bigint,
  is_bot boolean default false,
  ships_json jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
