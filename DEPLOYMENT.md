# DEPLOYMENT.md

Postupy sú pre **Windows / PowerShell**. Prístupy (heslá, FTP, kľúče) nikdy nepatria do repozitára ani do chatu.

## A. Supabase – vývojový projekt (Free) – robí vlastník

1. Na <https://supabase.com> vytvor projekt: názov `ava-erp-dev`, **región EÚ** (napr. Frankfurt), silné databázové heslo (ulož do správcu hesiel). Plán Free.
2. **Authentication → Sign In / Providers**: vypni _Allow new users to sign up_ (registrácia zakázaná, používateľov pozývaš ty). Skontroluj, že je zapnutý **Multi-Factor → TOTP** (Enroll aj Verify).
3. **Authentication → URL Configuration**: _Site URL_ = `https://app.av-agency.sk`; do _Redirect URLs_ pridaj `http://localhost:3000/**` a `https://app.av-agency.sk/**`.
4. **Project Settings → API**: skopíruj _Project URL_ a _anon public_ kľúč. Tie dvaja môžeš poslať do chatu. **`service_role` a databázové heslo nikdy nezdieľaj** – ostávajú len u teba.
5. **Project Settings → Database → Connection string**: vyber **Session pooler** (voľný plán nemá priamy IPv4 prístup; pooler funguje všade) a skopíruj reťazec do `.env.local` (krok B).
6. Upozornenia plánu Free: po 7 dňoch nečinnosti sa projekt pozastaví (v dashboarde ho obnov tlačidlom _Restore_); nemá automatické zálohy – zdrojom pravdy sú migrácie a seed v Gite. **Len testovacie dáta.**

## B. Lokálna konfigurácia (`.env.local`)

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Vyplň `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` a `SUPABASE_DB_URL` (session pooler, s tvojím heslom). Súbor je v `.gitignore`.

## C. Databáza (migrácie, seed, testy)

```powershell
# Skripty čítajú SUPABASE_DB_URL z .env.local (session pooler) – netreba `supabase login` ani `link`.
npm run db:push                          # nasadí supabase/migrations na dev projekt
npm run db:seed                          # testovacie dáta (opakovane bezpečné)
npm run db:types                         # typy do src/core/supabase/database.types.ts
npm run db:test                          # pgTAP + súbežnosť na dev projekte
npm run db:test:api                      # anon kľúč: bez prihlásenia žiadne dáta (HTTP 401)
```

Prvý používateľ a rola administrátora (po pozvánke z dashboardu _Authentication → Users → Invite user_): v _SQL Editor_ spusti
`insert into public.user_roles (user_id, role) select id, 'admin' from public.profiles where email = '<e-mail>';`
(profil sa vytvorí automaticky pri vzniku používateľa). Správa používateľov v aplikácii príde vo fáze 2.

**Postaviť databázu od nuly** (brána fázy 1) je deštruktívne – robí sa len na dev projekte a len s tvojím výslovným súhlasom (Supabase dashboard → _Database → Migrations_ / alebo nový prázdny projekt, potom `db:push` + `db:seed`).

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

V prehliadači: otvor `https://app.av-agency.sk/zakazky/` a stlač F5 – nesmie byť 404; menu má 14 položiek; `Ctrl+K` otvorí paletu.

**O3 – HTTPS certifikát:** ak `https://app.av-agency.sk` hlási chybu certifikátu, v administrácii WebSupport zapni/obnov SSL certifikát pre subdoménu `app.av-agency.sk` (Let's Encrypt, zdarma) a skús znova po aktivácii (môže trvať niekoľko minút).

## F. Edge Functions a tajomstvá (neskôr)

```powershell
npx supabase secrets set NAZOV=hodnota          # tajné hodnoty len takto
npx supabase functions deploy <meno> --use-api  # nasadenie bez Dockeru
```
