# DEPLOYMENT.md

Postupy sú pre **Windows / PowerShell**. Prístupy (heslá, FTP, kľúče) nikdy nepatria do repozitára ani do chatu.

## A. Supabase – vývojový projekt (Free) – robí vlastník

1. Na <https://supabase.com> vytvor projekt: názov `ava-erp-dev`, **región EÚ** (napr. Frankfurt), silné databázové heslo (ulož do správcu hesiel). Plán Free.
2. **Nastavenie Supabase Auth – kontrolný zoznam (fáza 2).** Názvy volieb sa v dashboarde občas mierne menia; hľadaj podľa významu.

   | Kde (Authentication → …)                     | Nastavenie                                       | Hodnota                                                                 |
   | -------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
   | Sign In / Providers                          | _Allow new users to sign up_                     | **vypnuté** (účty zakladáš ty)                                          |
   | Sign In / Providers                          | _Allow anonymous sign-ins_                       | **vypnuté**                                                             |
   | Sign In / Providers                          | Email                                            | zapnutý; _Confirm email_ podľa potreby (účty z dashboardu sú potvrdené) |
   | Sign In / Providers                          | všetky ostatné (Phone, Google, Apple, GitHub, …) | **vypnuté**                                                             |
   | Sign In / Providers → Email                  | _Secure email change_                            | **zapnuté** (potvrdenie na starej aj novej adrese)                      |
   | Sign In / Providers → Email                  | _Minimum password length_                        | **12**                                                                  |
   | Multi-Factor                                 | TOTP (App Authenticator)                         | **Enabled** (registrácia aj overenie)                                   |
   | Sessions / JWT (Project Settings → JWT Keys) | _Access token expiry_                            | **3600 s**                                                              |
   | Sessions                                     | _Inactivity timeout_                             | len Pro – na produkčnom projekte nastaviť 30 min                        |

   Pomocou `npm run db:test:api` sa overí, že verejná registrácia je naozaj vypnutá.

3. **Authentication → URL Configuration**: _Site URL_ = `https://app.av-agency.sk`; do _Redirect URLs_ pridaj `http://localhost:3000/**`, `http://localhost:3100/**` a `https://app.av-agency.sk/**`. (Localhost je potrebný pre vývoj a testy; na produkčnom projekte nechaj len ostrú doménu.)
4. **Project Settings → API Keys**: skopíruj _Project URL_ a _anon / publishable_ kľúč. Tie dva môžeš poslať do chatu. **`service_role` / secret kľúč a databázové heslo nikdy nezdieľaj** – ostávajú len u teba (secret kľúč patrí iba do tvojho `.env.local`, krok B).
5. **Project Settings → Database → Connection string**: vyber **Session pooler** (voľný plán nemá priamy IPv4 prístup; pooler funguje všade) a skopíruj reťazec do `.env.local` (krok B).
6. Upozornenia plánu Free: po 7 dňoch nečinnosti sa projekt pozastaví (v dashboarde ho obnov tlačidlom _Restore_); nemá automatické zálohy – zdrojom pravdy sú migrácie a seed v Gite. **Len testovacie dáta.**

## B. Lokálna konfigurácia (`.env.local`)

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Vyplň `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` a `SUPABASE_DB_URL` (session pooler, s tvojím heslom). Súbor je v `.gitignore`.

Pre testy prihlásenia (`npm run db:test:api`, Playwright `e2e/auth.spec.ts`) doplň aj `SUPABASE_SECRET_KEY` – **Project Settings → API Keys → Secret keys** (`sb_secret_…`; ak ho projekt ešte nemá, _Create new secret key_). Kľúč vytvára a maže dočasných testovacích používateľov `*@test.invalid` len na dev projekte; skripty proti inému projektu odmietnu bežať. Nikdy ho nedávaj do premennej s `NEXT_PUBLIC_`, do chatu ani do GitHubu.

## C. Databáza (migrácie, seed, testy)

```powershell
# Skripty čítajú SUPABASE_DB_URL z .env.local (session pooler) – netreba `supabase login` ani `link`.
npm run db:push                          # nasadí supabase/migrations na dev projekt
npm run db:seed                          # testovacie dáta (opakovane bezpečné)
npm run db:types                         # typy do src/core/supabase/database.types.ts
npm run db:test                          # pgTAP + súbežnosť na dev projekte
npm run db:test:api                      # anon kľúč: bez prihlásenia žiadne dáta (HTTP 401)
```

### Používatelia (konatelia)

1. _Authentication → Users → Add user → Create new user_: e-mail, silné heslo (min. 12 znakov), zaškrtni _Auto Confirm User_. (Pozvánka e-mailom – _Invite user_ – funguje tiež; aplikácia po kliknutí na odkaz najprv vyžiada nastavenie hesla. Vstavané odosielanie e-mailov na pláne Free je však obmedzené.)
2. Rola administrátora v _SQL Editor_:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from public.profiles where email = '<e-mail>';
   ```
   (profil sa vytvorí automaticky pri vzniku používateľa; meno doplníš: `update public.profiles set full_name = 'Meno Priezvisko' where email = '<e-mail>';`)
3. Prvé prihlásenie v aplikácii → povinná registrácia TOTP. Potom v _Nastavenia → Používatelia a 2FA → Pridať záložný faktor_ zaregistruj druhý telefón.

### Systémové nastavenia na novom (produkčnom) projekte

`db:push` spúšťa len migrácie, **seed nie**. Aplikácia funguje aj bez záznamu (predvolené 30 min), ale hodnotu odporúčame vložiť výslovne v _SQL Editor_:

```sql
insert into public.system_settings (key, value, description)
values ('inactivity_minutes', '30', 'Automatic sign-out after N minutes of inactivity (5–240)')
on conflict (key) do nothing;
```

Rovnako firma: na prázdnom projekte ju vytvorí prvé uloženie v _Nastavenia → Firma_.

**Postaviť databázu od nuly** (overené 26. 11. 2026) je deštruktívne – len na dev projekte a len s tvojím výslovným súhlasom:

```powershell
npm run db:reset:dev -- --confirm=hkfkdomslzvpxukzhlwc   # zmaže objekty projektu + históriu migrácií (poistky: ref projektu, prázdne auth.users, žiadne neznáme tabuľky)
npm run db:push -- --yes
npm run db:seed
npm run db:test
```

> **Stav 27. 11. 2026:** hosting je pozastavený zo strany WebSupportu – časti D a E sú zatiaľ neoverené. Je to samostatná položka **„Nasadenie“** v `TODO.md` (po rozhodnutí o hostingu A/B/C, vlastný malý PR); nie je súčasťou brány fázy 2.

## D. Zostavenie a nahranie na hosting (FTP, WinSCP)

1. Zostavenie:
   ```powershell
   npm run lint; npm run typecheck; npm test; npm run build
   ```
   Výsledok je priečinok `out/` (obsahuje aj `.htaccess`).
2. **WinSCP** (<https://winscp.net>) → _New Session_: protokol **FTP**, šifrovanie **TLS/SSL Explicit** (ak ho WebSupport ponúka), server/port/meno/heslo z administrácie WebSupport. Heslo ulož len vo WinSCP.
3. V paneli hostingu otvor vzdialený priečinok **`/av-agency.sk/sub/app`**.
4. V WinSCP zapni zobrazenie skrytých súborov (_Options → Preferences → Panels → Show hidden files_, alebo `Ctrl+Alt+H`) – inak sa `.htaccess` neprenesie.
5. Nahraj **obsah** priečinka `out/` (nie samotný priečinok `out`) do `/av-agency.sk/sub/app`. Odporúčaný je _Commands → Synchronize_ (smer _Remote_, kritérium _Modification time_); možnosť _Delete files_ zapni až keď si overil, že cieľový priečinok je správny.
6. Súbory nahrávaj v tomto poradí, ak aplikáciu práve používaš: najprv `_next/`, potom zvyšok (HTML odkazuje na nové názvy súborov v `_next/`).

## E. Kontrola po nahraní

```powershell
curl.exe -I http://app.av-agency.sk/          # očakávaj 301 → https://
curl.exe -I https://app.av-agency.sk/         # 200 a hlavičky: Strict-Transport-Security, Content-Security-Policy, X-Frame-Options: DENY ...
curl.exe -I https://app.av-agency.sk/zakazky/ # 200 (obnovenie stránky v podsekcii)
curl.exe -I https://app.av-agency.sk/neexistuje/ # 404 (stránka 404.html)
```

V prehliadači: otvor `https://app.av-agency.sk/zakazky/` a stlač F5 – nesmie byť 404 (bez prihlásenia ťa presmeruje na prihlásenie); po prihlásení heslom + TOTP má menu 14 položiek a `Ctrl+K` otvorí paletu. V konzole prehliadača (F12) nesmú byť chyby CSP – ani pri zobrazení QR kódu (registrácia faktora) a loga (Nastavenia).

**O3 – HTTPS certifikát:** ak `https://app.av-agency.sk` hlási chybu certifikátu, v administrácii WebSupport zapni/obnov SSL certifikát pre subdoménu `app.av-agency.sk` (Let's Encrypt, zdarma) a skús znova po aktivácii (môže trvať niekoľko minút).

## F. Edge Functions a tajomstvá

Jednorazovo prihlásenie Supabase CLI (otvorí prehliadač; prístupový token sa uloží u teba, nie v repozitári):

```powershell
npx supabase login
```

Nasadenie funkcie na reset 2FA (fáza 2) – bez Dockeru:

```powershell
npx supabase functions deploy admin-mfa-reset --project-ref hkfkdomslzvpxukzhlwc --use-api
npm run db:test:api        # časť „Edge Function admin-mfa-reset“ už nesmie hlásiť SKIP
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` a `SUPABASE_SERVICE_ROLE_KEY` dostáva funkcia od Supabase automaticky – netreba ich nastavovať. Ďalšie tajné hodnoty (neskôr e-mail) len takto:

```powershell
npx supabase secrets set NAZOV=hodnota
```

Ak by funkcia vracala 401 aj pre prihláseného admina (projekt s novými JWT kľúčmi a zapnutou kontrolou JWT na bráne), nasaď ju s `--no-verify-jwt` – funkcia si token overuje sama (podpis, platnosť, aal2, rola).
