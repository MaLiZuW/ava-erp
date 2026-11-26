-- next_document_number(): format, sequence, rollover to 5 digits, automatic new year, no API access.
select * from no_plan();

select is(public.next_document_number('CP', 2999), 'CP-2999-0001', 'first number of a new series');
select is(public.next_document_number('CP', 2999), 'CP-2999-0002', 'numbers are consecutive');
select is(public.next_document_number('FA', 2999), 'FA-2999-0001', 'each doc type has its own series');
select is(public.next_document_number('NZ', 2999), 'NZ-2999-0001', 'NZ prefix works');
select is((select prefix from public.number_series where doc_type = 'CP' and year = 2999), 'CP',
  'series is created automatically with the doc type as prefix');

update public.number_series set next_number = 9999 where doc_type = 'CP' and year = 2999;
select is(public.next_document_number('CP', 2999), 'CP-2999-9999', '9999 still has 4 digits');
select is(public.next_document_number('CP', 2999), 'CP-2999-10000', 'above 9999 the number gets 5 digits');
select is((select next_number from public.number_series where doc_type = 'CP' and year = 2999),
  10001, 'counter points to the next free number');

select matches(public.next_document_number('DOP'),
  '^DOP-' || extract(year from (now() at time zone 'Europe/Bratislava'))::int || '-\d{4,5}$',
  'default year is the current year');

select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select public.next_document_number('CP', 2999)$$, '42501', null,
  'authenticated users cannot burn numbers through the API');
reset role;
set local role anon;
select throws_ok($$select public.next_document_number('CP', 2999)$$, '42501', null,
  'anon cannot call next_document_number');
reset role;

select * from finish();
