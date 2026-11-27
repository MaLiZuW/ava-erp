-- =====================================================================
-- Phase 3 – O7 closed (owner, 27. 11. 2026): Slovak holidays confirmed against the text of
-- Act No. 241/1993 Coll. (Slov-Lex, version in force from 29. 10. 2026) and amendment
-- No. 261/2025 Coll.:
--   * 28. 10. (Deň vzniku samostatného česko-slovenského štátu) = state holiday, NOT a day of
--     rest (§ 2 ods. 3) – added;
--   * 1. 9. and 17. 11. = state holidays, not days of rest, permanently;
--   * 8. 5. and 15. 9. = not days of rest only in 2026 (§ 4b), from 2027 again days of rest.
-- The confirmed source is written to public_holidays.source; rows corrected by hand (another
-- source) are left as they are.
-- =====================================================================

create or replace function public.fill_sk_holidays(p_year int) returns int
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_src  text := 'Zákon č. 241/1993 Z. z. v znení účinnom od 29. 10. 2026 (Slov-Lex) a novela č. 261/2025 Z. z.: '
                 || '8. 5. a 15. 9. nie sú dňom pracovného pokoja len v roku 2026 (§ 4b); '
                 || '1. 9., 28. 10. a 17. 11. sú štátne sviatky, nie dni pracovného pokoja (§ 2 ods. 3). '
                 || 'Overené vlastníkom 27. 11. 2026.';
  v_easter date := private.sk_easter_sunday(p_year);
  v_count int;
begin
  if p_year < 2025 or p_year > 2100 then
    raise exception 'fill_sk_holidays: year % is outside 2025–2100', p_year using errcode = '22023';
  end if;
  insert into public.public_holidays (date, name, is_day_off, source)
  select d, n, off, v_src
  from (values
    (make_date(p_year, 1, 1),   'Deň vzniku Slovenskej republiky',                   true),
    (make_date(p_year, 1, 6),   'Zjavenie Pána (Traja králi)',                       true),
    (v_easter - 2,              'Veľký piatok',                                      true),
    (v_easter + 1,              'Veľkonočný pondelok',                               true),
    (make_date(p_year, 5, 1),   'Sviatok práce',                                     true),
    (make_date(p_year, 5, 8),   'Deň víťazstva nad fašizmom',                        p_year <> 2026),
    (make_date(p_year, 7, 5),   'Sviatok svätého Cyrila a svätého Metoda',           true),
    (make_date(p_year, 8, 29),  'Výročie Slovenského národného povstania',           true),
    (make_date(p_year, 9, 1),   'Deň Ústavy Slovenskej republiky',                   false),
    (make_date(p_year, 9, 15),  'Sedembolestná Panna Mária',                         p_year <> 2026),
    (make_date(p_year, 10, 28), 'Deň vzniku samostatného česko-slovenského štátu',   false),
    (make_date(p_year, 11, 1),  'Sviatok Všetkých svätých',                          true),
    (make_date(p_year, 11, 17), 'Deň boja za slobodu a demokraciu',                  false),
    (make_date(p_year, 12, 24), 'Štedrý deň',                                        true),
    (make_date(p_year, 12, 25), 'Prvý sviatok vianočný',                             true),
    (make_date(p_year, 12, 26), 'Druhý sviatok vianočný',                            true)
  ) as h(d, n, off)
  on conflict (date) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.fill_sk_holidays(int) from public, anon;
grant execute on function public.fill_sk_holidays(int) to authenticated;

-- the confirmed source for the rows filled by the previous rule set (hand corrections stay)
update public.public_holidays
   set source = 'Zákon č. 241/1993 Z. z. v znení účinnom od 29. 10. 2026 (Slov-Lex) a novela č. 261/2025 Z. z.: '
                || '8. 5. a 15. 9. nie sú dňom pracovného pokoja len v roku 2026 (§ 4b); '
                || '1. 9., 28. 10. a 17. 11. sú štátne sviatky, nie dni pracovného pokoja (§ 2 ods. 3). '
                || 'Overené vlastníkom 27. 11. 2026.'
 where source like 'Zákon č. 241/1993 Z. z. v znení účinnom od 1. 11. 2025 (NIP: ip.gov.sk)%';

-- 28. 10. for the years already filled (2025–2030); existing rows are not touched
select public.fill_sk_holidays(y) from generate_series(2025, 2030) as y;
