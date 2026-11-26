# TODO.md

## Fáza 2 – čaká na vlastníka (brána)

- [x] `SUPABASE_SECRET_KEY` v `.env.local`; `npm run db:test:api` – aal1 token = žiadne dáta (bod brány splnený 27/11/2026); Playwright 8/8.
- [ ] **Vypnúť verejnú registráciu** na dev projekte (Authentication → Sign In / Providers → _Allow new users to sign up_) – `db:test:api` ju teraz hlási ako FAIL.
- [ ] Skontrolovať nastavenia Supabase Auth podľa kontrolného zoznamu (`DEPLOYMENT.md`, časť A, bod 2) – registrácia, anonymné prihlásenie a nepoužívaní provideri vypnutí, bezpečná zmena e-mailu, min. heslo 12, JWT 3600 s, TOTP zapnuté, Redirect URLs.
- [ ] `npx supabase login` a nasadiť Edge Function `admin-mfa-reset` (`DEPLOYMENT.md`, časť F); `db:test:api` potom nesmie hlásiť SKIP.
- [ ] Obaja konatelia: účet v dashboarde, rola admin, prvé prihlásenie s registráciou TOTP (bod brány).
- [ ] Odporúčanie: každý admin 2 TOTP faktory (telefón + záloha) – Nastavenia → Používatelia a 2FA.
- [ ] Nastavenia → Firma vyplnené reálnymi údajmi + logo (bod brány).

## Nasadenie (samostatná položka – po rozhodnutí o hostingu A/B/C, vlastný malý PR)

Presunuté z brány fázy 1 do fázy 2 a so súhlasom vlastníka (27. 11. 2026) vyčlenené ako samostatná úloha. Hosting `app.av-agency.sk` je od 26. 11. 2026 pozastavený zo strany WebSupportu; zatiaľ sa testuje lokálne (`npm run build` + `npm run test:e2e` proti `out/`).

- [ ] vlastník rozhodne o hostingu (A/B/C);
- [ ] HTTPS certifikát pre cieľovú doménu (O3 v `docs/DECISIONS.md`);
- [ ] nahrať `out/` (`DEPLOYMENT.md`, časť D; skryté súbory – `.htaccess` – musia ísť s ním);
- [ ] kontrola `.htaccess` a HTTPS (`DEPLOYMENT.md`, časť E): HTTP → HTTPS (301), hlavičky (HSTS, CSP, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy), obnovenie `/zakazky/` bez 404, neexistujúca adresa → 404.html;
- [ ] prihlásenie heslom + TOTP na ostrej doméne; konzola bez CSP chýb (aj QR kód a logo);
- [ ] doplniť ostrú doménu do CORS Edge Function, ak sa zmení (`supabase/functions/admin-mfa-reset/handler.ts`).
      Poznámka: `.htaccess` je zatiaľ overený len testom textu (`src/core/htaccess.test.ts`), nie na skutočnom Apache.

## Fáza 1 – zvyšné

- [x] Supabase projekt `ava-erp-dev`, `.env.local`, `db:*` skripty, databáza od nuly (26. 11. 2026).
- [ ] **Prototyp IMAP/SMTP** (nezdržuje brány): potrebná testovacia schránka na WebSupport. Edge Function `email-check` v samostatnej vetve `proto-email-check`, vráti len „spojenie OK / chyba“, údaje cez `supabase secrets`. Riziko: Edge Functions blokujú odchádzajúce porty 25 a 587, SMTP sa testuje na 465. **Stav: otvorené – vlastník zatiaľ nemá testovaciu schránku.**

## Technický dlh a neskôr

- [ ] CSP: nahradiť `'unsafe-inline'` pre skripty hashmi generovanými po builde (fáza 8) – súvisí s rizikom tokenov v `localStorage` (`SECURITY.md`).
- [ ] Logo a znak AV v `public/brand/`: nahradiť zástupné SVG súbormi od vlastníka (statické súbory aplikácie; logo firmy na doklady sa už nahráva v Nastaveniach).
- [ ] Prepínač divízie (Všetko / AVENG / Agentúra) v hornej lište – `DESIGN_SYSTEM.md` §5 (po zavedení dát, fáza 3+).
- [ ] Politiky pre role `manager`, `accountant`, `external` (s modulmi, ktoré ich potrebujú).
- [ ] Trigger `lock_issued` a `status_transitions` naplniť podľa `BUSINESS_PROCESSES.md` kap. 4 (s prvými dokladmi).
- [ ] Typy udalostí pre `notification_recipients.event_types` – až s notifikáciami (nevymýšľať vopred).
- [ ] Bucket `documents`: rozšíriť povolené typy (PDF, prílohy) a limity s modulmi, ktoré ich potrebujú.
- [ ] Na produkčnom projekte Pro: serverový limit nečinnosti relácie (Auth → Sessions) a overenie, či reset 2FA ukončí relácie cieľa.
- [ ] Pred ostrými dátami: samostatný projekt Pro, zálohy, nezávislá bezpečnostná revízia (fáza 8).

## Hotové vo fáze 2

- [x] Supabase klient v `src/core/supabase` a typy z `db:types`.
- [x] FK `companies.logo_document_id` → `documents`.
- [x] Farby `success`/`warning`/`danger` a neutrály – kontrast WCAG AA overený testom.
