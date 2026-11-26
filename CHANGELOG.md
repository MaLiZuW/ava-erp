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
