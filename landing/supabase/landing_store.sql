-- Optional persistence for the landing app on Vercel.
-- Run in the Supabase SQL editor. The CRM schema is not modified.
-- The landing app stores orders and licenses as one versioned JSON document.

create table if not exists public.landing_store (
  id text primary key,
  data jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.landing_store enable row level security;

-- No public policies. The landing server uses the service role key,
-- which bypasses RLS. Do not expose that key to the browser.
