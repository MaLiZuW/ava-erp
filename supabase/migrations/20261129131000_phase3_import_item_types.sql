-- =====================================================================
-- Phase 3 – block K, fix: the dry run accepted 'service' instead of the real item types
-- (enum item_type: goods, external_service, labor, resource, other; a package is never imported).
-- =====================================================================

create or replace function public.dry_run_import_batch(p_batch_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b public.import_batches;
  o record;
  r public.import_batch_rows;
  errs jsonb;
  cand jsonb;
  act text;
  p jsonb;
  v_summary jsonb;
begin
  perform private.import_require_admin();
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'import batch % not found', p_batch_id using errcode = 'P0002';
  end if;
  if b.status not in ('draft', 'dry_run') then
    raise exception 'import batch is already applied' using errcode = '23514', hint = 'status';
  end if;
  select * into o from private.import_options(b.options);

  for r in select * from public.import_batch_rows where batch_id = p_batch_id order by row_no loop
    p := r.parsed;
    errs := '[]'::jsonb;
    -- the same checks as in the browser (src/features/catalog/import/rows.ts)
    if coalesce(btrim(p ->> 'name'), '') = '' then errs := errs || '"Chýba názov."'::jsonb;
    elsif length(btrim(p ->> 'name')) > 200 then errs := errs || '"Názov je dlhší ako 200 znakov."'::jsonb; end if;
    if (p ->> 'price') is null or (p ->> 'price') !~ '^[0-9]+$' then
      errs := errs || '"Chýba cena alebo nie je číslo."'::jsonb;
    end if;
    if nullif(p ->> 'ean', '') is not null and not private.gtin_valid(p ->> 'ean') then
      errs := errs || '"EAN/GTIN nie je platný (8, 12, 13 alebo 14 číslic s kontrolnou číslicou)."'::jsonb;
    end if;
    if nullif(p ->> 'supplier_item_code', '') is not null and length(btrim(p ->> 'supplier_item_code')) > 60 then
      errs := errs || '"Kód dodávateľa je dlhší ako 60 znakov."'::jsonb;
    end if;
    if not exists (select 1 from public.units u where u.code = coalesce(nullif(p ->> 'unit_code', ''), 'ks')) then
      errs := errs || '"Neznáma jednotka."'::jsonb;
    end if;
    if coalesce(nullif(p ->> 'item_type', ''), 'goods') not in ('goods','external_service','labor','resource','other') then
      errs := errs || '"Neznámy typ položky (balíček sa importom nezakladá)."'::jsonb;
    end if;
    -- the same supplier code or EAN twice in one file
    if nullif(p ->> 'supplier_item_code', '') is not null and exists (
         select 1 from public.import_batch_rows x where x.batch_id = p_batch_id and x.row_no < r.row_no
            and lower(btrim(x.parsed ->> 'supplier_item_code')) = lower(btrim(p ->> 'supplier_item_code'))) then
      errs := errs || '"Kód dodávateľa je v súbore viackrát."'::jsonb;
    end if;
    if nullif(p ->> 'ean', '') is not null and exists (
         select 1 from public.import_batch_rows x where x.batch_id = p_batch_id and x.row_no < r.row_no
            and lpad(x.parsed ->> 'ean', 14, '0') = lpad(p ->> 'ean', 14, '0')) then
      errs := errs || '"EAN je v súbore viackrát."'::jsonb;
    end if;

    cand := coalesce((select jsonb_agg(jsonb_build_object('item_id', m.item_id, 'name', m.name,
                                                           'reason', m.reason, 'score', round(m.score::numeric, 2)))
                        from public.match_catalog_item(b.supplier_id, p ->> 'supplier_item_code',
                                                       p ->> 'ean', p ->> 'name') m), '[]'::jsonb);
    if jsonb_array_length(errs) > 0 then
      act := 'error';
    elsif r.decision = 'skip' then
      act := 'skip';
    elsif r.decision = 'create' then
      act := 'create';
    elsif r.decision = 'update' then
      act := 'update_cost';
    elsif jsonb_array_length(cand) = 0 then
      act := 'create';
    elsif jsonb_array_length(cand) = 1 and (cand -> 0 ->> 'reason') in ('supplier_code', 'ean') then
      act := 'update_cost';
    elsif jsonb_array_length(cand) = 1 and (cand -> 0 ->> 'score')::numeric >= 1 then
      act := 'update_cost';   -- the very same name
    else
      act := 'choose';        -- several candidates or only a similar name: the user decides
    end if;
    update public.import_batch_rows
       set errors = errs, match = cand, action = act,
           chosen_item_id = case
             when act = 'update_cost' and r.decision is null then (cand -> 0 ->> 'item_id')::uuid
             when act = 'update_cost' then r.chosen_item_id
             else r.chosen_item_id end
     where id = r.id;
  end loop;

  select jsonb_build_object(
           'rows', count(*),
           'create', count(*) filter (where action = 'create'),
           'update_cost', count(*) filter (where action = 'update_cost'),
           'skip', count(*) filter (where action = 'skip'),
           'choose', count(*) filter (where action = 'choose'),
           'error', count(*) filter (where action = 'error'))
    into v_summary
    from public.import_batch_rows where batch_id = p_batch_id;
  update public.import_batches set status = 'dry_run', summary = v_summary where id = p_batch_id;
  return v_summary;
end;
$$;
grant execute on function public.dry_run_import_batch(uuid) to authenticated;
