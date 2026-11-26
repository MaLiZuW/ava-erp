-- =====================================================================
-- Seed – TEST DATA ONLY (dev project). Idempotent: safe to run repeatedly.
-- Real company data is entered by the owner in the application (phase 2).
-- =====================================================================

insert into public.companies (legal_name, brand_name, ico, dic, ic_dph, vat_payer, street, city, zip,
                              registry_entry, iban, bank_name, swift, email, phone, web)
values ('AV-agency, s.r.o.', 'Add Value Agency', 'TODO', 'TODO', null, false, 'TODO', 'TODO', 'TODO',
        'TODO', 'TODO', 'TODO', 'TODO', 'TODO', 'TODO', 'TODO')
on conflict do nothing;

insert into public.divisions (code, name) values
  ('AVENG',  'AVENG'),
  ('AGENCY', 'Agentúra')
on conflict (code) do nothing;

insert into public.feature_flags (key, enabled, note) values
  ('service_cnc',      false, 'SERVICE job type and everything around machines (hidden)'),
  ('email_sync',       false, 'Mailbox synchronisation (phase 5)'),
  ('ai_legal_summary', false, 'AI summary of legislative changes'),
  ('ai_text_drafts',   false, 'AI drafts of texts')
on conflict (key) do nothing;

-- number series for the current year (further years are created automatically by next_document_number)
insert into public.number_series (doc_type, year, prefix, next_number)
select dt, extract(year from (now() at time zone 'Europe/Bratislava'))::int, dt::text, 1
from unnest(enum_range(null::public.doc_type)) as dt
on conflict (doc_type, year) do nothing;
