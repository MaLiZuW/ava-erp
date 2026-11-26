# CHANGELOG.md

Formát: [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

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
