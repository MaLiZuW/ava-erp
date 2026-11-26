# TODO.md

## Rozpracované vo fáze 1 (čaká na vlastníka)

- [x] Supabase projekt `ava-erp-dev` založený, `.env.local` hotový (session pooler).
- [x] `db:push`, `db:seed`, `db:types`, `db:test`, `db:test:api` na dev projekte – zelené (26. 11. 2026).
- [x] Databáza postavená od nuly na dev projekte `ava-erp-dev` z migrácií + seedu, všetky testy zelené (26. 11. 2026, so súhlasom vlastníka).
- [ ] **BRÁNA FÁZY 1 – OTVORENÁ: nasadenie a kontrola hostingu.** Hosting `app.av-agency.sk` je od 26. 11. 2026 pozastavený zo strany WebSupportu, preto sa zatiaľ testuje lokálne (`npm run build` + `npm run test:e2e` proti `out/`). Po obnovení hostingu:
  - [ ] vlastník zapne/obnoví HTTPS certifikát pre `app.av-agency.sk` (O3 v `docs/DECISIONS.md`);
  - [ ] vlastník nahrá `out/` do `/av-agency.sk/sub/app` cez WinSCP (`DEPLOYMENT.md`, časť D; skryté súbory – `.htaccess` – musia ísť s ním);
  - [ ] kontrola `.htaccess` a HTTPS na ostrej doméne (`DEPLOYMENT.md`, časť E): HTTP → HTTPS (301), hlavičky (HSTS, CSP, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy), obnovenie `/zakazky/` bez 404, neexistujúca adresa → 404.html;
  - [ ] overiť, že CSP nezablokuje Supabase ani vlastné skripty (konzola prehliadača bez CSP chýb).
        Poznámka: `.htaccess` je zatiaľ overený len testom textu (`src/core/htaccess.test.ts`), nie na skutočnom Apache; brána fázy 1 sa nezatvára, kým sa to nepotvrdí na hostingu.
- [ ] **Prototyp IMAP/SMTP (posledný krok fázy 1, nezdržuje bránu):** potrebná testovacia schránka na WebSupport. Edge Function `email-check` v samostatnej vetve `proto-email-check`, vráti len „spojenie OK / chyba“, údaje cez `supabase secrets`. Riziko na overenie: Edge Functions blokujú odchádzajúce porty 25 a 587, preto sa SMTP testuje na 465. Výsledok sem zapísať. **Stav: otvorené – vlastník zatiaľ nemá testovaciu schránku; fáza 1 sa tým neblokuje.**

## Technický dlh a neskôr

- [ ] CSP: nahradiť `'unsafe-inline'` pre skripty hashmi generovanými po builde (fáza 8).
- [ ] Logo a znak AV: nahradiť zástupné SVG v `public/brand/` súbormi od vlastníka.
- [ ] Farby `success`/`warning`/`danger` a neutrály: overiť kontrast (WCAG AA) vo fáze 2.
- [ ] Prepínač divízie (Všetko / AVENG / Agentúra) v hornej lište – `DESIGN_SYSTEM.md` §5 (po zavedení dát, fáza 3+).
- [ ] FK `companies.logo_document_id` → `documents` (pridá migrácia s tabuľkou `documents`).
- [ ] Politiky pre role `manager`, `accountant`, `external` (s modulmi, ktoré ich potrebujú).
- [ ] Trigger `lock_issued` a `status_transitions` naplniť podľa `BUSINESS_PROCESSES.md` kap. 4 (s prvými dokladmi).
- [ ] Supabase klient v `src/core/supabase` a typy z `db:types` (fáza 2, s prihlásením).
- [ ] Pred ostrými dátami: samostatný projekt Pro, zálohy, nezávislá bezpečnostná revízia (fáza 8).
