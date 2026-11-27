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

## Testovacie dáta na dev projekte (fáza 3)

- e2e test kmeňových dát (`e2e/master-data.spec.ts`) zakladá len fiktívne záznamy s názvom „E2E …“ a po behu ich zmaže (`purgeE2eMasterData` v `scripts/lib/test-users.ts`) – zákazníci, dodávatelia, katalóg, roly, zdroje, réžia. Do pevných slotov knižnice obsahu (reálne texty vlastníka) e2e **nezapisuje**; zápis, verzie a pravidlá obrázkov overuje pgTAP a API test.
- Každá testovacia sada maže len svojich používateľov (`purgeTestUsers(env, "e2e-md")`), sady preto môžu bežať súbežne.

## Stav (fáza 3)

- Vitest: 180 testov (doplnenie: `number-stepper.test.tsx` – logika kroku, tlačidlá, šípky, MoneyInput s react-hook-form). Playwright: 9 testov (vrátane prihlásenia kódom „123 456“, menu pri 1280×560 a 375×640, toku kmeňových dát, −/+ v kusovníku a starého odkazu `?tab=zdroje`).
- pgTAP: 306 asercií v 9 súboroch – dev projekt aj sandbox PGlite (sandbox načítava aj `btree_gist`).
- `db:test:api`: anon/aal1 bez dát aj na všetkých nových tabuľkách; nahrávanie cez Storage s aal2 – PNG prejde, SVG a súbor nad 2 MB bucket odmietne.
- Vzorec sadzby zdroja je overený rovnakými prípadmi v TypeScripte (`resource-rate.test.ts`) aj v databáze (`08_catalog`).

## Stav (fáza 3 – pripomienky vlastníka, bloky G–L, 27. 11. 2026)

- pgTAP: **583 asercií v 14 súboroch** – dev projekt aj sandbox (`10_capacity`, `11_overhead_reviews`, `12_attachments`, `13_catalog_import`, `14_ai`). Sandbox PGlite dostal náhradu **Vaultu** (`vault.secrets`, `create_secret`, `update_secret`, `decrypted_secrets` bez šifrovania) – overujú sa len prístupy; šifrovanie a skutočný Vault overuje beh na dev projekte.
- Vitest: **255 testov** – okrem iného výpočty v rovnakých prípadoch ako pgTAP (rozpočítanie réžie na centy, prepočet nákupnej ceny s DPH a kurzom, GTIN), kontrola súborov podľa obsahu (PDF, DOCX/XLSX, obrázky), CSV parser a Windows-1250, čítanie XLSX, fronta príloh, brána `ai-gateway` (prístup, poistka, kľúč sa nevracia ani neloguje, dáta oddelené od pokynov).
- Playwright: **10 testov** – navyše opakovaná réžia a overenie dát, prílohy (PDF u dodávateľa, fotka balíčka, miniatúra), nový a duplikovaný balíček, import cenníka (Windows-1250, CZK s DPH) so skúšobným behom, potvrdením a vrátením dávky, kontrola EAN, stránka AI bez kľúča a s vyčerpaným rozpočtom.
- `db:test:api`: Storage do 20 MB (PDF prejde, SVG, HTML a > 20 MB nie, podpísaný odkaz), tabuľka kľúča AI a funkcie Vaultu nedostupné pre aplikáciu, Edge Function `ai-gateway` (neprihlásený 401, cudzí Origin 403, zlý kľúč 400, volanie bez modelu 409).
- Testovacie dáta: fiktívne cenníky `e2e/fixtures/cennik-fiktivny.*` (skript `scripts/make-import-fixtures.ts`, binárne v git – `.gitattributes`); upratovanie maže aj prílohy zo Storage, dávky a šablóny importu testovacích používateľov a testovaciu spotrebu AI (`test_fixture`).

## Stav (fáza 2, 27. 11. 2026)

- Vitest: 98 testov v 11 súboroch. Playwright: 5 testov bez prihlásenia zelených; 3 testy s TOTP čakajú na `SUPABASE_SECRET_KEY`.
- pgTAP: 142 asercií v 6 súboroch – dev projekt aj sandbox PGlite (sandbox dostal zjednodušené `storage` a `auth.mfa_factors`).
- Mutácie (sandbox): UPDATE politika na `storage.objects`, vypnutá kontrola zámku dokumentu a chýbajúca kontrola aal2 v `admin_list_users` – každú zachytí aspoň jeden test.
- `db:test:api` s aal1/aal2 tokenom: pripravené, spustí sa po doplnení `SUPABASE_SECRET_KEY`; časť Edge Function po jej nasadení.
