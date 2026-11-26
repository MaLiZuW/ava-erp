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
