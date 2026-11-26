# CHANGELOG.md

Formát: [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

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
