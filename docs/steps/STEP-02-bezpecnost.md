# STEP-02 – Prihlásenie, 2FA, roly, audit (fáza 2)

Vetva: `phase-02-security`

## Cieľ

Do aplikácie sa dá dostať iba e-mailom + heslom + TOTP kódom. Bez druhého faktora nevidno nič.

## Úlohy

1. **Prihlásenie** (Supabase Auth, e-mail + heslo). Registrácia z aplikácie **vypnutá** – používateľov pozýva admin (pozvánka cez Supabase).
2. **TOTP MFA**
   - Pri prvom prihlásení povinná registrácia faktora (QR kód, overenie kódu).
   - Pri každom prihlásení výzva na kód; kým `aal` ≠ `aal2`, používateľ vidí iba obrazovku zadania kódu.
   - Možnosť zaregistrovať druhý TOTP faktor (záloha, napr. druhý telefón).
   - Postup obnovy pri strate telefónu zapísať do `SECURITY.md` (druhý admin odstráni faktor cez Edge Function s overením, alebo cez Supabase dashboard).
3. **Roly**: `user_roles` + `has_role()`; v UI skryť, čo rola nesmie; v DB vynútiť RLS. V MVP obaja používatelia `admin`.
4. **Audit**: trigger `log_change` na všetkých tabuľkách s dátami; obrazovka „História zmien“ pri zázname (kto, kedy, čo).
5. **Nastavenia firmy** (iba admin): formulár pre `companies` (obchodné meno, IČO, DIČ, adresa, zápis v OR, IBAN, logo), `system_settings`, `feature_flags`, `notification_recipients`.
6. **Odhlásenie po nečinnosti** – [NÁVRH 30 min], hodnota v `system_settings`.
7. **Dashboard – kostra** s kartami (zatiaľ nuly) podľa `v_open_items`.

## Testy

- pgTAP: každá tabuľka – anon nič, authenticated aal1 nič, admin aal2 áno.
- Playwright: prihlásenie → výzva na TOTP → vstup; zlý kód → odmietnutie.
- Vitest: guard komponent pre aal2.

## Brána

- [ ] bez TOTP sa nedá dostať k dátam ani cez API (test priamym dotazom s aal1 tokenom)
- [ ] obaja konatelia majú zaregistrovaný TOTP na ostrej (testovacej) verzii
- [ ] nastavenia firmy vyplnené reálnymi údajmi vlastníkom
- [ ] report
