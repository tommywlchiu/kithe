-- Kithe waitlist, step 2: the page calls two functions instead of writing to the tables.
-- Paste into Supabase > SQL Editor and run once, after 0001.
--
-- Why: a direct insert told the caller whether an email was already listed (409), let
-- callers set created_at, and had no brake on scripted bulk inserts. These functions answer
-- the same way whether or not the email exists, write only the allowed columns, and refuse
-- bursts. The anonymous role loses direct table access entirely.

create or replace function public.join_waitlist(
  p_id uuid,
  p_email text,
  p_phone text,
  p_is_adult boolean,
  p_ref text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Far above any real launch-day rate; stops a script from filling the list.
  if (select count(*) from public.waitlist_signups
      where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'busy' using errcode = 'P0001';
  end if;

  insert into public.waitlist_signups (id, email, phone, is_adult, ref)
  values (p_id, lower(trim(p_email)), p_phone, p_is_adult, p_ref)
  on conflict (email) do nothing;
end;
$$;

create or replace function public.answer_waitlist(p_signup_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Silently ignored when the signup id is unknown (for example a repeat signup).
  insert into public.waitlist_answers (signup_id, reason)
  select p_signup_id, p_reason
  where exists (select 1 from public.waitlist_signups where id = p_signup_id)
  on conflict (signup_id) do nothing;
end;
$$;

revoke all on function public.join_waitlist(uuid, text, text, boolean, text) from public;
revoke all on function public.answer_waitlist(uuid, text) from public;
grant execute on function public.join_waitlist(uuid, text, text, boolean, text) to anon;
grant execute on function public.answer_waitlist(uuid, text) to anon;

-- The page no longer writes to the tables directly.
revoke insert on table public.waitlist_signups, public.waitlist_answers from anon;
drop policy if exists "anyone can join the waitlist" on public.waitlist_signups;
drop policy if exists "anyone can answer the thank-you question" on public.waitlist_answers;
