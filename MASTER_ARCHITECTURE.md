# MASTER_ARCHITECTURE.md

Prehľad architektúry a zvolených verzií. Podrobnosti: `docs/ARCHITECTURE_CORE.md` (jadro dokladov), `docs/DATABASE_SCHEMA.md` (dáta), `docs/DESIGN_SYSTEM.md` (vzhľad).

## Vrstvy

```
Prehliadač: Next.js statický export (HTML/JS/CSS) na Apache (WebSupport) ─► Supabase API (PostgREST, RLS, aal2)
                                                                              │
                                                                              ▼
                                                         PostgreSQL: pravidlá, stavy, číslovanie, audit
Edge Functions (Deno): PDF, e-mail, plánované úlohy – tu a len tu sú tajné kľúče
```

Pravidlá biznisu žijú v databáze (constrainty, triggery, `transition()`), frontend ich iba zobrazuje.

## Zvolené verzie (fáza 1, 26. 11. 2026)

| Oblasť     | Balík                                                          | Verzia                             |
| ---------- | -------------------------------------------------------------- | ---------------------------------- |
| Framework  | Next.js (App Router, Turbopack)                                | 16.4.6                             |
| UI         | React / React DOM                                              | 19.3.0                             |
| Jazyk      | TypeScript (strict, target ES2022)                             | 5.9.3                              |
| Štýly      | Tailwind CSS (+ `@tailwindcss/postcss`)                        | 4.3.5                              |
| Komponenty | shadcn/ui štýl (cva, clsx, tailwind-merge), lucide-react, cmdk | – / 1.81.0 / 1.1.1                 |
| Písmo      | Inter (`@fontsource-variable/inter`, lokálne)                  | 5.3.0                              |
| Dáta       | `@supabase/supabase-js`, zod                                   | 2.119.2 / 4.6.7                    |
| Testy      | Vitest, Testing Library, Playwright                            | 5.1.2 / 16.3.3 / 1.65.1            |
| DB testy   | pgTAP; lokálny sandbox PGlite                                  | 0.6.0 (+ pglite-pgtap 0.1.0)       |
| Nástroje   | ESLint 9, Prettier 3, tsx, pg                                  | 9.39.5 / 3.10.1 / 4.23.15 / 8.23.1 |
| CLI        | Supabase CLI (cez `npx`)                                       | 3.4.0                              |
| Runtime    | Node.js                                                        | 24.x                               |

TypeScript 5.9 a ESLint 9 sú zámerne nižšie než najnovšie (TS 7, ESLint 10), kým ich oficiálne podporuje `eslint-config-next`.

## Rozhodnutia fázy 1

- **Statický export:** `output: 'export'`, `trailingSlash: true`, `images.unoptimized`. Detail dokladu pôjde cez `?id=` (žiadne dynamické segmenty).
- **Jadro v databáze:** `public.transition()` je jediný spôsob zmeny stavu; trigger `private.block_direct_status_update()` ho vynucuje. Číslovanie len cez `public.next_document_number()` (volateľné iba z triggerov, nie cez API).
- **Oprávnenia explicitne:** migrácia nespolieha na predvolené oprávnenia Supabase – každá tabuľka dostane `GRANT` a RLS.
- **Audit:** `private.log_change()` + `public.activity_logs` (append-only, aj pre vlastníka tabuľky).
- **Supabase CLI v3:** cieľ sa volí prepínačom `--remote` (nie `--linked`); konfigurácia je `supabase/config.jsonc`.
- **Navigácia:** jediný zdroj pravdy `src/core/navigation.ts` (14 položiek) – menu, nadpis stránky aj paleta príkazov.
