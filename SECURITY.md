# SECURITY.md

Bezpečnostný model systému. Pravidlá „bez výnimky“ sú v `CLAUDE.md`.

## Prihlásenie a druhý faktor (fáza 2)

- Prihlásenie: e-mail + heslo (Supabase Auth) **a povinne TOTP** (overovacia aplikácia v telefóne). Verejná registrácia je vypnutá; účty zakladá administrátor (Supabase dashboard).
- Postup v prehliadači: heslo → ak používateľ nemá faktor, **povinná registrácia** (QR kód + overenie kódu) → inak **výzva na kód**. Kým session nemá `aal2`, aplikácia nezobrazí nič okrem prihlasovacích obrazoviek (`RequireAal2` v `src/core/auth/require-aal2.tsx`).
- **Vynútenie je v databáze, nie vo frontende:** každá tabuľka má reštriktívnu politiku `require_aal2`, takže s tokenom `aal1` (len heslo) databáza nevráti nič, ani administrátorovi. Overené pgTAP testami (simulované claims) aj **skutočným aal1 tokenom cez REST API** (`npm run db:test:api`).
- Funkcie `security definer` obchádzajú RLS, preto aal2 a rolu overujú samy: `public.transition()`, `public.admin_list_users()` (má navyše `search_path = ''`).
- Pozvánkový odkaz (ak ho admin použije) otvorí najprv obrazovku **Nastavenie hesla** (min. 12 znakov), potom registráciu faktora.
- Odporúčanie (bod brány): **každý administrátor má 2 TOTP faktory** – hlavný a záložný telefón. Stav vidno v Nastavenia → Používatelia a 2FA.

## Obnova pri strate telefónu (TOTP)

Poradie podľa situácie:

1. **Máte záložný faktor** (druhý telefón) – prihláste sa ním, v Nastavenia → Používatelia a 2FA si zaregistrujte nový telefón. Stratený faktor nechajte resetovať druhému administrátorovi (bod 2), aby zmizol aj zo zoznamu.
2. **Druhý administrátor v aplikácii** – Nastavenia → Používatelia a 2FA → pri kolegovi „Resetovať 2FA“ → potvrdenie. Volá Edge Function `admin-mfa-reset`, ktorá:
   - **overí JWT volajúceho** (podpis a platnosť cez `auth.getClaims`, nie len dekódovanie), `aal` berie z overených claims, rolu `admin` a aktívny profil z databázy;
   - zakáže reset **sám sebe**, overí, že **cieľový používateľ existuje**;
   - odstráni všetky jeho TOTP faktory a zapíše záznam do `activity_logs` (kto, komu, kedy, počet faktorov – žiadne detaily faktorov);
   - CORS povoľuje len `https://app.av-agency.sk` a `http://localhost:3000/3100`; token, telo požiadavky ani tajomstvá sa **nelogujú**.
     Pred resetom si identitu kolegu overte osobne alebo telefonicky. Kolega sa potom prihlási heslom a zaregistruje nový telefón.
3. **Núdzová cesta – Supabase dashboard** (ak nie je dostupný druhý admin s aal2, alebo Edge Function): Authentication → Users → používateľ → sekcia _Multi-Factor Authentication_ → odstrániť faktor. Prístup do dashboardu má len vlastník (chráňte ho vlastným 2FA účtu Supabase).
4. **Zabudnuté heslo** – administrátor nastaví nové heslo v Supabase dashboarde (Authentication → Users → _Reset password_ / _Send password recovery_). Aplikácia nemá verejný formulár „zabudnuté heslo“ (menej útočných ciest; vstavané odosielanie e-mailov Supabase Free je obmedzené).

## Relácia (session) a odhlásenie

- JWT platí 3600 s, obnovuje sa refresh tokenom (rotácia zapnutá). Odhlásenie (`scope: local`) zruší refresh token tejto relácie na serveri a vymaže lokálne úložisko.
- **Odhlásenie po nečinnosti:** predvolene 30 min (`system_settings.inactivity_minutes`, 5–240), 60 s pred koncom upozornenie „Zostať prihlásený“. Aktivita v ktorejkoľvek karte predlžuje všetky karty. **Obmedzenie:** beží v prehliadači; serverový limit nečinnosti Supabase (Auth → Sessions → Inactivity timeout) je len v pláne Pro – zapnúť na produkčnom projekte.
- **Známe riziko – session v `localStorage` pri CSP `'unsafe-inline'`:** supabase-js ukladá prístupový aj refresh token do `localStorage`. Statický export Next.js zatiaľ potrebuje `'unsafe-inline'` pre skripty, preto by úspešný XSS mohol token prečítať. Zmierňuje to: React escapuje výstup, žiadne `dangerouslySetInnerHTML`, CSP `connect-src` povoľuje len vlastnú doménu a Supabase (token sa nedá poslať inam cez `fetch`/XHR), RLS + aal2, krátka platnosť JWT. **Riešenie vo fáze 8:** CSP s hashmi namiesto `'unsafe-inline'` (TODO).

## Dáta a prístup

- `anon` nemá prístup k žiadnej tabuľke ani pohľadu (test).
- Role: `admin` všetko; `manager`, `accountant`, `external` sú pripravené, politiky pribudnú s modulmi. Bez roly používateľ nevidí nič okrem číselníkov (divízie, feature flagy, stavové prechody) a vlastného profilu. V UI sa skrýva, čo rola nesmie (`RequireRole`, `visibleNavItems`) – rozhoduje však vždy RLS.
- **Nová tabuľka = RLS + `require_aal2` + `GRANT` + test.** Meta-test zlyhá, ak niektorá tabuľka v `public` nemá RLS alebo `require_aal2`.
- Audit: každá zmena a prechod stavu ide do `activity_logs` (append-only aj pre vlastníka). Obrazovka „História zmien“ v Nastaveniach.
- Vystavené doklady sa nemenia ani nemažú (trigger `lock_issued` príde s prvým dokladom). Dokumenty: `documents.is_locked = true` → riadok sa nedá zmeniť ani zmazať (trigger aj pre vlastníka).
- Číslovanie dokladov nejde volať cez API (`next_document_number` nemá `EXECUTE` pre `anon`/`authenticated`).

## Súbory (Storage)

- Bucket `documents` je **súkromný**; náhľady len cez **podpísané URL** s platnosťou 5 min, vydané až po kontrole RLS.
- Fáza 2 (logo): povolené len **PNG, JPEG, WebP do 2 MB**, **SVG zakázané** (môže obsahovať skript). Kontrola v prehliadači (prípona, MIME typ a „magic bytes“ obsahu) aj na serveri (nastavenie bucketu – `allowed_mime_types`, `file_size_limit`).
- Politiky `storage.objects`: čítanie, nahranie a zmazanie len admin s aal2; **žiadna UPDATE politika → prepis/upsert je vždy zakázaný** (nová verzia = nový objekt); objekt patriaci zamknutému dokumentu sa nedá zmazať ani nahrať znova na tú istú cestu (`private.is_locked_object`). Testy: `supabase/tests/05_documents_storage.test.sql` (overené aj mutáciou – pridaná UPDATE politika test zhodí).
- Názov súboru v ceste sa normalizuje na ASCII (`safeFileName`), cesta má pevný tvar `RRRR/<tabuľka>/<id>/<uuid>-<názov>` (constraint v DB).

## Tajomstvá

- `service_role` kľúč, heslo k databáze, prístupy k e-mailu a FTP **nikdy v repozitári ani vo frontende**. Lokálne `.env.local` (v `.gitignore`), na serveri `supabase secrets`/Vault. `.env.example` obsahuje len názvy.
- Do frontendu patria iba `NEXT_PUBLIC_SUPABASE_URL` a anon kľúč (verejný; chráni ho RLS).
- `SUPABASE_SECRET_KEY` (fáza 2) je **len pre lokálne testovacie skripty** (`db:test:api`, Playwright): vytvára a maže dočasných používateľov `*@test.invalid` na **dev** projekte cez Admin API. Skripty odmietnu bežať proti inému projektu; heslá a TOTP tajomstvá sú náhodné pre každý beh a nikde sa nevypisujú. Na produkčnom projekte sa nepoužíva.
- Edge Function dostáva `SUPABASE_SERVICE_ROLE_KEY` automaticky od Supabase – v kóde ani v repozitári nie je.
- Supabase Free: len testovacie dáta. Výnimka so súhlasom vlastníka: verejné údaje firmy z obchodného registra (Nastavenia → Firma). Ostré dáta zákazníkov až na samostatnom projekte Pro.

## Hlavičky servera (`public/.htaccess`)

HTTPS presmerovanie, HSTS, CSP (len vlastná doména a Supabase – REST, Auth, Storage aj Edge Functions sú na tej istej doméne projektu), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Dotfiles sa nikdy neservírujú. Overenie na skutočnom Apache je samostatná položka „Nasadenie“ v `TODO.md`.

## Známe limity

- Ochrana stavu proti priamej zmene stojí na prepínači `app.in_transition` a kontrole `current_user`; cez REST API sa dá nastaviť iba volaním `transition()`. Priamy SQL prístup (vlastník databázy) je mimo tohto modelu.
- Reset 2FA nemusí ukončiť už prihlásené relácie cieľového používateľa (správanie Supabase Auth sme neoverovali). Pri podozrení na odcudzenie prihláseného zariadenia: v dashboarde _Sign out user_ (všetky relácie) a zmena hesla.
- Dev projekt Free nemá automatické zálohy – zdroj pravdy sú migrácie a seed v Gite.
