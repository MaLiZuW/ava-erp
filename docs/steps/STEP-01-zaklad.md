# STEP-01 – Základ projektu (fáza 1)

Predpoklad: vlastník schválil `docs/BUSINESS_PROCESSES.md` a `docs/DATABASE_SCHEMA.md`.
Vetva: `phase-01-foundation`

## Cieľ

Prázdna, ale kompletne nastavená aplikácia, ktorá sa zbuildí, prejde testami a nasadí na `https://app.av-agency.sk` ako statický export. Bez biznis logiky.

## Úlohy

1. **Repozitár a nástroje**
   - Next.js (App Router, TypeScript strict, ESLint, Tailwind), shadcn/ui, `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`.
   - Vitest + Testing Library, Playwright (1 smoke test), Prettier.
   - `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), `.gitignore` vrátane `.env*.local`.
2. **Supabase – cloud Free (vývojový projekt)** [rozhodnutie D21]
   - Žiadna lokálna databáza ani Docker. Vlastník založí na supabase.com projekt Free (región EÚ, názov napr. `ava-erp-dev`); ty pripravíš presný postup a zoznam nastavení (zapnúť TOTP MFA, Site URL `https://app.av-agency.sk` a `http://localhost:3000`, vypnúť registráciu).
   - Supabase CLI cez `npx supabase` (bez Dockeru): `supabase link`, migrácie v `supabase/migrations`, nasadzovanie `supabase db push`, typy `supabase gen types --linked`. Over, ktoré príkazy CLI fungujú bez Dockeru; čo vyžaduje Docker, nahraď ekvivalentom (napr. pgTAP testy cez `psql` na vývojový projekt) a zapíš do TESTING_STRATEGY.md.
   - Prvá migrácia: rozšírenia (`pgcrypto`, `pg_trgm`), schéma `private`, enumy zo sekcie 1, tabuľky sekcie 2 (`companies`, `divisions`, `profiles`, `user_roles`, `feature_flags`, `system_settings`, `number_series`, `status_transitions`, `activity_logs`), funkcie `set_updated`, `log_change`, `next_document_number`, `has_role`, `transition`.
   - Seed (`supabase/seed.sql`): 1 firma (údaje ako zástupné texty `TODO` – reálne doplní vlastník), divízie AVENG a AGENCY, feature flags (`service_cnc=false`, `email_sync=false`, `ai_legal_summary=false`, `ai_text_drafts=false`), číselné rady pre aktuálny rok.
   - RLS + reštriktívna `aal2` politika na všetky tabuľky; pgTAP testy pre ne a pre `next_document_number` (súbežnosť, formát).
   - **Pravidlá pre Free:** len testovacie dáta (žiadne reálne osobné ani finančné údaje), projekt sa pri nečinnosti 7 dní pozastaví a nemá automatické zálohy – zdrojom pravdy sú migrácie a seed v Gite, databáza sa musí dať kedykoľvek znovu postaviť od nuly. Kľúče iba v `.env.local` (anon) a `supabase secrets` (service role) – nikdy v repozitári.
3. **Kostra UI** (presne podľa `docs/DESIGN_SYSTEM.md`)
   - Design tokeny ako CSS premenné + Tailwind téma; písmo Inter pribalené lokálne; tabulárne číslice.
   - Komponenty jadra: `Tile` (S, M, L, XL, HERO), bento mriežka, `StatusBadge`, `KpiNumber`, `CommandPalette` (Ctrl+K – zatiaľ len navigácia), prázdny `DocumentShell` s `ProcessRail`.
   - Tabuľka `status_transitions` a funkcia `transition()` s pgTAP testami (na testovacej tabuľke) – jadro pre všetky ďalšie moduly.
   - Rozloženie: bočné menu (Prehľad, Dopyty, Ponuky, Zákazky, Nákup, Dodanie, Faktúry, E-maily, Zákazníci, Dodávatelia, Katalóg, Nastavenia) – položky zatiaľ prázdne stránky „Pripravujeme“.
   - Tailwind téma s farbami z `CLAUDE.md`, logo a znak AV v `public/brand/` (súbory dodá vlastník – zatiaľ zástupný SVG).
   - Formátovanie dátumu DD/MM/YYYY a sumy `1 234,56 €` ako zdieľané utility s testami.
4. **Nasadenie**
   - `public/.htaccess`: presmerovanie na HTTPS, fallback na `index.html`/`404.html`, bezpečnostné hlavičky (HSTS, CSP povoľujúca len vlastnú doménu a Supabase URL, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy).
   - Skript `npm run build` → `out/`; `DEPLOYMENT.md` s postupom nahrania cez FTP do `/av-agency.sk/sub/app` (nástroj podľa voľby vlastníka, napr. WinSCP). Prístupy k FTP nikdy do repozitára.
5. **Overenie rizika e-mailu (prototyp, mimo hlavnej vetvy)**
   - Malá Edge Function, ktorá sa pripojí na IMAP (port 993) a SMTP (465/587) WebSupportu testovacím účtom a vráti len „spojenie OK / chyba“. Výsledok zapíš do `TODO.md` a reportu. Prístupové údaje iba cez `supabase secrets`.
6. **Dokumenty v koreni**: README, MASTER_ARCHITECTURE, SECURITY, TESTING_STRATEGY, DEPLOYMENT, MIGRATION_TO_SELF_HOSTED, CHANGELOG, TODO.

## Brána (hotovo, keď)

- [ ] `npm run build`, `npm test` a DB testy (pgTAP) bez chýb
- [ ] databáza sa dá postaviť od nuly z migrácií a seedu
- [ ] statická verzia nahraná na `https://app.av-agency.sk`, ide cez HTTPS, obnovenie stránky v podsekcii nevracia 404
- [ ] bez 2FA nevráti databáza žiadne dáta (test)
- [ ] výsledok prototypu IMAP/SMTP zapísaný
- [ ] report podľa CLAUDE.md
