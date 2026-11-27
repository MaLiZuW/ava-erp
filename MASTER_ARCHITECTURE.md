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
| Dáta v UI  | TanStack Query (fáza 2)                                        | 5.108.4                            |
| Formuláre  | react-hook-form + @hookform/resolvers (fáza 2)                 | 7.92.0 / 7.0.9                     |
| Testy TOTP | otpauth (len dev, výpočet kódov v testoch)                     | 9.6.0                              |
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

## Rozhodnutia fázy 2 (prihlásenie, 2FA, roly, audit)

- **Prihlásenie v prehliadači:** jeden klient `src/core/supabase/client.ts` (anon kľúč, session v `localStorage`, implicitný tok kvôli pozvánkovým odkazom). Stav relácie drží `AuthProvider` (`src/core/auth`): `signed-out → needs-password → needs-enroll → needs-verify → ready`. Čistá logika je v `status.ts` (testovaná bez siete).
- **Brána aplikácie:** `src/app/app-gate.tsx` – stránky `/prihlasenie/*` bez rozloženia, všetko ostatné len cez `RequireAal2` + `IdleLogout` + `AppShell`. Statický export ostáva (žiadny middleware) – ochranu dát robí RLS.
- **Roly v UI:** `NavItem.requiredRole`, `visibleNavItems()`, `RequireRole`; databáza to vynucuje politikami.
- **Moduly:** prvé `src/features/*` – `settings` (api.ts s TanStack Query, schema.ts so zod, components/) a `dashboard`. Spoločné validátory v `src/core/validation.ts`, chyby DB → slovenské hlásenia v `src/core/supabase/errors.ts`.
- **Dokumenty a súbory:** tabuľka `documents` + súkromný bucket `documents`; prílohy (D23) cez jednu dlaždicu `AttachmentsTile` a frontu `useAttachmentQueue` (`src/core/attachments`), všetok prístup k súborom cez adaptér `src/core/storage/adapter.ts`, kategórie a povolené typy v DB (`attachment_categories`, `blocked_mime_types`). Prepis objektu je zakázaný vždy; zamknutý dokument sa nedá zmeniť ani zmazať (DB aj storage politika).
- **Edge Function `admin-mfa-reset`:** logika v `handler.ts` so vstrekovanými závislosťami (testovaná vo Vitest), `index.ts` ju napája na Deno a Supabase. Prvý kód so `service_role` – výhradne na serveri.
- **`v_open_items`:** zmluva pre dashboard (zatiaľ nuly), `security_invoker`, s aal1 nevráti nič.

## Rozhodnutia fázy 3 (kmeňové dáta a knižnica obsahu)

- **Moduly:** `features/parties` (zákazník aj dodávateľ – rovnaký tvar, parameter `kind`), `features/catalog`, `features/content`; reporting je súčasť `features/settings` (`reporting.ts`, `reporting-api.ts`). Moduly sa navzájom neimportujú – spoločné veci sú v `core/` (`form-fields`, `shared-queries`, `record-history`, `documents`, `calc/`) a `ui/` (`DataTable`, `ChipGroup`, vstupy pre sumy, percentá a dátumy).
- **Detail cez query parameter** (`/zakaznici/detail/?id=…`, `?id=new` = nový záznam), záložky katalógu `?tab=`. `findNavItem` priradí podstránku k sekcii menu.
- **Štandard tabuľky:** `private.setup_admin_table()` v migrácii; kmeňové dáta bez mazania (`is_active`).
- **Pravidlá v databáze:** kusovník jednej úrovne (triggery), neprekrývajúce sa platnosti sadzieb a daňových pásiem (exclusion, `btree_gist`), sadzba zdroja ako generovaný stĺpec (rovnaký vzorec v TS celočíselne), verzia bloku obsahu triggerom, `unique nulls not distinct` tam, kde NULL znamená „celá firma“.
- **Peniaze vo formulároch:** text „1 234,56“ → zod `moneyField` → centy; percentá `numeric(7,4)`; dátumy DD/MM/YYYY → ISO.
- **Čísla vo formulároch:** množstvá, hodiny, percentá a dni cez `NumberStepper` (`src/ui/number-stepper.tsx`; −/+, ↑/↓, Shift ×10, krok podľa jednotky `stepForUnit`, min/max). Hodnota ostáva text, zod ju parsuje ako predtým; vo formulároch cez `Controller`. Peňažné polia (`MoneyInput`) majú len šípky (± 1 €).
- **Názvoslovie (D24):** tabuľka `resources` sa v UI volá „Technika a vybavenie“; slovo „zdroj“ je vyhradené pre plánovanie zdrojov vo fáze 5a (ľudia, dodávatelia, technika – DATABASE_SCHEMA §19).
- **Typy z DB:** `npm run db:types` (generuje a formátuje).

## Doplnky fázy 3 – pripomienky vlastníka (bloky G, H, krok 1)

- **Výber dátumu:** `react-day-picker` 10 (MIT, udržiavaná; slovenská lokalizácia, pondelok prvý, klávesnica). Jeden komponent `DateInput` (`src/ui/date-input.tsx`) pre všetky dátumové polia: písanie DD/MM/YYYY ostáva, ikona otvorí kalendár („Dnes“, víkendy a dni pracovného pokoja textom aj ikonou, výber mesiaca a roka, `minDate`/`maxDate`). Dni pracovného pokoja dodáva `HolidaysProvider` (`src/core/holidays.tsx`) cez React context – UI vrstva sama nečíta z DB.
- **NumberStepper:** pole sa nikdy nezúži pod najdlhšiu očakávanú hodnotu + jednotku (`fieldMinWidth`, min. 6 znakov); inline bunky ukladajú raz po 800 ms pauze alebo pri opustení poľa / Enter.
- **História zmien:** jeden prekladač odkazov `src/core/audit-refs.ts` (UUID → názov, „(zmazaný záznam)“) a slovenský formát hodnôt v `AuditTimeline`; vždy posledná sekcia stránky.
- **Kapacity (D24, blok H):** zdroje + týždenný vzor + výnimky + `public_holidays`; výpočet v DB (`resource_capacity()`), kalendár v Nastaveniach.
