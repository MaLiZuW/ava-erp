-- Block L (D25): Settings → AI – key only in Vault and never readable by the app, prices,
-- usage written only by the gateway, budget fuse, checked settings, notification events.
select * from no_plan();

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'nobody@test.local');
insert into public.user_roles (user_id, role) values ('a0000000-0000-0000-0000-00000000000a', 'admin');

-- defaults ---------------------------------------------------------------------------------------
select is((select value #>> '{}' from public.system_settings where key = 'ai_provider'), 'gemini', 'provider Gemini');
select is((select value from public.system_settings where key = 'ai_models'),
  '{"catalog_assist": "", "email_triage": ""}'::jsonb, 'no model name is invented – chosen by the owner');
select is((select (value #>> '{}')::numeric from public.system_settings where key = 'ai_budget_limit_eur'), 5.00, 'budget 5,00 €');
select is((select (value #>> '{}')::numeric from public.system_settings where key = 'ai_budget_cutoff_eur'), 4.50, 'cut-off 4,50 €');
select is((select count(*)::int from public.feature_flags where key in ('ai_catalog_assist', 'ai_email_triage') and not enabled),
  2, 'AI flags exist and are off');

-- anon / aal1 / no role -----------------------------------------------------------------------
set local role anon;
select throws_ok(format('select 1 from public.%I limit 1', t), '42501', null, t || ': anon is denied')
from unnest(array['ai_model_prices','ai_provider_keys','ai_usage','v_ai_usage_summary']) as t;
reset role;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is_empty(format('select 1 from public.%I', t), t || ': admin with aal1 sees nothing')
from unnest(array['ai_model_prices','ai_usage','v_ai_usage_summary']) as t;
select throws_ok($$select * from public.ai_key_status()$$, '42501', null, 'key status needs aal2');
select throws_ok($$select * from public.ai_budget_status()$$, '42501', null, 'budget status needs aal2');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is_empty($$select 1 from public.ai_model_prices$$, 'user without role sees no prices');
select throws_ok($$select * from public.ai_key_status()$$, '42501', null, 'key status needs the admin role');
reset role;

-- the key: stored by the gateway (service role), never readable by the app ----------------------
set local role service_role;
select is(public.ai_store_key('gemini', 'AIzaFAKE-test-key-0000000000001234', 'a0000000-0000-0000-0000-00000000000a'),
  '1234', 'the gateway stores the key and gets only the last 4 characters back');
select is(public.ai_get_key('gemini'), 'AIzaFAKE-test-key-0000000000001234', 'the gateway reads it from Vault');
select throws_ok($$select public.ai_store_key('gemini', 'short', null)$$, '23514', null, 'a too short key is refused');
select is(public.ai_store_key('gemini', 'AIzaFAKE-test-key-0000000000005678', 'a0000000-0000-0000-0000-00000000000a'),
  '5678', 'replacing the key');
reset role;
select is((select count(*)::int from vault.secrets where name like 'ai_key_gemini_%'), 1,
  'replacing keeps one secret in Vault');

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select * from public.ai_provider_keys$$, '42501', null, 'admin cannot read the key table');
select throws_ok($$select * from vault.decrypted_secrets$$, '42501', null, 'admin cannot read Vault');
select throws_ok($$select public.ai_get_key('gemini')$$, '42501', null, 'admin cannot call ai_get_key');
select throws_ok($$select public.ai_store_key('gemini', 'AIzaFAKE-test-key-0000000000009999', null)$$, '42501', null,
  'admin cannot store a key bypassing the gateway');
select is((select (is_set, last4)::text from public.ai_key_status()), '(t,5678)', 'status: set, last 4 characters');
select ok(not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'ai_provider_keys' and column_name ilike '%secret'
                         and column_name <> 'vault_secret_id'), 'no secret column outside Vault');
select isnt_empty($$select 1 from public.activity_logs where table_name = 'ai_provider_keys'$$,
  'setting the key is in the change history');
select ok(not exists (select 1 from public.activity_logs where table_name = 'ai_provider_keys'
                       and (coalesce(new_data::text, '') || coalesce(old_data::text, '')) like '%AIzaFAKE%'),
  'the history never contains the key');

-- usage only from the gateway; prices; settings are checked ------------------------------------
select throws_ok($$insert into public.ai_usage (feature, model, ok) values ('test', 'x', true)$$, '42501', null,
  'the app cannot write usage');
select lives_ok($$insert into public.ai_model_prices (model, input_eur_per_mtok, output_eur_per_mtok)
                  values ('probe-model', 0.10, 0.40)$$, 'the owner enters prices of models');
select throws_ok($$insert into public.ai_model_prices (model, input_eur_per_mtok, output_eur_per_mtok)
                   values ('probe model', 0.1, 0.4)$$, '23514', null, 'invalid model name refused');
select throws_ok($$update public.system_settings set value = '"openai"' where key = 'ai_provider'$$, '23514', null,
  'unknown provider refused');
select throws_ok($$update public.system_settings set value = '{"catalog_assist": 5}' where key = 'ai_models'$$, '23514', null,
  'model names are text');
select throws_ok($$update public.system_settings set value = '6' where key = 'ai_budget_cutoff_eur'$$, '23514', null,
  'the cut-off cannot be above the budget');
select lives_ok($$update public.system_settings set value = '{"catalog_assist": "probe-model", "email_triage": ""}'
                   where key = 'ai_models'$$, 'choosing a model');

-- the fuse ----------------------------------------------------------------------------------------
select is((select state from public.ai_budget_status()), 'ok', 'no usage = ok');
reset role;
insert into public.ai_usage (feature, model, cost_eur, ok) values ('test', 'probe-model', 2.60, true);
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select (state, pct)::text from public.ai_budget_status()), '(warn50,52.0)', '2,60 € of 5 € = warn50');
reset role;
insert into public.ai_usage (feature, model, cost_eur, ok) values ('catalog_assist', 'probe-model', 1.90, true);
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select state from public.ai_budget_status()), 'blocked', '4,50 € reached = AI off');
select is((select (calls, cost_eur)::text from public.v_ai_usage_summary where scope = 'total'), '(2,4.500000)',
  'summary: total');
select is((select count(*)::int from public.v_ai_usage_summary where scope = 'feature'), 2, 'summary per function');
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select is((select state from public.ai_budget_status()), 'blocked', 'the gateway sees the same state');
select lives_ok($$select public.ai_delete_key('gemini', null)$$, 'the gateway deletes the key');
reset role;
select is_empty($$select 1 from vault.secrets where name like 'ai_key_gemini_%'$$, 'deleted from Vault too');

-- notification events
select lives_ok($$insert into public.notification_recipients (email, event_types)
                  values ('ai-probe@test.invalid', array['ai_budget_50','ai_budget_90'])$$, 'AI budget events accepted');

select * from finish();
