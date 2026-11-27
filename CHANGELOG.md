# CHANGELOG.md

Formát: [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

## [Nevydané] – fáza 3: Kmeňové dáta a knižnica obsahu (`phase-03-master-data`)

### Pridané

- **Zákazníci a dodávatelia** (`src/features/parties` – jeden modul pre oboch): zoznam s vyhľadávaním (názov, mesto, IČO) a filtrom Aktívni/Všetci, detail cez `?id=`, formulár (IČO mod 11, DIČ, IČ DPH EÚ, PSČ podľa krajiny, splatnosť), kontakty s textom o osobných údajoch (D22), stroje zákazníka len pri `service_cnc`, upozornenie pri zahraničnom dodávateľovi (§ 7, § 7a – overiť s účtovníkom), deaktivácia namiesto mazania, história zmien záznamu aj jeho kontaktov.
- **Katalóg** (`src/features/catalog`, záložky `?tab=`): položky (typ, jednotka, divízia, nákupná cena, predvolený dodávateľ, marža/prirážka), balíčky – kusovník **jednej úrovne**, jednotky, roly a hodinové sadzby s platnosťou od–do, vlastné zdroje s nákladovou sadzbou počítanou databázou (náhľad pri písaní rovnakým vzorcom), história zmien katalógu.
- **Knižnica obsahu** (Dokumenty): O firme + služby podľa typu zákazky (SERVICE len pri `service_cnc`), text s verziami, obrázky PNG/JPEG/WebP do 2 MB.
- **Nastavenia → Reporting:** réžia po mesiacoch a divíziách, pásma dane z príjmov (bez prednastavených hodnôt, s upozornením „overiť s účtovníkom“), kapacity (dostupné hodiny), ciele 11 procesných KPI pre Spolu/AVENG/Agentúra.
- „+ Nové“ v hornej lište a skupina „Nové“ v `Ctrl+K`: Zákazník, Dodávateľ, Položka katalógu.
- Spoločné časti: `core/form-fields.ts` (zod polia vrátane súm, percent a dátumov DD/MM/YYYY), `core/shared-queries.ts` (história, profily, feature flagy, divízie), `core/record-history.tsx`, `core/documents.ts` (nahrávanie obrázkov, podpísané URL), `core/calc/resource-rate.ts`; UI `DataTable`, `ChipGroup`, `MoneyInput`, `PercentInput`, `DateInput`, `Textarea`, `Checkbox`, `NewMenu`.
- Databáza: 3 migrácie `20261128100000_phase3_parties.sql`, `20261128110000_phase3_catalog.sql`, `20261128120000_phase3_content_reporting.sql` (16 tabuliek, `private.setup_admin_table()`, `btree_gist`), pravidlo obrázkov v `documents`.
- Testy: pgTAP `07_parties`, `08_catalog`, `09_content_reporting`; Vitest pre schémy, vzorce a komponenty; e2e `master-data.spec.ts` (zákazník, dodávateľ, katalóg, knižnica, réžia) s upratovaním dát `E2E …`; API test pokrýva nové tabuľky a nahrávanie cez Storage.

### Pridané – pripomienky vlastníka (bloky G–L, priebežne)

- **Blok G:** tooltip v zbalenom menu, tenký posuvník, jednotková cena v kusovníku, `NumberStepper.onCommit` (uloží po 800 ms pauze), História zmien s názvami namiesto UUID (`core/audit-refs.ts`) a v SK formáte, vždy posledná dlaždica stránky.
- **Blok H (D24):** kalendárová kapacita – týždenný vzor s verziami, výnimky (dovolenka, nedostupnosť, iná práca, extra), SK sviatky 2025–2030, pohľady kapacity; `capacity_plans` zrušená.
- **Nastavenia (body 20–22):** režim nastavení s vlastným menu, podstránky, pripnutá hlavička stránky s tlačidlom, čitateľná história zmien s filtrom podľa sekcie.
- **Blok I – opakovaná réžia a overovanie dát** (migrácia `20261129110000_phase3_recurring_overhead_reviews.sql`, pgTAP `11_overhead_reviews`):
  - `recurring_overheads` (mesačne / štvrťročne / ročne, po celých mesiacoch), zmena sumy = nová verzia od mesiaca (`revise_recurring_overhead`), minulé mesiace sa neprepíšu (trigger); rozpočítanie na mesiace presne na centy (`private.overhead_month_share`, rovnaký výpočet v `core/calc/overhead-share.ts`);
  - `v_overhead_monthly` – opakované podiely aj jednorazové položky v jednom prehľade;
  - `data_review_types` + `data_reviews` + `v_reviews_due`: každý záznam réžie, sadzieb, techniky, daní, týždenného vzoru a firmy má termín overenia (12 mesiacov); úprava ho potvrdí automaticky, „Potvrdiť bez zmeny“ cez `confirm_data_review`;
  - UI: Réžia s prepínačom „Opakované / Jednorazové“, štítky „Overiť do …“ / „Po termíne“ pri záznamoch, stránka **Dáta → Na overenie**, dlaždica „Na overenie“ na prehľade, značka v menu nastavení;
  - notifikácie: typ udalosti `data_review_due` (zoznam v `core/notification-events.ts`, kontrola v DB), zaškrtnutie pri príjemcovi; odosielanie vo fáze 8.
- **Blok J – prílohy podľa D23** (migrácia `20261129120000_phase3_attachments.sql`, pgTAP `12_attachments`):
  - kategórie príloh s povolenými typmi a limitmi v DB (`attachment_categories`: foto 5 MB, dokumenty 20 MB), vždy zakázané typy (`blocked_mime_types`: SVG, HTML, skripty, spustiteľné súbory …), kontrola triggerom `check_attachment_file`, bucket nasleduje konfiguráciu (20 MB);
  - `documents.storage_provider` a **jeden adaptér úložiska** `src/core/storage/adapter.ts`; `core/documents.ts` presunuté do `core/storage/documents.ts`; kontrola súborov podľa obsahu (`file-check.ts`), zmenšenie fotiek na WebP max. 2000 px (`resize-image.ts`);
  - dlaždica **Prílohy** (`core/attachments`): zoznam, galéria s náhľadom, PDF v novej karte, stiahnutie, zmena kategórie, zmazanie s potvrdením (zamknuté nikdy), pretiahnutie myšou, Ctrl+V, na mobile fotoaparát; pri novom zázname sa súbory nahrajú až po uložení (priebeh po súboroch, „Nahrať znova“);
  - použitá pri položke katalógu (**hlavná fotka** + galéria, miniatúry v zozname a pri výbere komponentu), zákazníkovi, dodávateľovi a technike; história zmien ukazuje názvy súborov.
- **Blok K – import katalógu XLSX / CSV (D26)** (migrácie `20261129130000_phase3_catalog_import.sql`, `20261129131000_phase3_import_item_types.sql`, pgTAP `13_catalog_import`):
  - Katalóg → **Import**: sprievodca v 5 krokoch – súbor (XLSX alebo CSV, kódovanie UTF-8 / Windows-1250 automaticky, oddeľovač ; , tab, dodávateľ s upozornením § 7/7a pri zahraničnom, mena, s/bez DPH + sadzba, kurz + dátum), mapovanie stĺpcov (odhad z hlavičky, šablóny dodávateľa), náhľad s chybami po riadkoch, skúšobný beh s párovaním a rozhodnutím pri „Vybrať“, potvrdenie; zoznam dávok s „Vrátiť dávku“;
  - meny EUR/CZK/PLN ako konfigurácia, nákupná cena v mene cenníka s/bez DPH – katalóg drží EUR bez DPH (výpočet v DB aj v `core/calc/purchase-price.ts` rovnako), história nákupných cien s dátumom a zdrojom;
  - spoločné párovanie `match_catalog_item` (kód dodávateľa → EAN → podobnosť názvu) pre import aj budúceho AI asistenta;
  - formulár položky: mena, cena s DPH + sadzba, kurz a dátum, živý prepočet na EUR bez DPH, kód dodávateľa, EAN, odkiaľ a kedy je cena;
  - **EAN / GTIN**: 8, 12, 13 alebo 14 číslic s kontrolnou číslicou – kontrola v DB (`private.gtin_valid`) aj vo formulári (zod), jedinečný aj pri zápise s úvodnými nulami;
  - knižnica `read-excel-file` (MIT, čítanie XLSX v prehliadači); fiktívne testovacie cenníky `e2e/fixtures/` zo skriptu `scripts/make-import-fixtures.ts` (`write-excel-file`, len vývoj).
- **Blok L – Nastavenia → AI (D25)** (migrácia `20261129140000_phase3_ai_settings.sql`, pgTAP `14_ai`, Edge Function `ai-gateway`):
  - poskytovateľ Gemini za adaptérom (`provider.ts`), model podľa účelu (vyberá vlastník), ceny modelov, príznaky `ai_catalog_assist` a `ai_email_triage` (vypnuté);
  - API kľúč len na zápis do **Vault** cez bránu, stav „nastavený · …1234 · dátum“, výmena, odstránenie, „Otestovať spojenie“;
  - spotreba `ai_usage` (zapisuje len brána), prehľad spolu / podľa funkcie / podľa mesiaca, poistka 5,00 € / vypnutie pri 4,50 €, upozornenia 50 % a 90 % (typy notifikácií `ai_budget_50`, `ai_budget_90`), `useAiAvailability` na zašednutie AI tlačidiel;
  - obsah ide do AI ako dáta oddelené od pokynov (prompt injection); kľúč v hlavičke, nikdy v URL ani v logoch;
  - DEPLOYMENT.md, časť G – postup pre Google AI Studio (kľúč, fakturácia, rozpočet 5 €, kvóta);
  - lokálne testy PGlite majú náhradu Vaultu (len na kontrolu prístupov).
- **Rozhodnutia a plán (krok 7, len dokumentácia):** `DECISIONS.md` D25 (AI), D26 (import katalógu a nákupné ceny), D27 (e-mail a AI triáž; O2 uzavretá), D28 (O2C tabuľa v Prehľade), otvorená otázka O7 (sviatky 2027+ a 28. 10.); `DESIGN_SYSTEM.md` §6.1 O2C tabuľa pod KPI dlaždicami a §8 `BoardView` (dnd-kit); `STEP-03-az-08-prehlad.md` – STEP-03.5 (AI asistent katalógu), STEP-04 (BoardView, tabuľa, e-mailové schránky bez AI), nový STEP-04.5 (AI triáž), STEP-05a (kanban úloh), STEP-05b (e-mail cez F4/F4.5), STEP-06 (stĺpec Fakturácia); `BUSINESS_PROCESSES.md` kap. 6 podľa D27, Q15 a Q21; analýzy `ANALYZA-AI-IMPORT-KATALOGU.md` a `ANALYZA-AI-EMAIL-TRIAZ.md` v repozitári; report fázy – sekcia pripomienok vlastníka.
- **Bod 17 – balíčky:** „+ Nový balíček“ v záložke Balíčky (typ a jednotka predvyplnené, s fotkou; po uložení sa otvorí v kusovníku), „Duplikovať balíček“ (kópia s kusovníkom, nový názov a kód – `duplicate_catalog_package`), prázdny stav s tlačidlom, „Balíček“ v „+ Nové“ a `Ctrl+K`; výber komponentu s vyhľadávaním a miniatúrami.

### Pridané – doplnenie pred zlúčením

- `NumberStepper` (`src/ui/number-stepper.tsx`): tlačidlá −/+ (40 px, aj na dotyk), šípky ↑/↓, Shift = krok ×10, krok podľa jednotky (ks/bal 1, hod 0,5, kg/m/m2 0,1) alebo cez prop, minimum/maximum (aj „menej ako“ pre maržu < 100 %), desatinná čiarka. Použitý pre množstvo v kusovníku (−/+ uloží hneď), maržu/prirážku, dni splatnosti, kapacity a životnosť techniky (krok 100 h, Shift 1000 h).
- `MoneyInput`: šípky ↑/↓ ± 1,00 € (Shift ± 10,00 €), bez tlačidiel.
- Knižnica obsahu: bloky „Prečo my“, „Ako pracujeme“, „Kontakt“ (pre prezentáciu k CP vo fáze 4).
- Rozhodnutia D23 (prílohy – implementácia na začiatku fázy 4) a D24 (riadenie projektov a zdrojov podľa schválenej analýzy `docs/analyzy/ANALYZA-RIADENIE-PROJEKTOV-A-ZDROJOV.md`).
- `DATABASE_SCHEMA.md` §19 – plánovanie zdrojov ako **návrh** pre fázu 5a (neimplementované); potvrdené pravidlá: neprekrývajúce sa daňové pásma, hranica upozornenia KPI na horšej strane cieľa.

### Zmenené – doplnenie pred zlúčením

- Katalóg: záložka „Zdroje“ → **„Technika a vybavenie“** (`?tab=technika`, starý odkaz `?tab=zdroje` funguje), texty, typ položky `resource`, „+ Nové“ / `Ctrl+K`. Databáza ani názvy tabuliek sa nemenili.
- `STEP-03-az-08-prehlad.md`: STEP-05 rozdelený na STEP-05a (projekty a zdroje) a STEP-05b (vizuál, nákup, dodanie, e-mail, nezhody); STEP-04 a STEP-07 doplnené o zdroje (D24) a prílohy (D23).
- `BUSINESS_PROCESSES.md`: Q18 odkazuje na D24; nový krok „Scenár dňa eventu“ (EVENT).

### Opravené

- Ľavé menu sa na nízkej obrazovke posúva, Nastavenia ostávajú pripnuté dole.
- Pole TOTP prijme kód s medzerou, nezlomiteľnou medzerou aj pomlčkou („123 456“, „ 123 456 “, „123-456“) – predtým limit 7 znakov odrezal vložený kód.
- Test `05_documents_storage` už nezávisí od reálnych súborov v buckete na dev projekte.

### Zmenené

- Logo sa nahráva cez spoločné jadro dokumentov; `LOGO_*` → `IMAGE_*`, `checkLogoFile` → `checkImageFile`.
- `db:types` typy aj naformátuje; `purgeTestUsers` vie mazať len používateľov jednej testovacej sady.
- Odchýlky od schémy schválené vlastníkom: `kpi_targets` má `id` PK + `unique nulls not distinct`, `overhead_costs` `unique nulls not distinct`, checky `>= 0` na sumách, `expected_life_hours > 0`.

## [Nevydané] – fáza 2: Prihlásenie, 2FA, roly, audit (`phase-02-security`)

### Pridané

- Prihlásenie e-mail + heslo a **povinné TOTP**: obrazovky Prihlásenie, Overenie (výber zariadenia pri viacerých faktoroch), Registrácia faktora (QR + ručný kľúč), Nastavenie hesla (pozvánkový odkaz). Bez aal2 aplikácia nezobrazí nič (`RequireAal2`).
- `AuthProvider`, `useAuthStep`, `RequireRole`, skrývanie položiek menu a palety podľa roly; profil a „Odhlásiť“ v hornej lište.
- Odhlásenie po nečinnosti (predvolene 30 min, `system_settings.inactivity_minutes`, 5–240), upozornenie 60 s vopred, synchronizácia medzi kartami.
- Nastavenia (len admin): Firma (validácia IČO mod 11, DIČ, IBAN mod 97, SWIFT, PSČ; IČ DPH prázdne), Logo (PNG/JPEG/WebP do 2 MB, bez SVG, kontrola obsahu), Systém, Funkcie (feature flagy), Notifikácie – príjemcovia, Používatelia a 2FA (počet faktorov, záložný faktor, reset kolegovi), História zmien (`AuditTimeline`).
- Edge Function `admin-mfa-reset` (overený JWT, aal2 z claims, rola z DB, CORS len pre aplikáciu, zákaz resetu seba, audit, žiadne logovanie tajomstiev).
- Dashboard: 6 počítadiel z `v_open_items`.
- Databáza (migrácia `20261127100000_phase2_security.sql`): `notification_recipients`, `documents` (zámok `is_locked`), FK `companies.logo_document_id`, súkromný bucket `documents` s politikami (bez prepisu, zámok), `private.is_locked_object`, `public.admin_list_users()`, pohľad `v_open_items`.
- Testy: pgTAP `05_documents_storage`, `06_admin_functions`, rozšírené `01_rls` a `04_audit`; API test so skutočným aal1/aal2 tokenom; Playwright prihlásenie s TOTP; Vitest pre guard, nečinnosť, validátory, kontrast farieb a handler Edge Function. Testovací používatelia len cez Admin API.
- `formatDateTime` (DD/MM/YYYY HH:mm, Europe/Bratislava), `src/core/validation.ts`, `ConfirmDialog`, `Field`/`Input`/`Select`, `AuthCard`.

### Zmenené

- Nasadenie na hosting je samostatná položka „Nasadenie“ v `TODO.md` (po rozhodnutí o hostingu A/B/C), nie súčasť brány fázy 2.
- Smoke e2e testy: neprihlásený návštevník je presmerovaný na prihlásenie (namiesto prázdneho dashboardu).
- CI zostavuje aplikáciu so zástupnými verejnými hodnotami Supabase.
- Farby `success`/`warning`/`danger` a neutrály overené testom kontrastu (WCAG AA na bielej aj na canvas).
- Sandbox PGlite simuluje aj `storage` a `auth.mfa_factors`.

## [Nevydané] – fáza 1: Základ projektu (`phase-01-foundation`)

### Pridané

- Next.js 16 (App Router, TypeScript strict) so statickým exportom, Tailwind 4, tokeny dizajnu, Inter lokálne.
- Komponenty: `Tile` (S/M/L/XL/HERO) + `BentoGrid`, `StatusBadge`, `KpiNumber`, `ProcessRail`, `DocumentShell`, `EmptyState`, `Button`, `CommandPalette` (Ctrl+K), rozloženie s bočným menu (14 položiek, vrátane „Reporty a KPI“ a „Dokumenty“).
- Stránky „Pripravujeme“ pre všetky sekcie; Prehľad ako prázdna bento mriežka.
- Utility `formatDate` (DD/MM/YYYY), `formatMoney` (`1 234,56 €`, celé centy), `parseMoneyToCents`.
- Databáza: enumy, tabuľky `companies`, `divisions`, `profiles`, `user_roles`, `feature_flags`, `system_settings`, `number_series`, `status_transitions`, `activity_logs`; funkcie `set_updated`, `log_change`, `has_role`, `next_document_number`, `transition`, `block_direct_status_update`; RLS s reštriktívnou politikou `aal2` na všetkých tabuľkách.
- Seed: firma (zástupné `TODO`), divízie AVENG/Agentúra, 4 feature flagy, číselné rady pre aktuálny rok.
- Testy: Vitest, Playwright, pgTAP (RLS, číslovanie, prechody stavov, audit), test súbežnosti číslovania, lokálny sandbox PGlite.
- `public/.htaccess` (HTTPS, 404, hlavičky vrátane CSP), CI v GitHub Actions.
- Dokumenty v koreni.

### Zmenené

- Bod brány „statická verzia nahraná na `https://app.av-agency.sk`, HTTPS, obnovenie stránky bez 404“ sa presúva z brány fázy 1 do brány fázy 2 (hosting je pozastavený zo strany WebSupportu; so súhlasom vlastníka, 26/11/2026). Fáza 1 je overená lokálne.

### Poznámky

- Pri tvorbe sa zistilo, že Supabase CLI v3 používa `--remote` namiesto `--linked`.
