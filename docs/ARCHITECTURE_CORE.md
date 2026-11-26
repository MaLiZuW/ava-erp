# ARCHITECTURE_CORE.md – jednoduché jadro

Verzia 1.0 · schválené 26. 11. 2026 · požiadavka vlastníka: „jednoznačné, čo najjednoduchšie štruktúrované jadro, architektúra podľa najnovších trendov“.

## 1. Myšlienka v jednej vete

Všetky doklady (dopyt, ponuka, zákazka, objednávka dodávateľovi, príjemka, dodací list, faktúra) sú **ten istý druh objektu** – majú číslo, stav, položky, prílohy, e-maily a históriu. Preto je v systéme **jedno jadro dokladov** a moduly ho len konfigurujú. Nový druh dokladu = konfigurácia + tabuľka, nie nový kód od nuly.

## 2. Jadro dokladov (Document Core) [NÁVRH]

| Časť | Jedno miesto v systéme | Čo robí |
|---|---|---|
| Číslovanie | `next_document_number(doc_type)` | rady PREFIX-RRRR-NNNN |
| Stavy a prechody | tabuľka `status_transitions` + jedna funkcia `transition(entity, id, to_status, note)` | povolené prechody sú **dáta**, nie kód v každom module |
| Zámok | `private.lock_issued()` | vystavený doklad sa nedá meniť |
| Audit | `private.log_change()` | každá zmena a prechod |
| Prílohy | `documents` | súbory + hash |
| E-maily | `email_messages` s väzbou na doklad | vlákno pri každom doklade |
| PDF | jedna Edge Function `render-document` + `document_templates` | rovnaký vzhľad všetkých dokladov |
| Validácia | `validation_rules` + `validate(entity, id)` | pred vystavením |
| UI | jeden komponent `DocumentShell` (HERO, procesná os, dlaždice) | všetky detaily vyzerajú a správajú sa rovnako |

Nová tabuľka do `DATABASE_SCHEMA.md`:

```sql
create table status_transitions (
  entity_table  text not null,          -- 'quotation_versions', 'jobs', 'invoices' …
  from_status   text not null,
  to_status     text not null,
  label_sk      text not null,          -- text tlačidla „ďalší krok“, napr. 'Odoslať ponuku'
  is_primary    boolean not null default false,  -- hlavné tlačidlo v HERO
  required_role app_role not null default 'admin',
  guard_fn      text,                   -- názov SQL funkcie s podmienkou (napr. 'guard_promo_visual_approved')
  primary key (entity_table, from_status, to_status)
);
```

Funkcia `transition()` overí, že prechod existuje, používateľ má rolu, `guard_fn` vráti true, zmení stav, zapíše audit a vráti ďalšie možné kroky pre UI. **Žiadny modul nemení stĺpec `status` priamo** (vynútené triggerom).

## 3. Vrstvy

```
UI (Next.js statický export)  ──►  Supabase API (PostgREST, RLS, aal2)  ──►  PostgreSQL (jadro + moduly)
        │                                     ▲
        └──► Edge Functions (PDF, e-mail, cron, integrácie) ──┘   tajné kľúče len tu
```

- Biznis pravidlá žijú **v databáze** (constrainty, triggery, `transition()`), nie vo frontende. Frontend ich len zobrazuje. Výhoda: rovnaké pravidlá platia pre UI, import aj budúce integrácie a prežijú výmenu frontendu.
- Integrácie (e-mail, digitálny poštár, Slov-Lex) sú **adaptéry** v Edge Functions s jednotným rozhraním – výmena poskytovateľa nemení jadro.

## 4. Štruktúra repozitára [NÁVRH]

```
src/
  app/                    stránky (tenké – len skladajú moduly)
  core/                   jadro: supabase klient, auth/aal2 guard, DocumentShell,
                          transition(), peniaze, dátumy, formuláre, tokeny dizajnu
  features/
    inquiries/  quotes/  jobs/  procurement/  delivery/  invoices/
    customers/  suppliers/  catalog/  email/  legal/  settings/
      ├─ api.ts           dotazy (TanStack Query)
      ├─ schema.ts        zod schémy
      ├─ components/      dlaždice a formuláre modulu
      └─ *.test.ts
  ui/                     shadcn komponenty + Tile, StatusBadge, …
supabase/
  migrations/  functions/  tests/  seed.sql
docs/
```

Pravidlo: `features/*` smie používať `core/` a `ui/`, nikdy iný `features/*` priamo (prepojenie ide cez jadro dokladov).

## 5. Súčasné postupy (trendy), ktoré používame a prečo

| Postup | Prečo |
|---|---|
| Typy generované z databázy (`supabase gen types`) | frontend a DB sa nerozídu |
| zod schémy + react-hook-form | jedna definícia validácie |
| TanStack Query (cache, optimistické zmeny) | rýchle, „živé“ UI bez vlastného servera |
| Supabase Realtime na zmeny stavov | obaja konatelia vidia zmeny hneď |
| Command palette (`Ctrl+K`) | rýchla navigácia a akcie z klávesnice |
| Tailwind + CSS premenné (design tokens) | jednotný vzhľad, pripravený tmavý režim |
| Feature-based štruktúra | modul = jeden priečinok, ľahko pochopiteľné |
| Pravidlá v DB, tenký frontend | bezpečnosť, prenositeľnosť na self-hosted |
| pgTAP + Vitest + Playwright v CI (GitHub Actions) | žiadna zmena bez zelených testov |

Konkrétne verzie knižníc vyberie Claude Code vo fáze 1 (aktuálne stabilné) a zapíše do `MASTER_ARCHITECTURE.md`.
