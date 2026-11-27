# Report fázy 3 – Kmeňové dáta a knižnica obsahu (`phase-03-master-data`)

Dátum: 26/11/2026 · Plán: schválený s doplnkami 1–5 (NULLS NOT DISTINCT, checky ≥ 0, pravidlo obrázkov, D22, text o osobných údajoch).

## 1. Čo bolo vytvorené

**A – drobnosti z testovania**
- Ľavé menu: zoznam modulov sa na nízkej obrazovke posúva, **Nastavenia sú pripnuté dole** (overené pri 1280×560 aj 375×640).
- Pole TOTP prijme kód „123 456“, „ 123 456 “, s nezlomiteľnou medzerou aj „123-456“. Príčina chyby: pole malo limit 7 znakov a vložený kód s medzerou na začiatku/konci sa odrezal.

**B – Zákazníci a dodávatelia** (jeden modul pre oboch)
- Zoznam: vyhľadávanie podľa názvu, mesta alebo IČO, filter Aktívni/Všetci, na mobile karty.
- Detail (`/zakaznici/detail/?id=…`): údaje, kontakty, história zmien (aj kontaktov), deaktivácia s potvrdením namiesto mazania.
- Formulár: IČO s kontrolnou číslicou, DIČ, IČ DPH (EÚ formát), PSČ podľa krajiny, splatnosť; duplicitné IČO → zrozumiteľná hláška.
- Kontakty s textom o osobných údajoch (D22). Stroje zákazníka len pri zapnutom `service_cnc`.
- **Zahraničný dodávateľ** (krajina ≠ SK): upozornenie „Možná registračná povinnosť DPH (§ 7, § 7a) – overiť s účtovníkom“ hneď pri písaní krajiny aj na detaile.
- „+ Nové“ v hornej lište a v `Ctrl+K`: Zákazník, Dodávateľ, Položka katalógu.

**C – Katalóg**
- Položky (typ, jednotka, divízia, nákupná cena, predvolený dodávateľ, marža alebo prirážka).
- Balíčky: kusovník **jednej úrovne**, úprava množstva priamo v tabuľke, orientačný náklad 1 balíčka.
- Jednotky (8 zo schémy; použitú jednotku nejde zmazať).
- Roly a sadzby: história platností, „Dnes platí“, prekrývajúce sa obdobie odmietnuté s návodom, čo urobiť.
- Zdroje: nákladovú sadzbu počíta databáza (obstarávacia cena ÷ hodiny životnosti + prevádzka/h), formulár ukazuje rovnaký výsledok už pri písaní.

**D – Knižnica obsahu a Reporting**
- Dokumenty → knižnica obsahu: „O firme“ + popisy služieb ENG, EVENT, PROMO, SEASON (SERVICE len pri `service_cnc`), verzie textu, obrázky PNG/JPEG/WebP do 2 MB.
- Nastavenia → Reporting: réžia po mesiacoch a divíziách, pásma dane z príjmov (bez prednastavených hodnôt, upozornenie „overiť s účtovníkom“), kapacity (hodiny na osobu a mesiac), ciele 11 procesných KPI pre Spolu/AVENG/Agentúra s históriou podľa dátumu platnosti.

**Spoločné jadro (bez duplicít):** formulárové polia (sumy → centy, percentá, dátumy DD/MM/YYYY), dotazy histórie, profilov, flagov a divízií, dlaždica histórie zmien, jadro dokumentov (nahrávanie obrázkov – logo naň prešlo tiež), zoznamová tabuľka, filtre-čipy, vstupy s jednotkou.

## 2. Zmenené súbory

5 commitov proti `main` (+ dokumenty), 90+ súborov. Hlavné časti:

- `supabase/migrations/20261128100000_phase3_parties.sql`, `…110000_phase3_catalog.sql`, `…120000_phase3_content_reporting.sql`
- `supabase/tests/07_parties`, `08_catalog`, `09_content_reporting` (nové), `05_documents_storage` (oprava)
- `src/features/parties/**`, `src/features/catalog/**`, `src/features/content/**`, `src/features/settings/{reporting,reporting-api}.ts`, `src/features/settings/components/reporting/**`
- `src/core/{form-fields,shared-queries,record-history,documents}.ts(x)`, `src/core/calc/resource-rate.ts`, `src/core/{format,navigation,validation}.ts`, `src/core/auth/{schemas.ts,totp-forms.tsx}`, `src/core/supabase/{errors,database.types}.ts`
- `src/ui/{app-shell,data-table,chips,inputs,new-menu,field,button,command-palette}.tsx`
- `src/app/{zakaznici,dodavatelia}/**`, `src/app/{katalog,dokumenty}/page.tsx`
- `e2e/{auth,master-data}.spec.ts`, `e2e/helpers.ts`, `scripts/{api-test,db-test-local}.ts`, `scripts/lib/test-users.ts`, `package.json`
- `docs/DECISIONS.md` (D22), `docs/DATABASE_SCHEMA.md` (schválené upresnenia), `docs/steps/STEP-03-kmenove-data.md`, dokumenty v koreni

## 3. Databázové zmeny (migrácie)

Nahraté na dev projekt `ava-erp-dev` (`db:push`), typy pregenerované.

| Migrácia | Obsah |
|---|---|
| `20261128100000_phase3_parties.sql` | `private.setup_admin_table()` (štandard tabuľky), `customers`, `customer_contacts`, `customer_machines`, `suppliers` (`is_foreign` generovaný), `supplier_contacts`; unique IČO, jeden hlavný kontakt, trigram vyhľadávanie |
| `20261128110000_phase3_catalog.sql` | `btree_gist`, `units` (+8 jednotiek), `catalog_items`, `package_components` (triggery jednej úrovne), `labor_roles`, `labor_rates` (exclusion – bez prekrytia), `resources` (generovaná sadzba, `expected_life_hours > 0`) |
| `20261128120000_phase3_content_reporting.sql` | constraint obrázkov v `documents`, `content_blocks` (verzia triggerom, obrázky len `content_image`), `overhead_costs`, `income_tax_brackets` (bez hodnôt, bez prekrytia pásiem), `capacity_plans`, `kpi_targets` (`id` PK + `nulls not distinct`) |

Mazanie: kmeňové dáta nie (deaktivácia); admin smie zmazať len nepoužitú jednotku, riadok kusovníka, réžiu, kapacitu a cieľ KPI.

## 4. Testy – čo prešlo, čo nie

| Sada | Výsledok |
|---|---|
| pgTAP – dev projekt (`db:test`) | **306/306** v 9 súboroch |
| pgTAP – sandbox PGlite (`db:test:local`) | **306/306** |
| API brána (`db:test:api`, skutočné tokeny) | **ALL PASSED** – anon/aal1 bez dát aj na 16 nových tabuľkách; Storage: PNG prejde, SVG a > 2 MB odmietnuté |
| Vitest | **170/170** |
| Playwright (proti `out/`, dev projekt) | **9/9** – vrátane prihlásenia kódom „123 456“, menu na nízkej obrazovke, toku zákazník → kontakt → história, zahraničný dodávateľ, katalóg (balíček, prekrytie sadzby, sadzba zdroja 4,83 €), knižnica, réžia |
| typecheck, lint, build | bez chýb |

Počas práce zachytené a opravené: delenie nulou v generovanom stĺpci (nula teraz končí zrozumiteľnou kontrolou), test úložiska počítal aj tvoje reálne logo na dev projekte, možné vzájomné mazanie testovacích používateľov pri súbežných sadách. Po testoch na dev nezostali žiadne záznamy „E2E …“ ani testovací používatelia (overené dotazom).

## 5. Otvorené problémy a riziká

- ~~Dve doplnené pravidlá na potvrdenie~~ → **potvrdené vlastníkom** a zapísané v `DATABASE_SCHEMA.md` (pozri „Doplnenie“).
- ~~Knižnica obsahu len so slotmi zo schémy~~ → doplnené „Prečo my“, „Ako pracujeme“, „Kontakt“ (pozri „Doplnenie“).
- Smer KPI (vyššie/nižšie je lepšie) je predvolený podľa významu ukazovateľa, dá sa zmeniť vo formulári.
- História kusovníka a jednotiek sa zobrazuje za celú časť katalógu, nie pri konkrétnej položke (tabuľky nemajú `id`) – zapísané v `TODO.md`.
- Vzhľad obrazoviek som overil testami a podľa `DESIGN_SYSTEM.md`, nie očami na obrazovke – prosím pozri sa na ne (bod 7).
- Prettier hlási formát v ~20 starších súboroch kvôli koncom riadkov (CRLF/LF) – návrh na samostatný malý PR (`.gitattributes`), `TODO.md`.
- Hosting `app.av-agency.sk` je stále pozastavený – testuje sa lokálne (samostatná položka „Nasadenie“).

## 6. Odporúčaný ďalší krok

1. Prekliknúť bod 7 a zadať kmeňové dáta podľa D22 (brána, `TODO.md`).
2. Po tvojom súhlase push vetvy a PR fázy 3 (**nezlučujem bez tvojho súhlasu**).
3. Potom plán fázy 4 (dopyt → kalkulácia → CP → zákazka + prototyp PDF); pred ním treba vyriešiť O2 (ktorá e-mailová schránka).

## 7. Čo mám overiť ja (konkrétne kliknutia)

Spusti `npm run dev` → `http://localhost:3000` a prihlás sa.

1. **Menu:** zmenši okno prehliadača na výšku (alebo F12 → zobrazenie mobilu) → zoznam modulov sa posúva, **Nastavenia ostávajú dole**.
2. **TOTP:** odhlás sa, prihlás sa a kód zadaj **s medzerou** „123 456“ (aj vložením Ctrl+V) → prejde.
3. **Zákazníci → + Nový zákazník** → IČO `12345678` → Uložiť → chyba „IČO nie je platné“. Oprav na reálne IČO → Uložiť → otvorí sa detail.
4. Na detaile **Pridať kontakt** → skontroluj text o osobných údajoch → zadaj len všeobecný kontakt (napr. „Objednávky“, info@…) → v **História zmien** vidno založenie firmy aj kontaktu.
5. Skús druhého zákazníka s **rovnakým IČO** → hláška, že firma už v zozname je.
6. **Dodávatelia → + Nový dodávateľ** → do Krajina napíš `CZ` → hneď sa zobrazí žlté upozornenie o DPH (§ 7, § 7a).
7. **Katalóg → Položky** → pridaj tovar (napr. hrnček, nákup 2,50) a položku typu **Balíček** → záložka **Balíčky** → vyber balíček → v ponuke komponentov **nie je** žiadny balíček → pridaj hrnček × 2 → „Náklad 1 balíčka“ 5,00 €.
8. **Roly a sadzby** → Pridať rolu → Nová sadzba od 01/01/2026 → druhá sadzba od 01/06/2026 bez „Platí do“ → hláška o prekrytí. Prvú sadzbu uprav (Platí do 31/05/2026) → druhá už prejde.
9. **Technika a vybavenie** (pôvodne „Zdroje“) → + Nová technika → 10 000 € / 3000 h / 1,50 € → náhľad aj zoznam ukážu **4,83 €/h**.
10. **Dokumenty** → „O firme“ → napíš text → Uložiť (Verzia 1) → zmeň text → Uložiť (Verzia 2) → Pridať obrázok (PNG) → zobrazí sa; skús SVG → odmietnuté.
11. **Nastavenia → Reporting** → Réžia: pridaj „Nájom“ ako spoločnú → pridaj ju druhýkrát → hláška o duplicite. Dane: všimni si upozornenie (hodnoty zadaj až po overení s účtovníkom). Ciele KPI: prepni Spolu/AVENG/Agentúra a nastav jeden cieľ.
12. **Vzhľad:** prejdi obrazovky Zákazníci, Katalóg, Dokumenty a Nastavenia → Reporting a povedz, čo nesedí so štýlom (bento dlaždice, jedna hlavná akcia, čistota).

---

## Doplnenie (pred zlúčením PR)

Zadanie vlastníka v 12 bodoch so schváleným plánom. **Databáza sa nemenila** – žiadna nová migrácia ani `db:push`.

### Čo pribudlo

| # | Bod | Výsledok |
|---|---|---|
| 1 | Potvrdené pravidlá | `DATABASE_SCHEMA.md` §18: daňové pásma platné v rovnakom období sa neprekrývajú; hranica upozornenia KPI je na horšej strane cieľa (schválené vlastníkom) |
| 2 | Knižnica obsahu | bloky **Prečo my** (`why_us`), **Ako pracujeme** (`how_we_work`), **Kontakt** (`contact`) – verzie, obrázky, jazyk ako ostatné bloky |
| 3 | NumberStepper | `src/ui/number-stepper.tsx` – −/+ (40 px), ↑/↓, Shift ×10, krok podľa jednotky, min/max, čiarka, ručné písanie, aria-label; použitý v kusovníku (uloží hneď), pri marži/prirážke (marža < 100 %), dňoch splatnosti, kapacitách, životnosti techniky (100 h / Shift 1000 h). `MoneyInput` len šípky ± 1,00 € (Shift ± 10,00 €) |
| 4 | Prílohy | **D23** v `DECISIONS.md` (len rozhodnutie); úlohy v `TODO.md` → začiatok fázy 4 |
| 5 | Konce riadkov | `TODO.md`: samostatný malý PR po zlúčení fázy 3 |
| 7 | „Zdroje“ → „Technika a vybavenie“ | záložka (`?tab=technika`, starý odkaz funguje), texty, typ položky, „+ Nové“ / `Ctrl+K`; DB a názvy tabuliek bez zmeny |
| 8 | D24 | `DECISIONS.md` podľa kap. 4 analýzy vrátane rozšíriteľnosti o externú osobu a AI agenta; analýza pridaná do repozitára |
| 9 | Schéma §19 | `DATABASE_SCHEMA.md` §19 „Doplnok – plánovanie zdrojov (F5a)“ ako **návrh**; v §7 poznámka, že `assignee_*` nahradí `task_assignments` |
| 10 | Prehľad fáz | STEP-05 → **STEP-05a** (projekty a zdroje) a **STEP-05b** (vizuál, nákup, dodanie, e-mail, nezhody); STEP-04 + `resource_requirements`, kontrola kapacity, prílohy D23; STEP-07 + kapacita vs. pipeline, utilizácia, EAC, KPI termínov dodávateľov |
| 11 | Procesy | Q18 odkazuje na D24 a analýzu; nový krok „Scenár dňa eventu“ (EVENT ✔, ostatné –) |
| 12 | Dokumenty | `TODO.md` (fáza 4 a 5a), `CHANGELOG.md`, `MASTER_ARCHITECTURE.md`, `TESTING_STRATEGY.md`, tento report |

Brána STEP-05a je v prehľade označená **[NÁVRH]** (zákazka EVENT zo šablóny so scenárom, bez konfliktu techniky) – potvrď alebo uprav pri plánovaní fázy 5a. Názvy stĺpcov v §19 sú orientačné.

### Commity doplnenia

`e3ad638` pravidlá · `dc3e94c` bloky obsahu · `bf65d50` NumberStepper · `54ba604` Technika a vybavenie · `c8d42ce` D23, D24, §19, STEP, procesy, TODO · záverečný commit s CHANGELOG a reportom.

### Testy

| Sada | Výsledok |
|---|---|
| lint, typecheck, build | bez chýb (po každom bode) |
| Vitest | **180/180** (+10 testov NumberStepper / MoneyInput) |
| Playwright | **9/9** – navyše −/+ v kusovníku (2 → 3 ks = 7,50 € → späť 5,00 €), starý odkaz `?tab=zdroje`, „+ Nové → Technika a vybavenie“, krok životnosti 2900 → 3000 h, nové bloky obsahu |
| pgTAP dev / sandbox | **306/306** (kontrola – DB bez zmeny) |
| `db:test:api` | **ALL PASSED** |

### Čo mám preklikať

1. **Katalóg → Balíčky** → pri komponente klikni **+** → množstvo sa zvýši o 1 a „Náklad 1 balíčka“ sa hneď prepočíta; **−** vráti späť. Pri množstve 1 je − zašedené.
2. **Katalóg → Položky** → Upraviť položku → Navýšenie „Marža %“ → v poli percent stláčaj **↑** (o 1), **Shift+↑** (o 10) → pri 99 je **+ zašedené** (marža musí byť < 100 %). Pri „Prirážka %“ limit nie je.
3. V tej istej položke v poli **Nákupná cena** stlač ↑ → +1,00 €, Shift+↑ → +10,00 €; tlačidlá −/+ tam nie sú.
4. **Zákazník → Upraviť údaje → Splatnosť** → − je pri 0 zašedené; + až do 365.
5. **Nastavenia → Reporting → Kapacity** → +/− mení hodiny po 0,5 a hneď uloží („Uložené.“).
6. **Katalóg → Technika a vybavenie** (záložka sa volá takto, aj „+ Nové → Technika a vybavenie“) → Predpokladaná životnosť: + pridá 100 h, Shift+↑ 1000 h. Odkaz `…/katalog/?tab=zdroje` otvorí tú istú záložku.
7. **Dokumenty** → nové dlaždice **Prečo my**, **Ako pracujeme**, **Kontakt** → napíš text → Uložiť → Verzia 1; pridaj obrázok.
8. Na mobile (alebo F12 → zobrazenie telefónu) skús −/+ prstom – tlačidlá majú 40 × 40 px.
9. Prečítaj `docs/DECISIONS.md` (D23, D24), `DATABASE_SCHEMA.md` §19 a `docs/steps/STEP-03-az-08-prehlad.md` (STEP-05a/05b) – či sedia s tvojím zámerom.

PR nie je zlúčený – čaká na tvoj súhlas.

---

## Pripomienky vlastníka 1–14, 17–22, bloky K, L a rozhodnutia D25–D28

Zadanie: pripomienky z preklikania (body 1–14 → bloky G–J), doplnky (body 17–22), import katalógu (blok K), Nastavenia → AI (blok L), zápis D25–D28. Body 15 a 16 v zadaní neboli. Postup po krokoch, po každom testy, push do PR #3 a čakanie na potvrdenie. **PR nie je zlúčený.**

### 1. Čo bolo vytvorené

| # | Pripomienka | Výsledok | Commit |
|---|---|---|---|
| 1, 7 | Orezané zvýraznenie aktívnej položky a logo v menu | vnútorný odstup posúvateľnej oblasti, logo v strede 72 px stĺpca, `overflow-x-hidden` | `8c0801d` |
| 2 | Posuvník menu | tenký, nevýrazný (`scrollbar-quiet`), nezasahuje do ikon | `8c0801d` |
| 3 | Tooltip v zbalenom menu | `src/ui/tooltip.tsx` – hover aj focus klávesnicou, mimo posúvateľnej oblasti | `8c0801d` |
| 4 | Ikona Next.js | `devIndicators` vpravo dole – nezakrýva Nastavenia (len vývoj) | `8c0801d` |
| 5 | Kusovník – jednotková cena | stĺpec „Jedn. cena“, náklad = množstvo × jedn. cena; pri výbere komponentu jednotka a cena | `8c0801d` |
| 6, 11 | História zmien – názvy a SK formát | jeden prekladač `core/audit-refs.ts` (UUID → názov, „(zmazaný záznam)“), sumy €, percentá, dátumy DD/MM/YYYY, áno/nie | `8c0801d` |
| 8 | Kapacity podľa D24 | blok H: zdroje, týždenný vzor s verziami, výnimky (dovolenka, nedostupnosť, iná práca, extra), SK sviatky 2025–2030, výpočet v DB; `capacity_plans` zrušená | `f87a78f` |
| 9 | História zmien vždy naspodku | pravidlo v DESIGN_SYSTEM (princíp 8), všetky stránky | `8c0801d` |
| 10 | NumberStepper ukladá po pauze | `onCommit` po 800 ms / opustení poľa / Enter → v histórii jeden záznam | `8c0801d` |
| 12 | Opakovaná réžia | blok I: mesačne / štvrťročne / ročne, verzie od mesiaca, minulé mesiace sa neprepíšu, rozpočítanie presne na centy, prepínač Opakované / Jednorazové | `f120a53` |
| 13 | Periodické overenie dát | blok I: termín overenia pri réžii, sadzbách, technike, daniach, týždennom vzore a firme; „Potvrdiť bez zmeny“, Dáta → Na overenie, dlaždica na Prehľade, typ notifikácie | `f120a53` |
| 14 | Prílohy podľa D23 | blok J: kategórie a typy v DB, vždy zakázané typy, jeden adaptér úložiska, dlaždica Prílohy, hlavná fotka a galéria položky, miniatúry, fronta súborov pri novom zázname | `84010f5` |
| 17 | Balíčky | „+ Nový balíček“, „Duplikovať balíček“ (s kusovníkom), prázdny stav, „Balíček“ v „+ Nové“ a `Ctrl+K`, výber komponentu s vyhľadávaním a miniatúrami | `84010f5` |
| 18 | NumberStepper neoreže hodnotu | šírka podľa najdlhšej hodnoty + jednotky; týždenný vzor v responzívnej mriežke | `e308b56` |
| 19 | Výber dátumu z kalendára | `DateInput` všade: písanie ostáva, kalendár (SK, pondelok prvý, Dnes, víkendy a sviatky), klávesnica | `e308b56` |
| 20, 21 | Nastavenia – podstránky a režim nastavení | vlastné menu nastavení, pripnutá hlavička s jedným tlačidlom, stavové značky, Ctrl+K | `1b5ad86`, `3cc62ac` |
| 22 | História zmien – čitateľnosť a filter | vety namiesto technických polí, filter podľa sekcie, „Zobraziť podrobnosti“ | `3cc62ac` |
| K | Import katalógu (D26) + EAN/GTIN | sprievodca XLSX/CSV (kódovanie, oddeľovač, mena, DPH, kurz, šablóny, náhľad, skúšobný beh, potvrdenie, vrátenie dávky), nákupná cena v mene s/bez DPH, história cien, GTIN-8/12/13/14 s kontrolnou číslicou v DB aj formulári | `0320646` |
| L | Nastavenia → AI (D25) | Gemini za adaptérom v Edge Function `ai-gateway` (nasadená na dev), kľúč len vo Vault, modely a ceny od vlastníka, príznaky funkcií, rozpočet 5 € s poistkou 4,50 €, prehľad spotreby | `30a27e4` |
| D25–D28 | Rozhodnutia a plán fáz | `DECISIONS.md` D25–D28 (O2 uzavretá, O7 sviatky), DESIGN_SYSTEM §6.1 (O2C tabuľa) a §8 (`BoardView`), STEP-03.5 / 04 / 04.5 / 05a / 05b / 06, BUSINESS_PROCESSES kap. 6 (D27) a Q15/Q21, obe analýzy AI v repozitári | krok 7 |

### 2. Zmenené súbory (hlavné)

- Migrácie a testy: pozri bod 3; `supabase/tests/10_capacity` … `14_ai`; `supabase/functions/ai-gateway/**`.
- Jadro: `src/core/{audit-refs,audit-describe,data-review,ai,notification-events,foreign-supplier-notice,holidays}.ts(x)`, `src/core/storage/**` (adaptér, kontrola súborov, zmenšenie fotiek, dokumenty), `src/core/attachments/**`, `src/core/calc/{overhead-share,purchase-price}.ts`.
- UI: `src/ui/{app-shell,shell-context,tooltip,number-stepper,date-input,audit-timeline}.tsx`.
- Moduly: `src/features/settings/**` (režim nastavení, réžia, kapacity, Na overenie, AI), `src/features/catalog/**` (balíčky, prílohy, nákupná cena, `import/**`), `src/features/parties/**` (prílohy), `src/features/dashboard/dashboard-page.tsx`.
- Testy a skripty: `e2e/{master-data,settings}.spec.ts`, `e2e/fixtures/cennik-fiktivny.*`, `scripts/{api-test,db-test-local,make-import-fixtures}.ts`, `scripts/lib/test-users.ts`.
- Dokumenty: `docs/{DECISIONS,DATABASE_SCHEMA,DESIGN_SYSTEM,BUSINESS_PROCESSES}.md`, `docs/steps/STEP-03-az-08-prehlad.md`, `docs/analyzy/ANALYZA-AI-{IMPORT-KATALOGU,EMAIL-TRIAZ}.md`, v koreni `CHANGELOG`, `TODO`, `SECURITY`, `DEPLOYMENT` (časť G), `MASTER_ARCHITECTURE`, `MIGRATION_TO_SELF_HOSTED`, `TESTING_STRATEGY`.

### 3. Databázové zmeny (migrácie, všetky na dev projekte `ava-erp-dev`)

| Migrácia | Obsah |
|---|---|
| `20261129100000_phase3_capacity_calendar.sql` | `resource_kinds`, `bookable_resources`, `work_patterns`, `calendar_exceptions`, `public_holidays` + `fill_sk_holidays`, `resource_capacity()`, pohľady kapacity; drop `capacity_plans` (so súhlasom, bez dát) |
| `20261129110000_phase3_recurring_overhead_reviews.sql` | `recurring_overheads`, `revise_recurring_overhead`, `v_overhead_monthly`, `data_review_types`, `data_reviews`, `confirm_data_review`, `v_reviews_due`, check typov notifikácií |
| `20261129120000_phase3_attachments.sql` | `attachment_categories`, `blocked_mime_types`, `documents.storage_provider`, `check_attachment_file`, `catalog_items.main_photo_document_id`, pohľad `attachments` (`security_invoker`), bucket 20 MB, `duplicate_catalog_package` |
| `20261129130000_phase3_catalog_import.sql` | `currencies`, GTIN (`gtin_valid`), nákupná cena v mene s/bez DPH (`apply_purchase_price`), `catalog_item_costs`, `import_templates`, `import_batches`, `import_batch_rows`, `match_catalog_item`, skúšobný beh, potvrdenie, vrátenie dávky |
| `20261129131000_phase3_import_item_types.sql` | oprava: skúšobný beh akceptuje typy `external_service` a `other` |
| `20261129140000_phase3_ai_settings.sql` | nastavenia a príznaky AI, `ai_model_prices`, `ai_provider_keys` + Vault, `ai_key_status`, `ai_store_key` / `ai_delete_key` / `ai_get_key` (len service role), `ai_usage`, `ai_budget_status`, `v_ai_usage_summary`, typy notifikácií rozpočtu AI |

Každá tabuľka: RLS + reštriktívna `require_aal2`, admin politiky, audit; sumy ≥ 0; `nulls not distinct` tam, kde NULL = celá firma.

### 4. Testy (stav po bloku L)

| Sada | Výsledok |
|---|---|
| pgTAP – dev projekt a sandbox PGlite | **583/583** v 14 súboroch (sandbox má náhradu Vaultu) |
| `db:test:api` (skutočné tokeny) | **ALL PASSED** – anon/aal1 bez dát na všetkých nových tabuľkách; Storage (PDF 3 MB prejde, SVG, HTML a > 20 MB nie, podpísaný odkaz); kľúč AI a Vault nečitateľné; `ai-gateway` odmieta anon, cudzí Origin, zlý kľúč a volanie bez modelu |
| Vitest | **255/255** |
| Playwright | **10/10** – kmeňové dáta vrátane opakovanej réžie, overenia dát, príloh, balíčkov, importu cenníka s vrátením dávky, kontroly EAN; režim nastavení vrátane stránky AI a poistky |
| lint, typecheck, build | bez chýb |

Po každom behu na dev nezostali testovacie dáta (overené dotazom): žiadne „E2E …“ záznamy, prílohy ani súbory v úložisku, dávky importu, spotreba AI ani testovací používatelia.

### 5. Otvorené problémy a riziká

- **Sviatky (O7 v `DECISIONS.md`) – na tvoje potvrdenie.** Slov-Lex sa mi nepodarilo strojovo prečítať; pravidlá sú podľa NIP a odborných zdrojov:
  - 2026: 8. 5. a 15. 9. **nie sú** dňom pracovného pokoja (NIP);
  - 2027–2030: 8. 5. a 15. 9. **sú** dňom pracovného pokoja – opiera sa len o vyhlásenie ministerstva o návrate od 2027;
  - 1. 9. a 17. 11. ostávajú štátnymi sviatkami, ale nie sú dňom pracovného pokoja;
  - 28. 10. v zozname nie je (jeden zdroj uvádza nový štátny sviatok, ktorý nie je dňom pracovného pokoja);
  - oprava jedného riadku v `public_holidays` má prednosť, doplnenie roka nič neprepíše.
- **Kurz meny** sa zadáva ako na kurzovom lístku ECB/NBS (jednotky meny za 1 EUR); automatický kurz je v TODO.
- **AI:** žiadny skutočný kľúč ani volanie Gemini som nerobil – spojenie overíš ty podľa `DEPLOYMENT.md` G. Odosielanie notifikácií (overenie dát, rozpočet AI) je fáza 8.
- **Prettier** hlási staršie súbory (napr. `admin-mfa-reset`) kvôli koncom riadkov – samostatný malý PR po zlúčení (`TODO.md`).
- Vzhľad nových obrazoviek som overil testami a podľa `DESIGN_SYSTEM.md`; prosím pozri sa na ne (bod 7).

### 6. Odporúčaný ďalší krok

1. Prekliknúť bod 7, potvrdiť sviatky (O7) a prípadne zadať kľúč AI.
2. Po tvojom súhlase **zlúčiť PR #3** (nezlučujem bez súhlasu), potom malý PR s koncami riadkov.
3. Plán fázy 4 podľa `STEP-03-az-08-prehlad.md` (CP + PDF, O2C tabuľa s `BoardView`, e-mailové schránky bez AI) – predtým založiť testovaciu schránku test@av-agency.sk (D27).

### 7. Čo mám overiť ja (konkrétne kliknutia)

1. **Menu:** zbaľ menu (okno < 1280 px) → logo aj zvýraznená položka celé, tooltip pri prejdení myšou aj Tabom.
2. **Katalóg → Balíčky:** „+ Nový balíček“ s fotkou → otvorí sa v kusovníku; komponent vyhľadaj a vyber zo zoznamu s miniatúrami (jednotka a cena sa ukážu); „Duplikovať balíček“.
3. **Katalóg → Položky:** otvor položku → hlavná fotka vľavo hore, dole Prílohy (PDF, zmena kategórie, náhľad, stiahnutie, zmazanie s potvrdením); nákupná cena v CZK s DPH → prepočet na EUR bez DPH; zlý EAN `4006381333932` odmietnutý.
4. **Katalóg → Import:** `e2e/fixtures/cennik-fiktivny-cp1250.csv`, CZK, s DPH 21 %, kurz 25 → náhľad → skúšobný beh → potvrdiť → v Položkách 40,00 € → „Vrátiť dávku“.
5. **Zákazník / dodávateľ:** Prílohy na detaile; v histórii „Nahraný / Odstránený súbor …“.
6. **Nastavenia → Reporting → Réžia:** opakovaný náklad, „Zmeniť sumu od…“, Jednorazové s prehľadom mesiaca.
7. **Nastavenia → Dáta → Na overenie** a dlaždica „Na overenie“ na Prehľade.
8. **Nastavenia → Reporting → Kapacity:** týždenný vzor, dovolenka, extra hodiny, sviatky v kalendári.
9. **Nastavenia → AI:** podľa `DEPLOYMENT.md` G zadaj model, cenu a kľúč → „Otestovať spojenie“ → spotreba v prehľade.
10. **Dátumy:** v ľubovoľnom dátumovom poli ikona kalendára, „Dnes“, Esc.
11. Prečítaj `DECISIONS.md` D25–D28 a O7, `DESIGN_SYSTEM.md` §6.1 a §8, `STEP-03-az-08-prehlad.md` (STEP-03.5, 04, 04.5) – či sedia s tvojím zámerom.

PR #3 nie je zlúčený – čaká na tvoj súhlas.
