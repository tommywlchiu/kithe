-- Kithe waitlist: the public page may insert signups and answers, and nothing else.
-- Paste into Supabase > SQL Editor and run once.

create extension if not exists citext with schema extensions;

create table public.waitlist_signups (
  id uuid primary key,
  email extensions.citext not null unique
    check (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null check (phone in ('iphone', 'android')),
  is_adult boolean not null check (is_adult),
  ref text check (ref is null or ref ~ '^[a-z0-9_-]{1,32}$'),
  created_at timestamptz not null default now()
);

create table public.waitlist_answers (
  signup_id uuid primary key references public.waitlist_signups (id) on delete cascade,
  reason text not null check (reason in ('lease', 'cost', 'time', 'allergies', 'other')),
  created_at timestamptz not null default now()
);

-- Supabase grants every role full access to new public tables by default; take it back,
-- then allow only inserts from the anonymous (publishable-key) role.
revoke all on table public.waitlist_signups, public.waitlist_answers from anon, authenticated;
grant insert on table public.waitlist_signups, public.waitlist_answers to anon;

alter table public.waitlist_signups enable row level security;
alter table public.waitlist_answers enable row level security;

create policy "anyone can join the waitlist"
  on public.waitlist_signups for insert to anon
  with check (true);

create policy "anyone can answer the thank-you question"
  on public.waitlist_answers for insert to anon
  with check (true);

-- No select, update, or delete policies: signups are readable only in the dashboard
-- (service role), never with the key embedded in the page.

-- Phone split for the 12-Android-tester target. Run in the SQL Editor; not exposed to anon.
create view public.waitlist_phone_split
  with (security_invoker = true) as
  select phone, count(*) as signups
  from public.waitlist_signups
  group by phone;
revoke all on public.waitlist_phone_split from anon, authenticated;
