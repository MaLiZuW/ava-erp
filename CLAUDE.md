# CLAUDE.md – Add Value Agency (interný Q2C/ERP systém)

Tento súbor číta Claude Code na začiatku každej session. Platí pre celý repozitár.

## Kto som a ako so mnou komunikovať

- Som vlastník firmy AV-agency, s.r.o. (spolu s manželkou, obaja konatelia). Som inžinier, nie programátor.
- Komunikuj **po slovensky**. Kód, názvy tabuliek, premenných a commitov **anglicky**.
- Technické rozhodnutia vysvetľuj zrozumiteľne, na praktickom príklade. Ponúkni odporúčanie a upozorni na riziko.
- Nevymýšľaj podnikové pravidlá. Ak niečo nie je v `docs/`, **opýtaj sa**.

## Čo staviame

Interný systém, ktorý riadi celý proces od dopytu po archív: dopyt → kalkulácia → cenová ponuka (verzie) → objednávka → zákazka → schválenie vizuálu → nákup u dodávateľov → príjem → realizácia (Gantt, hodiny) → dodací list / protokol → faktúra → úhrada → archív. Plus e-mailová schránka prepojená so zákazkami, legislatívny monitoring, dashboard s ukazovateľmi a grafmi (Spolu / Agentúra / AVENG), hodnotenie zákazníkov a dodávateľov, procesné KPI a generovanie všetkých dokumentov na tlač a propagáciu (vrátane firemnej prezentácie k CP).

Záväzné podklady (čítaj pred každou fázou):
- `docs/BUSINESS_PROCESSES.md` – procesy, stavy, prechody, kalkulácia
- `docs/DATABASE_SCHEMA.md` – dátový model, RLS, funkcie
- `docs/DECISIONS.md` – rozhodnutia vlastníka
- `docs/ARCHITECTURE_CORE.md` – jedno jadro dokladov, vrstvy, štruktúra repozitára
- `docs/DESIGN_SYSTEM.md` – vzhľad: Swiss štýl + bento modulárna mriežka, tokeny, obrazovky
- `docs/steps/STEP-XX-*.md` – zadanie aktuálnej fázy

## Pevné rozhodnutia (nemeniť bez súhlasu)

- Subjekt: AV-agency, s.r.o., **neplatiteľ DPH** → doklady bez DPH. Divízie: AVENG, Agentúra.
- Názov a branding: **Add Value Agency**, logo „Add Value Agency – Viac, ako očakávate“ + znak AV.
- Farby: tmavomodrá `#00384C` (primárna: tlačidlá, navigácia, nadpisy), modrá `#00B0EF` (len akcenty – na bielom má kontrast 2,5:1, nie pre text), čierna `#231E1F` (text), biela `#FFFFFF`.
- Používatelia: 2 administrátori, **povinné TOTP 2FA**.
- Dátumy v UI a dokladoch: **DD/MM/YYYY**. Mena EUR.
- Typ zákazky `SERVICE` a všetko okolo strojov: pripravené, **skryté** feature flagom `service_cnc`.
- Dizajn: **brutálne moderný a čistý** – modulárna bento mriežka veľkých dlaždíc, jeden hlavný „ďalší krok“ na doklad, žiadne ozdoby. Každá obrazovka musí zodpovedať `docs/DESIGN_SYSTEM.md`; žiadne generické admin šablóny.
- Jadro: všetky doklady idú cez jedno jadro (`transition()`, `DocumentShell`, `render-document`). Žiadny modul nemení stav ani nečísluje doklady po svojom.

## Technológie

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui.
- **Statický export** (`output: 'export'`) – hosting je zdieľaný WebSupport (Apache, bez Node.js) na `https://app.av-agency.sk`, priečinok `/av-agency.sk/sub/app`, nahrávanie cez FTP.
  - Dôsledky: žiadne Server Actions, Route Handlers, middleware, ISR ani `next/image` optimalizácia. Detailové stránky cez query parameter (`/zakazky/detail?id=…`), nie dynamické segmenty.
  - Smerovanie a bezpečnostné hlavičky (HSTS, CSP, X-Frame-Options, Referrer-Policy) v `public/.htaccess`.
- Supabase: PostgreSQL, Auth (TOTP MFA), RLS, Storage (súkromné buckety), Edge Functions (Deno) pre PDF, e-maily, plánované úlohy a všetko, čo potrebuje tajné kľúče.
- Supabase **cloud**: vývoj na projekte Free (`ava-erp-dev`, len testovacie dáta), neskôr samostatný produkčný projekt Pro. Žiadny lokálny Supabase ani Docker. Supabase CLI cez `npx supabase` (link, db push, gen types). Migrácie v `supabase/migrations` sú jediný zdroj pravdy; testy DB cez pgTAP.
- Testy: Vitest (logika, kalkulácia), Playwright (kritické toky), pgTAP (RLS, triggery, prechody stavov).
- Peniaze vždy v **centoch** (integer). Žiadny `float` pre sumy.

## Bezpečnostné pravidlá (bez výnimky)

1. `service_role` kľúč nikdy vo frontende, v `NEXT_PUBLIC_*` ani v repozitári.
2. Žiadne heslá, API kľúče ani prístupy do e-mailu v kóde. Konfigurácia cez `.env.local` (v `.gitignore`) a Supabase secrets/Vault. Udržiavaj `.env.example`.
3. RLS zapnuté na každej tabuľke + reštriktívna politika `aal2`. Nová tabuľka bez RLS a testu = chyba.
4. Každá politika a každý prechod stavu má pgTAP test.
5. Validuj všetky vstupy (zod na fronte, constrainty a triggery v DB).
6. Vystavené doklady sa nemenia ani nemažú – vynucuje databáza.
7. Nevykonávaj deštruktívne operácie (drop, delete dát, reset) a nepripájaj sa na produkčný Supabase projekt bez môjho výslovného súhlasu.

## Ako pracuješ

- Jedna fáza = jedna vetva `phase-XX-nazov` a jeden pull request.
- Pred začatím fázy: prečítaj `docs/steps/STEP-XX`, napíš mi **plán** (čo vytvoríš, aké migrácie, aké testy) a počkaj na súhlas.
- Postupuj po malých krokoch, po každom spusti testy. Modul nie je hotový len preto, že sa obrazovka zobrazuje.
- Nevytváraj duplicitné tabuľky ani komponenty – najprv hľadaj existujúce.
- Ak je v `docs/` rozpor alebo medzera, zastav a opýtaj sa.
- Priebežne aktualizuj dokumenty v koreni: `README.md`, `MASTER_ARCHITECTURE.md`, `SECURITY.md`, `TESTING_STRATEGY.md`, `DEPLOYMENT.md`, `MIGRATION_TO_SELF_HOSTED.md`, `CHANGELOG.md`, `TODO.md`. (`BUSINESS_PROCESSES.md`, `DATABASE_SCHEMA.md` sú v `docs/` – zmeny v nich len po mojom súhlase.)

## Report po každej fáze (povinný formát)

1. Čo bolo vytvorené
2. Zmenené súbory
3. Databázové zmeny (migrácie)
4. Testy – čo prešlo, čo nie
5. Otvorené problémy a riziká
6. Odporúčaný ďalší krok
7. Čo mám overiť ja (konkrétne kliknutia)

## Prostredie

- Pracujem na **Windows**. Príkazy uvádzaj pre PowerShell. Docker nepoužívam.
- Repozitár na GitHube (súkromný). Názov navrhnutý: `ava-erp` – potvrdím pri fáze 1.
