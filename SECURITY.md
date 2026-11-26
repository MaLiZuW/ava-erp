# SECURITY.md

Bezpečnostný model systému. Pravidlá „bez výnimky“ sú v `CLAUDE.md`.

## Prihlásenie a druhý faktor

- Povinné TOTP 2FA pre všetkých používateľov (2 administrátori). Prihlásenie a registrácia faktora sa implementuje vo fáze 2.
- **Vynútenie je v databáze, nie vo frontende:** každá tabuľka má reštriktívnu politiku `require_aal2`, takže bez druhého faktora (`aal` v JWT ≠ `aal2`) databáza nevráti nič, ani administrátorovi. Pokrýva to test `01_rls.test.sql` (vrátane kontroly, že žiadna tabuľka nechýba).
- `public.transition()` je `security definer` (obchádza RLS), preto aal2 a rolu overuje aj samotná funkcia.
- Registrácia z aplikácie je vypnutá; používateľov pozýva admin.

## Dáta a prístup

- `anon` nemá prístup k žiadnej tabuľke (test).
- Role: `admin` všetko, ostatné role (`manager`, `accountant`, `external`) sú pripravené v enume, politiky pre ne pribudnú s modulmi, ktoré ich potrebujú. Bez roly používateľ nevidí nič okrem číselníkov (divízie, feature flagy, stavové prechody) a vlastného profilu.
- **Nová tabuľka = RLS + `require_aal2` + `GRANT` + test.** Meta-test zlyhá, ak niektorá tabuľka v `public` nemá zapnuté RLS alebo politiku `require_aal2`.
- Audit: každá zmena a prechod stavu ide do `activity_logs`; tabuľka je append-only (UPDATE/DELETE/TRUNCATE blokuje trigger aj vlastníkovi).
- Vystavené doklady sa nemenia ani nemažú – vynucuje databáza (trigger `lock_issued` pribudne s prvým dokladom, fáza 4+).
- Číslovanie dokladov nejde obísť ani zneužiť cez API (`next_document_number` nie je volateľné rolami `anon`/`authenticated`).

## Tajomstvá

- `service_role` kľúč, heslo k databáze, prístupy k e-mailu a FTP **nikdy v repozitári**. Lokálne `.env.local` (v `.gitignore`), na serveri `supabase secrets`/Vault. `.env.example` obsahuje len názvy.
- Do frontendu patria iba `NEXT_PUBLIC_SUPABASE_URL` a anon kľúč (ten je verejný; chráni ho RLS).
- Supabase Free: len testovacie dáta. Ostré dáta až na samostatnom projekte Pro.

## Hlavičky servera (`public/.htaccess`)

HTTPS presmerovanie, HSTS, CSP (len vlastná doména a Supabase), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Dotfiles sa nikdy neservírujú.

**Známe obmedzenie:** statický export Next.js vkladá inline skripty, preto CSP zatiaľ povoľuje `'unsafe-inline'` pre skripty. Plán: po builde generovať hashe a sprísniť (TODO, fáza 8). Dovtedy znižuje riziko zvyšok CSP (`default-src 'self'`, `connect-src` len Supabase, `frame-ancestors 'none'`, `object-src 'none'`).

## Obnova pri strate telefónu (TOTP)

Doplní sa vo fáze 2 (druhý admin odstráni faktor cez Edge Function s overením, alebo cez Supabase dashboard). Odporúčanie už teraz: každý administrátor si zaregistruje druhý faktor (záložný telefón).

## Známe limity

- Ochrana stavu proti priamej zmene stojí na prepínači `app.in_transition` a kontrole `current_user`; cez REST API sa dá nastaviť iba volaním `transition()`. Priamy SQL prístup (vlastník databázy) je mimo tohto modelu.
- Dev projekt Free nemá automatické zálohy – zdroj pravdy sú migrácie a seed v Gite.
