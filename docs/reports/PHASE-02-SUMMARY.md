# Fáza 2 – zhrnutie a čo treba urobiť

Dátum: 27/11/2026 · PR #2: https://github.com/MaLiZuW/ava-erp/pull/2 · Podrobný report: `docs/reports/PHASE-02-REPORT.md`

PR je otvorený (nie draft), CI na GitHube prešlo celé. **Bez tvojho súhlasu sa nezlúči.**
**Aktualizácia 27/11/2026:** hlavný bod brány je **splnený** – s tokenom len po hesle (aal1) prišlo cez API 0 riadkov, s TOTP (aal2) admin dáta vidí. Playwright 8/8. **Nové zistenie: verejná registrácia je na dev projekte zapnutá – treba ju vypnúť** (Authentication → Sign In / Providers → _Allow new users to sign up_ → vypnúť), potom `npm run db:test:api` musí skončiť „ALL PASSED“.

**Aktualizácia po výmene kľúčov a nasadení Edge Function:** `db:test:api` 49 ok / 1 FAIL (len verejná registrácia), Edge Function 5/5, Playwright 8/8. Zostáva vypnúť _Allow new users to sign up_.

## 1. Čo bolo vytvorené

- **Prihlásenie:** e-mail + heslo + povinný kód z overovacej aplikácie v telefóne (TOTP). Pri prvom prihlásení sa telefón zaregistruje cez QR kód. Kým nie je zadaný kód, aplikácia neukáže nič okrem prihlasovacích obrazoviek.
- **Roly:** Nastavenia vidí len admin. V UI sa skrývajú, o prístupe rozhoduje databáza.
- **Odhlásenie po nečinnosti:** po 30 min, minútu vopred príde upozornenie. Hodnota sa dá zmeniť v Nastaveniach (5–240 min).
- **Nastavenia (bento dlaždice):**
  - Firma: IČO sa kontroluje aj kontrolnou číslicou, IBAN kontrolným súčtom, IČ DPH ostáva prázdne.
  - Logo: len PNG, JPEG alebo WebP do 2 MB, SVG je zakázané.
  - Systém, Funkcie, Notifikácie.
  - Používatelia a 2FA: počet zaregistrovaných telefónov pri každom adminovi, pridanie záložného telefónu, reset 2FA kolegovi.
  - História zmien: kto, kedy a čo zmenil.
- **Reset 2FA:** robí ho funkcia na serveri Supabase (`admin-mfa-reset`), so všetkými podmienkami z doplnku D4.
- **Dashboard:** 6 počítadiel, zatiaľ nuly.

## 2. Zmenené súbory

9 commitov, zoznam je v `docs/reports/PHASE-02-REPORT.md`.

## 3. Databázové zmeny (migrácie)

Jedna migrácia `20261127100000_phase2_security.sql`, už nasadená na `ava-erp-dev`:

- tabuľky `notification_recipients` a `documents` (zamknutý dokument sa nedá zmeniť ani zmazať);
- súkromný priečinok na súbory `documents`, v ktorom sa súbor nedá prepísať;
- funkcia `admin_list_users()` a pohľad `v_open_items` pre dashboard.

## 4. Testy – čo prešlo, čo nie

- **Prešlo:** Vitest 98/98 · databázové testy 142/142 (dev projekt aj lokálny sandbox) · build a CI na GitHube · Playwright 5/5 bez prihlásenia.
- **Pokus o oslabenie pravidiel:** schválne povolený prepis súboru, vypnutý zámok dokumentu a vypnutá kontrola TOTP vo funkcii so zoznamom používateľov – každú zmenu testy zachytili.
- **Opravené počas práce:** jeden test by na dev projekte pri ďalšom behu spadol na kolízii s novými testovacími dátami; iný test by prepísanie súboru neodhalil.
- **Nespustené:**
  - test prihlásenia cez API (bez TOTP žiadne dáta, s TOTP dáta) – chýba `SUPABASE_SECRET_KEY`;
  - 3 testy Playwright s TOTP – z toho istého dôvodu;
  - kontroly funkcie na reset 2FA – kým ju nenasadíš, test ich preskočí so správou „SKIP“.

## 5. Otvorené problémy a riziká

- **Body brány čakajú na teba:** test prihlásenia cez API, TOTP u oboch konateľov (odporúčané 2 telefóny na admina), reálne údaje firmy, nasadenie funkcie na reset 2FA.
- **Tokeny v prehliadači:** prihlásenie sa ukladá v prehliadači a pravidlá zabezpečenia stránky (CSP) zatiaľ povoľujú vložené skripty. Pri útoku podstrčeným skriptom by mohlo uniknúť prihlásenie. Zmiernené, zapísané v `SECURITY.md`, rieši sa vo fáze 8.
- **Nečinnosť sa stráži len v prehliadači.** Limit na strane servera má Supabase len v pláne Pro.
- **Neoverené:** či reset 2FA odhlási kolegu na zariadeniach, kde je už prihlásený.
- **Nasadenie na hosting** je podľa D8 samostatná položka v `TODO.md`, mimo brány fázy 2.

## 6. Odporúčaný ďalší krok

Splniť body z časti 7 a poslať výstup testov – doplní sa do reportu. Po tvojom súhlase sa PR zlúči a pripraví sa plán fázy 3.

## 7. Čo máš overiť ty

- [ ] **Kľúč:** Supabase → Project Settings → API Keys → Secret keys → skopíruj `sb_secret_…` do `.env.local` ako `SUPABASE_SECRET_KEY=…`. Potom v PowerShelli:
  ```powershell
  npm run db:test:api
  npm run build; npm run test:e2e
  ```
  Očakávaj „ALL PASSED“ a 8 testov Playwright bez preskočených.
- [ ] **Nastavenia prihlásenia:** prejdi kontrolný zoznam v `DEPLOYMENT.md`, časť A, bod 2.
- [ ] **Funkcia na reset 2FA:**
  ```powershell
  npx supabase login
  npx supabase functions deploy admin-mfa-reset --project-ref hkfkdomslzvpxukzhlwc --use-api
  npm run db:test:api
  ```
  Test už nesmie hlásiť „SKIP“.
- [ ] **Účty konateľov:** Authentication → Users → Add user, potom priraď rolu admin príkazom z `DEPLOYMENT.md`, časť C.
- [ ] **Prihlásenie:** `npm run dev` → prihlásenie → naskenuj QR kód → Prehľad. Odhlás sa, zadaj zlý kód (musí hlásiť „Neplatný kód“), potom správny.
- [ ] **Nastavenia:**
  - Firma: zlé IČO `12345678` musí hlásiť chybu, potom vyplň reálne údaje a ulož.
  - Logo: SVG a súbor nad 2 MB musia byť odmietnuté.
  - Pridaj záložný telefón (Používatelia a 2FA).
  - Skontroluj História zmien.
- [ ] **Nečinnosť:** Systém → 5 minút → Uložiť → F5 → 4 min bez pohybu → upozornenie → po minúte odhlásenie a hláška na prihlasovacej stránke. Potom vráť 30.
- [ ] **Reset 2FA** (po nasadení funkcie): jeden konateľ resetuje druhému → potvrdenie → druhý sa prihlási heslom a zaregistruje telefón znova.
