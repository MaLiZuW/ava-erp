# Report fázy 2 – Prihlásenie, 2FA, roly, audit (`phase-02-security`)

Dátum: 27/11/2026 · Plán: verzia 2 so schválenými doplnkami D1–D8.

## 1. Čo bolo vytvorené

- **Prihlásenie e-mail + heslo + povinné TOTP.** Obrazovky Prihlásenie, Overenie kódu (výber zariadenia pri viacerých faktoroch), Registrácia faktora (QR kód aj ručný kľúč) a Nastavenie hesla (pre pozvánkový odkaz). Kým relácia nemá `aal2`, aplikácia nezobrazí nič okrem týchto obrazoviek; návrat na pôvodnú stránku (`?next=`) je chránený proti presmerovaniu mimo aplikácie.
- **Roly:** `RequireRole`, skrývanie položiek menu aj palety Ctrl+K (Nastavenia len admin); rozhoduje vždy RLS v databáze.
- **Odhlásenie po nečinnosti:** 30 min predvolene (`system_settings.inactivity_minutes`, 5–240), upozornenie 60 s vopred, aktivita v jednej karte drží všetky karty.
- **Nastavenia** (bento dlaždice): Firma (IČO mod 11, DIČ, IBAN mod 97, SWIFT, PSČ; IČ DPH prázdne – neplatiteľ), Logo (PNG/JPEG/WebP do 2 MB, SVG zakázané, kontrola prípony, MIME aj obsahu súboru), Systém, Funkcie (feature flagy), Notifikácie – príjemcovia, Používatelia a 2FA (počet faktorov, upozornenie pri < 2, záložný faktor, reset kolegovi), História zmien (kto, kedy, čo).
- **Edge Function `admin-mfa-reset`** – reset 2FA druhým adminom: overený JWT (`getClaims`), aal2 z overených claims, rola z DB, CORS len pre aplikáciu, zákaz resetu seba, kontrola existencie cieľa, audit, žiadne logovanie tajomstiev.
- **Dashboard:** 6 počítadiel z `v_open_items` (zatiaľ nuly).
- **Jadro:** Supabase klient, `AuthProvider`, `formatDateTime`, `src/core/validation.ts`, `AuditTimeline`, `ConfirmDialog`, formulárové prvky; tabuľka `documents` + súkromný bucket ako základ príloh pre ďalšie fázy.
- **Testovací používatelia** len cez Auth Admin API, náhodné heslo a TOTP tajomstvo, mazanie vo `finally`, čistenie zvyškov `*@test.invalid` pred každým behom, poistka na dev projekt.
- Dokumenty: `SECURITY.md` (obnova 2FA oboma cestami, riziko tokenov v `localStorage` pri `'unsafe-inline'`), `DEPLOYMENT.md` (kontrolný zoznam Auth, produkčná hodnota nečinnosti, nasadenie Edge Function), `TESTING_STRATEGY.md`, `MASTER_ARCHITECTURE.md`, `MIGRATION_TO_SELF_HOSTED.md`, `README.md`, `CHANGELOG.md`, `TODO.md` (samostatná položka „Nasadenie“).

## 2. Zmenené súbory

8 commitov proti `main`. Hlavné časti:

- `supabase/migrations/20261127100000_phase2_security.sql`, `supabase/tests/01, 04, 05, 06`, `supabase/seed.sql`
- `supabase/functions/admin-mfa-reset/` (`handler.ts`, `index.ts`, `handler.test.ts`)
- `src/core/auth/*`, `src/core/supabase/{client,errors}.ts`, `src/core/{providers,validation,format,navigation}.ts`
- `src/app/prihlasenie/**`, `src/app/app-gate.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/nastavenia/page.tsx`
- `src/features/settings/**`, `src/features/dashboard/**`
- `src/ui/{field,auth-card,audit-timeline,confirm-dialog,app-shell,command-palette}.tsx`
- `scripts/api-test.ts`, `scripts/lib/test-users.ts`, `scripts/db-test-local.ts`, `e2e/{smoke,auth}.spec.ts`
- `.env.example`, `.github/workflows/ci.yml`, `tsconfig.json`, `vitest.config.mts`, `package.json`
- dokumenty v koreni (pozri vyššie)

## 3. Databázové zmeny (migrácie)

Jedna migrácia `20261127100000_phase2_security.sql`, nasadená na `ava-erp-dev` (`db:push`, 27/11/2026):

- `notification_recipients` a `documents` – RLS + `require_aal2`, politiky len pre admina, `set_updated`, `log_change`, explicitné `GRANT`.
- `documents`: trigger `protect_locked_document` (zamknutý riadok sa nedá zmeniť ani zmazať, ani vlastníkom), kontrola tvaru `storage_path`; FK `companies.logo_document_id → documents`.
- Bucket `documents` (súkromný, PNG/JPEG/WebP, 2 MB); politiky `storage.objects` – select/insert/delete len admin + aal2, **žiadna UPDATE politika** (prepis/upsert zakázaný), zámok cez `private.is_locked_object` (`search_path = ''`).
- `public.admin_list_users()` – `security definer`, `search_path = ''`, kontrola aal2 + admin na začiatku, `EXECUTE` len `authenticated`.
- Pohľad `v_open_items` (`security_invoker`, s aal1 prázdny).
- Seed: `inactivity_minutes = 30` (na produkcii SQL z `DEPLOYMENT.md`, seed sa pri `db push` nespúšťa).

## 4. Testy – čo prešlo, čo nie

| Kontrola | Výsledok |
|---|---|
| `npm run lint`, `npm run typecheck` | bez chýb |
| `npm test` (Vitest) | **98/98** v 11 súboroch (guard aal2 – 5 stavov, roly, nečinnosť, validátory, kontrast WCAG, AuditTimeline, schémy, handler Edge Function – 10 scenárov) |
| `npm run db:test` (pgTAP, dev projekt) | **142/142** v 6 súboroch + súbežnosť číslovania |
| `npm run db:test:local` (PGlite) | **142/142**; mutácie (UPDATE politika na storage, vypnutý zámok, chýbajúca kontrola aal2) testy zhodia |
| `npm run build` | OK (statický export, 19 stránok) |
| Playwright | **5/5** bez prihlásenia; **3 testy s TOTP preskočené** – chýba `SUPABASE_SECRET_KEY` v `.env.local` |
| `npm run db:test:api` (aal1/aal2 token) | **nespustené** – chýba `SUPABASE_SECRET_KEY`; časť Edge Function hlási SKIP, kým funkcia nie je nasadená |

Výsledky so skutočnými tokenmi sú v doplnení nižšie.

### Doplnenie 27/11/2026 – testy so skutočnými tokenmi (po doplnení `SUPABASE_SECRET_KEY`)

- `npm run db:test:api`: **aal1 token (len heslo) → 0 riadkov** zo všetkých 12 tabuliek a pohľadov, zápis aj RPC odmietnuté (HTTP 403); po TOTP **aal2 → admin vidí dáta**; anon → HTTP 401. **Bod brány „bez TOTP žiadne dáta ani cez API“ je splnený.**
- **Zistenie:** verejná registrácia je na dev projekte **zapnutá** (`disable_signup: false`). Pôvodná kontrola cez `signUp` bola falošne zelená (Supabase odmietol adresu `@test.invalid`, nie registráciu) – nahradená kontrolou nastavení `/auth/v1/settings`, ktorá teraz správne hlási FAIL. Anonymné prihlásenie a ostatní provideri sú vypnutí. **Treba vypnúť:** Authentication → Sign In / Providers → _Allow new users to sign up_.
- Playwright: **8/8** (2 behy po sebe), vrátane registrácie TOTP, odmietnutia zlého kódu, návratu na pôvodnú stránku a odhlásenia. Test s TOTP dostal dlhší limit (kód sa používa raz – čaká sa na ďalšie 30 s okno; dev projekt Free odpovedá pomalšie).
- Po testoch v `auth.users` neostal žiadny používateľ `*@test.invalid`.
- Edge Function: stále SKIP, kým nie je nasadená.

### Doplnenie 27/11/2026 – po výmene kľúčov a nasadení Edge Function

Vlastník vymenil kľúče (publishable aj secret) a nasadil `admin-mfa-reset`. Nový build s novými kľúčmi.

| Kontrola | Výsledok |
|---|---|
| `npm run db:test:api` | **49 ok, 1 FAIL** |
| – anon | HTTP 401, 0 riadkov, RPC aj zápis odmietnuté |
| – aal1 token (len heslo, rola admin) | 0 riadkov z 12 tabuliek/pohľadov; RPC a zápis HTTP 403 – **bod brány splnený** |
| – aal2 token | admin vidí dáta; `admin_list_users` OK; `next_document_number` stále odmietnuté (403) |
| – Edge Function `admin-mfa-reset` | **5/5**: neexistujúci cieľ 404, reset seba 400, cudzí Origin 403, aal1 token 403, upravený (podvrhnutý) token 401 |
| – nastavenia Auth | anonymné prihlásenie vypnuté, len e-mailový provider – OK; **verejná registrácia stále zapnutá (`disable_signup = false`) – FAIL** |
| `npm run build` | OK |
| `npm run test:e2e` | **8/8** (5 bez prihlásenia + 3 s TOTP) |
| Zvyšky testovacích používateľov | 0 (`*@test.invalid`) |

Otvorené:

- **Vypnúť verejnú registráciu** (Authentication → Sign In / Providers → _Allow new users to sign up_). Potom `db:test:api` musí skončiť „ALL PASSED“.
- API test overuje odmietnutia Edge Function, nie úspešný reset (odstránenie faktora). Úspešnú cestu pokrýva unit test handlera; na skutočnom projekte ju overí ručný test reset 2FA medzi konateľmi (časť 7, bod 11).

### Doplnenie 27/11/2026 – po vypnutí verejnej registrácie

Vlastník vypol _Allow new users to sign up_. `npm run db:test:api`: **ALL PASSED – 50/50** (anon, aal1, aal2, Edge Function 5/5, nastavenia Auth 3/3). Žiadne zvyšky testovacích používateľov.

Stav brány fázy 2:

- [x] bez TOTP sa nedá dostať k dátam ani cez API (aal1 token) – overené
- [ ] obaja konatelia majú zaregistrovaný TOTP (odporúčanie: 2 faktory na admina)
- [ ] nastavenia firmy vyplnené reálnymi údajmi
- [x] report
- [ ] ručný test reset 2FA medzi konateľmi (časť 7, bod 11)

Počas práce sandbox odhalil chybu v teste (`01_rls` vkladal kľúč, ktorý teraz pridáva seed – na dev projekte by zlyhal pri ďalšom behu) a mutácia odhalila slabú kontrolu prepisu v `05` – obe opravené.

## 5. Otvorené problémy a riziká

Body brány, ktoré ostávajú **otvorené** (čakajú na teba):

1. **„Bez TOTP žiadne dáta ani cez API (aal1 token)“** – test je hotový, spustí sa po doplnení `SUPABASE_SECRET_KEY`. Zatiaľ to pokrývajú pgTAP testy so simulovaným aal1.
2. **Obaja konatelia majú TOTP** na dev projekte (+ odporúčanie 2 faktory na admina).
3. **Nastavenia firmy** vyplnené reálnymi údajmi a logo.
4. Nasadenie Edge Function (`npx supabase login` + deploy) – bez neho reset 2FA v aplikácii nefunguje (núdzová cesta cez dashboard je opísaná v `SECURITY.md`).

Riziká:

- Tokeny v `localStorage` + CSP `'unsafe-inline'` → pri XSS únik tokenu; zmiernené (React escapovanie, `connect-src` len Supabase, RLS + aal2, JWT 1 h), riešenie vo fáze 8.
- Odhlásenie po nečinnosti beží len v prehliadači (serverový limit je v Supabase Pro).
- Neoverené: či reset 2FA ukončí už prihlásené relácie cieľa (zapísané v `SECURITY.md` a `TODO.md`).
- Ak by Edge Function vracala 401 aj adminovi (nové JWT kľúče + kontrola na bráne), nasadiť s `--no-verify-jwt` – funkcia si token overuje sama (`DEPLOYMENT.md`, F).
- Nasadenie na hosting je samostatná položka „Nasadenie“ (`TODO.md`), mimo brány F2.

## 6. Odporúčaný ďalší krok

1. Splniť body brány 1–4 (sekcia 7 nižšie), spustiť `db:test:api` a `test:e2e` s TOTP; výsledky doplním do tohto reportu.
2. Po tvojom súhlase zlúčiť PR fázy 2 (**nezlučujem bez tvojho súhlasu**).
3. Potom plán fázy 3 podľa `docs/steps/STEP-03-az-08-prehlad.md`.

## 7. Čo mám overiť ja (konkrétne kliknutia)

1. **Supabase → Project Settings → API Keys → Secret keys** → skopíruj (alebo vytvor) `sb_secret_…` do `.env.local` ako `SUPABASE_SECRET_KEY=…`. Potom v PowerShelli:
   ```powershell
   npm run db:test:api
   npm run build; npm run test:e2e
   ```
   Očakávaj `ALL PASSED` a 8 testov Playwright bez preskočených.
2. **Authentication** – prejdi kontrolný zoznam v `DEPLOYMENT.md`, časť A, bod 2 (registrácia, anonymné prihlásenie a nepoužívaní provideri vypnutí, secure email change, heslo min. 12, JWT 3600 s, TOTP zapnuté, Redirect URLs vrátane `http://localhost:3100/**`).
3. **Edge Function:** `npx supabase login`, potom `npx supabase functions deploy admin-mfa-reset --project-ref hkfkdomslzvpxukzhlwc --use-api` a znova `npm run db:test:api` (bez SKIP).
4. **Účty konateľov:** Authentication → Users → Add user → Create new user (Auto Confirm), potom SQL na rolu admin z `DEPLOYMENT.md`, časť C.
5. `npm run dev` → `http://localhost:3000` → presmeruje na Prihlásenie → e-mail a heslo → **Registrácia faktora**: názov zariadenia → QR kód naskenuj v Google/Microsoft Authenticator → kód → Prehľad (6 dlaždíc s nulami).
6. Klikni **Odhlásiť** → prihlás sa znova → zadaj **zlý kód** → musí sa zobraziť „Neplatný kód…“ → zadaj správny → Prehľad.
7. **Nastavenia → Používatelia a 2FA → Pridať záložný faktor** – druhý telefón; pri tebe sa zobrazí „2 faktory – OK“.
8. **Nastavenia → Firma** – vyplň reálne údaje, skús najprv zlé IČO (napr. `12345678`) – musí hlásiť chybu; potom správne a **Uložiť**. V **História zmien** sa zobrazí, kto a čo zmenil.
9. **Logo** – nahraj PNG/JPEG; skús aj SVG a súbor nad 2 MB – oba musia byť odmietnuté.
10. **Nečinnosť:** Systém → nastav 5 minút → Uložiť → obnov stránku (F5) → nechaj 4 min bez pohybu → upozornenie → po minúte odhlásenie a hláška na prihlasovacej stránke. Potom vráť 30.
11. **Reset 2FA** (po nasadení funkcie): manželka resetuje tebe (alebo naopak) → potvrdenie → druhý sa prihlási heslom a zaregistruje faktor znova.
