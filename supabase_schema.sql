-- Run this in your Supabase SQL editor
-- Project: Two Truths and a Lie game

create table if not exists games (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  phase       text not null default 'lobby',
  players     jsonb not null default '{}',
  rounds      jsonb not null default '[]',
  current_round integer not null default -1,
  scores      jsonb not null default '{}',
  votes       jsonb not null default '{}',
  voting_start timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Enable Row Level Security
alter table games enable row level security;

-- Allow anyone to read/write (public game — no auth needed)
create policy "Public read" on games for select using (true);
create policy "Public insert" on games for insert with check (true);
create policy "Public update" on games for update using (true);

-- Enable Realtime on the games table
alter publication supabase_realtime add table games;

-- Auto-cleanup: delete games older than 24 hours (optional)
-- You can set this up as a cron job in Supabase
-- delete from games where created_at < now() - interval '24 hours';
