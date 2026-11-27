-- =====================================================================
-- Phase 3 – block L (D25): Settings → AI, one for the whole system.
-- Provider Gemini behind an adapter in the Edge Function ai-gateway; the API key only in Vault
-- (write-only from the UI); model per purpose chosen by the owner (no model name is invented
-- here); feature flags per function; prices of models entered by the owner; usage and a fuse:
-- budget 5,00 € (one-off), AI switched off at 4,50 € (both adjustable).
-- Source: docs/analyzy/ANALYZA-AI-IMPORT-KATALOGU.md, ANALYZA-AI-EMAIL-TRIAZ.md (approved).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. settings and flags
-- ---------------------------------------------------------------------
insert into public.system_settings (key, value, description) values
  ('ai_provider', '"gemini"'::jsonb, 'AI: poskytovateľ (za adaptérom v Edge Function ai-gateway).'),
  ('ai_models', '{"catalog_assist": "", "email_triage": ""}'::jsonb,
   'AI: model podľa účelu – vyberá vlastník; prázdne = funkcia nemá model.'),
  ('ai_budget_limit_eur', '5.00'::jsonb, 'AI: rozpočet v EUR (jednorazový).'),
  ('ai_budget_cutoff_eur', '4.50'::jsonb, 'AI: pri tejto spotrebe sa AI vypne (poistka).')
on conflict (key) do nothing;

insert into public.feature_flags (key, enabled, note) values
  ('ai_catalog_assist', false, 'AI asistent katalógu (F3.5): návrh položky zo screenshotu alebo PDF.'),
  ('ai_email_triage', false, 'AI triáž e-mailov (F4.5): návrh priradenia a konceptu odpovede.')
on conflict (key) do nothing;

-- values of the AI settings are checked (wrong JSON would switch the fuse off silently)
create function private.check_ai_settings() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  limit_eur numeric;
  cutoff_eur numeric;
begin
  if new.key = 'ai_provider' and (jsonb_typeof(new.value) <> 'string' or new.value #>> '{}' not in ('gemini')) then
    raise exception 'ai_provider: unknown provider' using errcode = '23514', hint = 'ai_provider';
  end if;
  if new.key = 'ai_models' and (
       jsonb_typeof(new.value) <> 'object'
       or exists (select 1 from jsonb_each(new.value) e
                   where jsonb_typeof(e.value) <> 'string' or length(e.value #>> '{}') > 100
                      or (e.value #>> '{}') !~ '^[A-Za-z0-9._/-]*$')) then
    raise exception 'ai_models: an object of model names' using errcode = '23514', hint = 'ai_models';
  end if;
  if new.key in ('ai_budget_limit_eur', 'ai_budget_cutoff_eur') then
    if jsonb_typeof(new.value) <> 'number' or (new.value #>> '{}')::numeric < 0
       or (new.value #>> '{}')::numeric > 1000 then
      raise exception '%: amount 0–1000 EUR', new.key using errcode = '23514', hint = 'ai_budget';
    end if;
    limit_eur := case when new.key = 'ai_budget_limit_eur' then (new.value #>> '{}')::numeric
                      else (select (s.value #>> '{}')::numeric from public.system_settings s where s.key = 'ai_budget_limit_eur') end;
    cutoff_eur := case when new.key = 'ai_budget_cutoff_eur' then (new.value #>> '{}')::numeric
                       else (select (s.value #>> '{}')::numeric from public.system_settings s where s.key = 'ai_budget_cutoff_eur') end;
    if cutoff_eur > limit_eur then
      raise exception 'the cut-off must not be above the budget' using errcode = '23514', hint = 'ai_cutoff';
    end if;
  end if;
  return new;
end;
$$;
create trigger check_ai_settings before insert or update on public.system_settings
  for each row when (new.key like 'ai\_%') execute function private.check_ai_settings();

-- ---------------------------------------------------------------------
-- 2. prices of models (entered by the owner; without a price the gateway refuses the call)
-- ---------------------------------------------------------------------
create table public.ai_model_prices (
  model               text primary key check (model ~ '^[A-Za-z0-9._/-]{1,100}$'),
  input_eur_per_mtok  numeric(10,4) not null check (input_eur_per_mtok >= 0),
  output_eur_per_mtok numeric(10,4) not null check (output_eur_per_mtok >= 0),
  valid_from          date not null default current_date,
  note                text check (length(note) <= 500),
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id),
  updated_at          timestamptz not null default now(),
  updated_by          uuid
);
select private.setup_admin_table('ai_model_prices', true);

-- ---------------------------------------------------------------------
-- 3. API key: the secret only in Vault; here only its id and the last 4 characters.
--    No access for the app at all – only the functions below.
-- ---------------------------------------------------------------------
create table public.ai_provider_keys (
  provider        text primary key check (provider in ('gemini')),
  vault_secret_id uuid not null,
  last4           text not null check (length(last4) = 4),
  set_at          timestamptz not null default now(),
  set_by          uuid references auth.users (id) on delete set null
);
alter table public.ai_provider_keys enable row level security;
-- the rule for every table; there is no other policy and no grant: the app never reads it
create policy require_aal2 on public.ai_provider_keys as restrictive to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
revoke all on public.ai_provider_keys from anon, authenticated;
grant all on public.ai_provider_keys to service_role;

-- state of the key for the UI: set / last 4 characters / when / who – never the key
create function public.ai_key_status()
returns table (provider text, is_set boolean, last4 text, set_at timestamptz, set_by_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' or not private.has_role('admin') then
    raise exception 'admin with two-factor sign-in required' using errcode = '42501';
  end if;
  return query
    select p.provider, k.provider is not null, k.last4, k.set_at, coalesce(pr.full_name, pr.email)
      from (values ('gemini'::text)) as p(provider)
      left join public.ai_provider_keys k on k.provider = p.provider
      left join public.profiles pr on pr.id = k.set_by;
end;
$$;
revoke all on function public.ai_key_status() from public, anon;
grant execute on function public.ai_key_status() to authenticated;

-- service role only (Edge Function ai-gateway): store / replace, delete, read the key
create function public.ai_store_key(p_provider text, p_secret text, p_user uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
  tail text := right(p_secret, 4);
begin
  if p_provider not in ('gemini') then
    raise exception 'unknown provider' using errcode = '23514';
  end if;
  if p_secret is null or length(p_secret) not between 20 and 200 or p_secret ~ '\s' then
    raise exception 'the key has an unexpected format' using errcode = '23514', hint = 'key_format';
  end if;
  select vault_secret_id into sid from public.ai_provider_keys where provider = p_provider;
  if sid is null then
    sid := vault.create_secret(p_secret, 'ai_key_' || p_provider || '_' || gen_random_uuid(), 'AI API key (Settings → AI)');
  else
    perform vault.update_secret(sid, p_secret);
  end if;
  insert into public.ai_provider_keys (provider, vault_secret_id, last4, set_at, set_by)
  values (p_provider, sid, tail, now(), p_user)
  on conflict (provider) do update
    set vault_secret_id = excluded.vault_secret_id, last4 = excluded.last4, set_at = now(), set_by = excluded.set_by;
  -- the change history has who and when, never the key
  insert into public.activity_logs (table_name, record_id, action, new_data, actor, note)
  values ('ai_provider_keys', p_user, 'update', jsonb_build_object('provider', p_provider, 'last4', tail),
          p_user, 'AI API key set or replaced');
  return tail;
end;
$$;

create function public.ai_delete_key(p_provider text, p_user uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  delete from public.ai_provider_keys where provider = p_provider returning vault_secret_id into sid;
  if sid is null then
    return false;
  end if;
  delete from vault.secrets where id = sid;
  insert into public.activity_logs (table_name, record_id, action, old_data, actor, note)
  values ('ai_provider_keys', p_user, 'delete', jsonb_build_object('provider', p_provider), p_user, 'AI API key removed');
  return true;
end;
$$;

create function public.ai_get_key(p_provider text) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
    from public.ai_provider_keys k
    join vault.decrypted_secrets s on s.id = k.vault_secret_id
   where k.provider = p_provider;
$$;

revoke all on function public.ai_store_key(text, text, uuid) from public, anon, authenticated;
revoke all on function public.ai_delete_key(text, uuid) from public, anon, authenticated;
revoke all on function public.ai_get_key(text) from public, anon, authenticated;
grant execute on function public.ai_store_key(text, text, uuid) to service_role;
grant execute on function public.ai_delete_key(text, uuid) to service_role;
grant execute on function public.ai_get_key(text) to service_role;

-- ---------------------------------------------------------------------
-- 4. usage – written only by the gateway (service role), read by the admin
-- ---------------------------------------------------------------------
create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  at            timestamptz not null default now(),
  feature       text not null check (feature ~ '^[a-z_]{1,40}$'),
  model         text not null check (length(model) between 1 and 100),
  input_tokens  int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cost_eur      numeric(12,6) not null default 0 check (cost_eur >= 0),
  user_id       uuid references auth.users (id) on delete set null,
  ok            boolean not null,
  error_code    text check (length(error_code) <= 60)
);
create index ai_usage_at_idx on public.ai_usage (at desc);
alter table public.ai_usage enable row level security;
create policy require_aal2 on public.ai_usage as restrictive to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
create policy ai_usage_admin_select on public.ai_usage for select to authenticated
  using ((select private.has_role('admin')));
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;

-- spent / budget / cut-off → ok, warn50, warn90, blocked (the fuse)
create function private.ai_budget_state(out spent_eur numeric, out limit_eur numeric, out cutoff_eur numeric,
                                        out pct numeric, out state text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  select coalesce(sum(u.cost_eur), 0) into spent_eur from public.ai_usage u;
  limit_eur := coalesce((select (s.value #>> '{}')::numeric from public.system_settings s where s.key = 'ai_budget_limit_eur'), 5.00);
  cutoff_eur := coalesce((select (s.value #>> '{}')::numeric from public.system_settings s where s.key = 'ai_budget_cutoff_eur'), 4.50);
  pct := case when limit_eur > 0 then round(spent_eur / limit_eur * 100, 1) else 100 end;
  state := case
    when spent_eur >= cutoff_eur then 'blocked'
    when spent_eur >= limit_eur * 0.9 then 'warn90'
    when spent_eur >= limit_eur * 0.5 then 'warn50'
    else 'ok' end;
end;
$$;
revoke all on function private.ai_budget_state() from public, anon, authenticated;

-- for the UI (admin, aal2) and the gateway (service role)
create function public.ai_budget_status(out spent_eur numeric, out limit_eur numeric, out cutoff_eur numeric,
                                        out pct numeric, out state text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and (coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' or not private.has_role('admin')) then
    raise exception 'admin with two-factor sign-in required' using errcode = '42501';
  end if;
  select * into spent_eur, limit_eur, cutoff_eur, pct, state from private.ai_budget_state();
end;
$$;
revoke all on function public.ai_budget_status() from public, anon;
grant execute on function public.ai_budget_status() to authenticated, service_role;

-- overview: total, per function, per month
create view public.v_ai_usage_summary with (security_invoker = true) as
select 'total'::text as scope, 'spolu'::text as key, count(*)::int as calls,
       coalesce(sum(input_tokens), 0)::bigint as input_tokens, coalesce(sum(output_tokens), 0)::bigint as output_tokens,
       coalesce(sum(cost_eur), 0)::numeric(12,6) as cost_eur
  from public.ai_usage
having count(*) > 0
union all
select 'feature', feature, count(*)::int, sum(input_tokens)::bigint, sum(output_tokens)::bigint, sum(cost_eur)::numeric(12,6)
  from public.ai_usage group by feature
union all
select 'month', to_char(date_trunc('month', at), 'YYYY-MM'), count(*)::int, sum(input_tokens)::bigint,
       sum(output_tokens)::bigint, sum(cost_eur)::numeric(12,6)
  from public.ai_usage group by date_trunc('month', at);
revoke all on public.v_ai_usage_summary from anon;
grant select on public.v_ai_usage_summary to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. notification events: 50 % and 90 % of the AI budget (sending in phase 8)
-- ---------------------------------------------------------------------
alter table public.notification_recipients drop constraint notification_recipients_known_events;
alter table public.notification_recipients add constraint notification_recipients_known_events
  check (event_types <@ array['data_review_due', 'ai_budget_50', 'ai_budget_90']);
