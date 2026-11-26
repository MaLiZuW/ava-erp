# STEP-03 – Kmeňové dáta a knižnica obsahu (fáza 3)

Vetva: `phase-03-master-data` · Plán schválený vlastníkom 26/11/2026 (vrátane doplnkov 1–5).

## Cieľ

Pripraviť kmeňové dáta, na ktoré sa vo fáze 4 napojí dopyt, kalkulácia a CP: zákazníci, dodávatelia, katalóg, sadzby, zdroje, knižnica obsahu a nastavenia pre reporting. K tomu dve drobnosti z testovania fázy 2.

## Rozhodnutia vlastníka k fáze

- Obrazovky podľa významu: **Katalóg** = Položky / Balíčky / Jednotky / Roly a sadzby / Zdroje; **Knižnica obsahu** pod Dokumenty; **Réžia, Dane, Kapacity, Ciele KPI** v Nastaveniach (sekcia Reporting).
- **Kusovník len jedna úroveň** – komponent balíčka nesmie byť balíček (vynúti DB).
- Jedna vetva a jeden PR, priebežné kontroly po blokoch A–D.
- Každá suma `>= 0`, percentá `>= 0`, pri marži `< 100`; `expected_life_hours > 0`.
- `kpi_targets`: `id` PK + `unique nulls not distinct (kpi_key, division_id, valid_from)`; rovnako `nulls not distinct` pri réžii.
- `documents`: obrázky (`logo`, `content_image`) len PNG/JPEG/WebP do 2 MB – aj v tabuľke.
- **D22:** na dev reálne firmy (verejné údaje z OR), katalóg, sadzby, zdroje, texty; osobné kontakty až na Pro. Pri kontaktoch text o osobných údajoch (plnenie zmluvy; detail GDPR vo fáze 8).

## Úlohy

- **A:** ľavé menu posúvateľné, Nastavenia pripnuté dole; pole TOTP prijme „123 456“.
- **B:** `customers`, `customer_contacts`, `customer_machines` (skryté), `suppliers` (+ `is_foreign`, kategórie), `supplier_contacts`; zoznam, detail, formuláre, upozornenie pri zahraničnom dodávateľovi.
- **C:** `units`, `catalog_items`, `package_components`, `labor_roles`, `labor_rates` (bez prekrytia platností), `resources` (sadzba generovaná DB).
- **D:** `content_blocks`, `overhead_costs`, `income_tax_brackets` (bez hodnôt), `capacity_plans`, `kpi_targets`; obrazovky knižnice a reportingu.

## Testy

- pgTAP pre každú tabuľku: anon / aal1 / aal2 bez roly = nič, admin aal2 = áno; constrainty, triggery a audit.
- Vitest: schémy, vzorce (sadzba zdroja rovnako ako v DB), komponenty.
- Playwright: prihlásenie kódom s medzerou, menu na nízkej obrazovke, tok kmeňových dát (dáta „E2E …“ sa po teste mažú).

## Brána

Reálne kmeňové dáta a texty o firme zadané vlastníkom podľa D22 (zoznam v `TODO.md`).
