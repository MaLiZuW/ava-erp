# Analýza: riadenie projektov a zdrojov v Q2C/ERP Add Value Agency

Stav: **SCHVÁLENÉ vlastníkom 26. 11. 2026** (rozhodnutie D24) · podklad pre F4, F5a, F7
Súvisí: BUSINESS_PROCESSES (kap. 2, Q18), DATABASE_SCHEMA §7 Projekty, §4 resources, §18 capacity_plans.

## 1. Požiadavka

„Zdroje“ chápať z pohľadu projektového manažmentu: ľudia, dodávatelia, technika; plánovanie časov, vyťaženosť, kapacity. Riadenie projektov je plnohodnotná súčasť procesu O2C (dopyt → CP → zákazka → realizácia → faktúra), nie samostatný nástroj.

## 2. Východiskový stav

| Oblasť | Stav |
|---|---|
| `resources` (F3) | vlastná technika/vybavenie s nákladovou sadzbou pre kalkuláciu. Bez rezervácií a kalendára. |
| `labor_roles`, `labor_rates` (F3) | roly a sadzby v čase – kalkulácia. |
| `capacity_plans` (F3) | ručne zadané dostupné hodiny osoby za mesiac. |
| `project_tasks`, `task_dependencies`, `time_entries` (návrh F5) | úlohy, míľniky, závislosti koniec–začiatok, jeden priradený človek ALEBO dodávateľ, výkaz hodín. |
| `job_budget_lines` (F4) | finančný baseline zo schválenej CP. |

Chýba plánovanie a rezervácia zdrojov v čase (kto/čo, kedy, koľko, konflikty, kapacita).

## 3. Best practices (PSA – Dynamics 365 Project Operations, Odoo Planning, Kantata, NetSuite SRP, Float, Resource Guru)

1. Jeden register plánovateľných zdrojov s typom.
2. Generická rola v CP → po prijatí obsadená konkrétnym zdrojom; neobsadené požiadavky viditeľné.
3. Kapacita z kalendára (pracovný čas + sviatky + absencie), nie ručne.
4. Rezervácie s hodinami, predbežné (CP) vs. pevné (zákazka).
5. Konflikt techniky = chyba v DB; preťaženie človeka = výrazné upozornenie.
6. Šablóny podľa typu zákazky, spätné plánovanie od pevného dátumu.
7. Dodávateľ = zdroj bez kapacity, plánuje sa termínmi (potvrdený, skutočný) → KPI dodržania termínov.
8. Časový baseline popri finančnom; prognóza do konca (EAC).
9. Portfólio: zdroj × týždeň, kapacita vs. dopyt.
10. Export do kalendára (iCal).

Vedome NEzavádzame: automatické vyrovnávanie zdrojov, plnú EVM, maticu zručností, schvaľovanie výkazov.

## 4. Rozhodnutia vlastníka (D24)

| # | Otázka | Rozhodnutie |
|---|---|---|
| 1 | Externé osoby na hodiny | **Zatiaľ nie** – dodávatelia sú firmy s termínom. Model musí byť rozšíriteľný (typ zdroja ako konfigurácia): neskôr externá osoba alebo **AI agent / automatizovaná služba** bez zmeny jadra. |
| 2 | Výkaz hodín | **hodiny za deň** k zákazke/úlohe; bez stopiek. |
| 3 | Prístup dodávateľov | **nie** – dostávajú e-mail/PDF (OD, harmonogram, scenár eventu). Rola `external` ostáva len pripravená. |
| 4 | Kapacita konateľov | **týždenný vzor** (hodiny po dňoch týždňa) + **výnimky na konkrétne dni v kalendári** (dovolenka, nedostupnosť, extra hodiny) + SK sviatky automaticky. |
| 5 | Scenár dňa eventu (run-of-show) | **áno**, súčasť zákazky EVENT, s PDF pre tím a dodávateľov. |
| 6 | Rozdelenie F5 | **áno** – F5a projekty a zdroje, F5b vizuál, nákup, dodanie, e-mail. |

## 5. Dátový model (doplnok k DATABASE_SCHEMA §7 – implementácia F5a)

| Tabuľka | Účel |
|---|---|
| `resource_kinds` | konfigurácia typov zdrojov: `user`, `supplier`, `equipment` (aktívne); pripravené `external_person`, `ai_agent` (neaktívne). `has_capacity` (boolean), `cost_source`. |
| `bookable_resources` | register: `kind`, odkaz na `profiles` / `suppliers` / `resources` (presne jeden podľa typu), predvolená rola, divízia, `is_active`. |
| `work_patterns` | týždenný vzor zdroja: deň týždňa × hodiny, platnosť od/do. |
| `calendar_exceptions` | výnimka na konkrétny deň/obdobie: hodiny (0 = nedostupný, viac = extra), dôvod (dovolenka, nedostupnosť, iné). |
| `public_holidays` | SK štátne sviatky a dni pracovného pokoja – referenčné dáta, ročne doplniť. |
| `resource_requirements` | požiadavka zákazky podľa roly (z labor riadkov prijatej CP): obdobie, hodiny, obsadená/neobsadená. |
| `task_assignments` | úloha × zdroj: obdobie, plánované hodiny, `booking_type` (tentative/firm). Nahrádza `assignee_user_id` / `assignee_supplier_id` v `project_tasks`. |
| `equipment_bookings` | rezervácia techniky, **exclusion constraint** na prekrytie času. |
| `project_templates`, `template_tasks`, `template_dependencies` | šablóny podľa typu zákazky; termín = posun v dňoch od kotvy (štart zákazky / dátum eventu / termín dodania), aj záporný. |
| `event_schedule_items` | scenár dňa eventu: čas od–do, činnosť, miesto, zodpovedný zdroj, technika, poznámka; PDF. |
| `project_tasks` + `baseline_start`, `baseline_end` | časový baseline pri spustení zákazky. |
| `purchase_orders` + `confirmed_date`, `delivered_date` | termíny dodávateľa pre Gantt a KPI. |
| `time_entries` | ostáva: hodiny za deň (bez stopiek). |
| `capacity_plans` | po zavedení kalendárov len ručná korekcia/prechodné riešenie; kapacita sa počíta zo vzoru + výnimiek + sviatkov. |

Pohľady: `v_resource_capacity_daily` (zdroj × deň: dostupné hodiny), `v_resource_load` (zdroj × týždeň: kapacita, pevné, predbežné, % vyťaženia), `v_job_schedule_variance`, `v_job_forecast` (EAC).

Pravidlá v DB: konflikt techniky = chyba; preťaženie človeka = upozornenie; dodávateľ bez kapacity (len termíny); zmeny úloh uzavretej zákazky zakázané.

## 6. Obrazovky

- Zákazka → dlaždica **Harmonogram** (XL): Gantt s úlohami, míľnikmi, OD dodávateľov, baseline vs. aktuálny plán.
- Zákazka EVENT → dlaždica **Scenár eventu** + PDF.
- **Plánovanie zdrojov** (menu pod Zákazky): heatmapa zdroj × týždeň, filter Agentúra/AVENG, presun rezervácie.
- **Môj týždeň**: moje úlohy + výkaz hodín za deň (aj mobil).
- **Kalendár zdroja**: týždenný vzor + výnimky na konkrétne dni.
- Katalóg → **Technika a vybavenie**: kalendár rezervácií techniky.
- Dashboard: vyťaženie, neobsadené požiadavky, omeškané úlohy, dodávatelia po termíne.
- iCal export (moje úlohy, rezervácie).

## 7. Zaradenie do fáz

| Fáza | Obsah |
|---|---|
| F3 (doplnenie) | premenovať záložku „Zdroje“ → „Technika a vybavenie“; zapísať D24 a tento doplnok schémy. **Doplnené neskôr (blok H):** kalendár – `resource_kinds`, `bookable_resources`, `work_patterns`, `calendar_exceptions`, `public_holidays`, výpočet kapacity; `capacity_plans` zrušená. |
| F4 | z labor riadkov prijatej CP vznikajú `resource_requirements`; pri CP orientačná kontrola kapacity v dotknutých týždňoch. |
| **F5a** – projekty a zdroje | register zdrojov, kalendáre (vzor + výnimky + sviatky), šablóny so spätným plánovaním, priradenia, rezervácie techniky, Gantt s baseline, výkaz hodín za deň, heatmapa vyťaženia, scenár eventu + PDF, iCal. |
| **F5b** – vizuál, nákup, dodanie, e-mail | pôvodný rozsah STEP-05 bez projektov; termíny OD (`confirmed_date`, `delivered_date`) sa zobrazia v Gantte z F5a. |
| F7 | kapacita vs. pipeline (predbežné rezervácie z CP), utilizácia v KPI, prognóza EAC, KPI dodržania termínov dodávateľov. |
