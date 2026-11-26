# Add Value Agency – interný Q2C/ERP systém

Interný systém AV-agency, s.r.o. – celý proces od dopytu po archív (dopyt → kalkulácia → ponuka → zákazka → nákup → dodanie → faktúra → úhrada → archív). Záväzné podklady sú v `docs/`, pravidlá práce v `CLAUDE.md`.

**Stav:** fáza 1 (základ projektu) – kostra aplikácie, databázové jadro, testy, nasadenie. Biznis moduly prídu vo fázach 2–8.

## Rýchly štart (PowerShell)

```powershell
npm install
npm run dev            # http://localhost:3000
```

| Príkaz                               | Čo robí                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `npm run lint` / `npm run typecheck` | kontrola kódu                                                           |
| `npm test`                           | Vitest (logika, komponenty)                                             |
| `npm run build`                      | statický export do `out/`                                               |
| `npm run test:e2e`                   | Playwright proti `out/` (najprv `npm run build`)                        |
| `npm run db:test:local`              | DB testy (pgTAP) lokálne v pamäti (PGlite), bez Dockeru a bez internetu |
| `npm run db:test`                    | DB testy proti vývojovému projektu Supabase (potrebuje `.env.local`)    |
| `npm run db:push`                    | nasadí migrácie na vývojový projekt Supabase                            |
| `npm run db:seed`                    | nahrá testovacie dáta (`supabase/seed.sql`, opakovane bezpečné)         |
| `npm run db:types`                   | vygeneruje TypeScript typy z databázy                                   |

Konfigurácia: skopíruj `.env.example` do `.env.local` a doplň hodnoty (súbor sa nikdy necommituje). Postup nastavenia Supabase a nahrania na server: `DEPLOYMENT.md`.

## Štruktúra

```
src/app/        stránky (tenké)         src/core/   jadro: formáty, navigácia, (neskôr) klient, guard
src/ui/         dlaždice a komponenty   src/features/  moduly (od fázy 3)
supabase/       migrations/ tests/ functions/ seed.sql
public/         .htaccess, brand/       docs/       záväzné podklady
```

## Dokumenty

`MASTER_ARCHITECTURE.md` · `SECURITY.md` · `TESTING_STRATEGY.md` · `DEPLOYMENT.md` · `MIGRATION_TO_SELF_HOSTED.md` · `CHANGELOG.md` · `TODO.md`
