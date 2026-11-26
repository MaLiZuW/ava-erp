# TESTING_STRATEGY.md

| Vrstva               | Nástroj                                          | Čo overuje                                                                                                                                                             | Príkaz                               |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Logika a komponenty  | Vitest + Testing Library                         | formáty, navigácia, komponenty, `.htaccess`; guard aal2, roly, nečinnosť, validátory (IČO, IBAN, logo), kontrast farieb, Edge Function `admin-mfa-reset` (handler)     | `npm test`                           |
| Kritické toky        | Playwright (proti `out/`, rovnako ako produkcia) | neprihlásený vidí len prihlásenie; heslo → registrácia TOTP → Prehľad; zlý kód odmietnutý; návrat na pôvodnú stránku; odhlásenie                                       | `npm run build` a `npm run test:e2e` |
| Databáza             | pgTAP                                            | RLS, aal2, číslovanie, `transition()`, audit                                                                                                                           | `npm run db:test` (dev projekt)      |
| DB – rýchly sandbox  | pgTAP na PGlite                                  | to isté bez internetu a bez projektu                                                                                                                                   | `npm run db:test:local`              |
| API (anon/aal1/aal2) | fetch na REST dev projektu, skutočné tokeny      | anon a **aal1 token** (len heslo) = žiadne riadky, RPC ani zápis; aal2 admin = dáta; verejná registrácia vypnutá; Edge Function odmieta aal1, cudzí Origin, reset seba | `npm run db:test:api`                |
| Súbežnosť            | Node + `pg` (súčasť `db:test`)                   | 2 súbežné transakcie čakajú na zámok; 10 paralelných relácií dá rôzne čísla bez medzier                                                                                | `npm run db:test`                    |
| CI                   | GitHub Actions                                   | lint, typecheck, Vitest, build, Playwright                                                                                                                             | `.github/workflows/ci.yml`           |

## DB testy bez Dockeru

`supabase test db` spúšťa pgTAP cez kontajner (nápoveda CLI uvádza Docker sieť), preto ho nepoužívame – pravidlo projektu je žiadny Docker. Náhrada:

- `scripts/db-test.ts` sa pripojí na vývojový projekt cez `SUPABASE_DB_URL` (session pooler), každý súbor `supabase/tests/*.test.sql` pustí v transakcii, ktorá sa **vždy vráti späť (ROLLBACK)**, a vyhodnotí výstup TAP. Rozšírenie `pgtap` sa vytvára vo vnútri tej istej transakcie, takže v databáze nezostane a migrácie ho nemusia obsahovať.
- Jediný trvalý vedľajší efekt: riadky v `number_series` pre fiktívne roky 2997/2998 (test súbežnosti).
- `scripts/db-test-local.ts` postaví Postgres v pamäti (PGlite), nasimuluje časti Supabase (`auth.users`, `auth.uid()`, `auth.jwt()`, roly `anon`/`authenticated`/`service_role`), aplikuje migrácie + seed (dvakrát – kontrola, že seed je opakovane bezpečný) a spustí tie isté testy. Tabuľky v sandboxe **nemajú predvolené oprávnenia**, takže migrácia musí oprávnenia udeliť sama.

Sandbox nenahrádza beh na skutočnom projekte (brána fázy): odlišnosti PGlite a Supabase sa ukážu až tam.

## Pravidlá pre testy

- Každá politika a každý prechod stavu má pgTAP test (aal1 = nič, aal2 admin = áno, neprihlásený = nič).
- Testy musia vedieť zlyhať: pri zmene bezpečnostných pravidiel sa overí „mutáciou“ (zámerné pokazenie politiky/triggera → test musí zlyhať). Vo fáze 1 overené pre aal2 politiku, blokovanie priameho zápisu stavu a oprávnenia `next_document_number`.
- Pomocné objekty testov (tabuľka `zz_*`) existujú len v transakcii testu.

## Stav (fáza 1)

- Vitest: 26 testov. Playwright: 3 testy. pgTAP: 91 asercií v 4 súboroch – sandbox aj dev projekt.
- Dev projekt Supabase (26. 11. 2026): migrácia nasadená, `db:test` zelený vrátane súbežnosti (10 paralelných relácií, čísla 1..10 bez medzier), `db:test:api` (anon kľúč → HTTP 401 na všetkých tabuľkách, RPC aj zápise).
- Znovupostaviteľnosť (26. 11. 2026): reset dev databázy → `db:push` → `db:seed` → `db:test` + `db:test:api` bez chýb; vygenerované typy sa nezmenili.
- Ešte neotestované: skutočný aal1 token (potrebuje používateľa, fáza 2); v pgTAP je aal1 simulovaný cez JWT claims.

## Testovací používatelia (fáza 2)

- Vytvárajú sa **len cez Auth Admin API** (`SUPABASE_SECRET_KEY` v `.env.local`), nikdy zápisom do `auth.users` – `scripts/lib/test-users.ts`.
- E-maily `*@test.invalid`; na začiatku každého behu sa zvyšky zmažú, vlastný používateľ sa maže vo `finally` / `afterAll`.
- Heslo a TOTP tajomstvo sú náhodné pre každý beh a nikde sa nevypisujú. Skripty bežia len proti dev projektu (kontrola ref projektu).
- Playwright `e2e/auth.spec.ts` sa bez týchto údajov (CI na GitHube) **preskočí** s jasnou správou; CI zostaví aplikáciu so zástupnými verejnými hodnotami, aby sa overili prihlasovacie obrazovky bez siete.

## Stav (fáza 2, 27. 11. 2026)

- Vitest: 98 testov v 11 súboroch. Playwright: 5 testov bez prihlásenia zelených; 3 testy s TOTP čakajú na `SUPABASE_SECRET_KEY`.
- pgTAP: 142 asercií v 6 súboroch – dev projekt aj sandbox PGlite (sandbox dostal zjednodušené `storage` a `auth.mfa_factors`).
- Mutácie (sandbox): UPDATE politika na `storage.objects`, vypnutá kontrola zámku dokumentu a chýbajúca kontrola aal2 v `admin_list_users` – každú zachytí aspoň jeden test.
- `db:test:api` s aal1/aal2 tokenom: pripravené, spustí sa po doplnení `SUPABASE_SECRET_KEY`; časť Edge Function po jej nasadení.
