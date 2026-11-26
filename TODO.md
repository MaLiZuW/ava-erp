# TODO.md

## Rozpracované vo fáze 1 (čaká na vlastníka)

- [x] Supabase projekt `ava-erp-dev` založený, `.env.local` hotový (session pooler).
- [x] `db:push`, `db:seed`, `db:types`, `db:test`, `db:test:api` na dev projekte – zelené (26. 11. 2026).
- [ ] Súhlas s postavením DB od nuly na dev projekte (brána „databáza sa dá postaviť od nuly“).
- [ ] Nahrať `out/` na `https://app.av-agency.sk` cez WinSCP (`DEPLOYMENT.md`, časť D, E).
- [ ] O3: overiť HTTPS certifikát `app.av-agency.sk`.
- [ ] **Prototyp IMAP/SMTP (posledný krok fázy 1, nezdržuje bránu):** potrebná testovacia schránka na WebSupport. Edge Function `email-check` v samostatnej vetve `proto-email-check`, vráti len „spojenie OK / chyba“, údaje cez `supabase secrets`. Riziko na overenie: Edge Functions blokujú odchádzajúce porty 25 a 587, preto sa SMTP testuje na 465. Výsledok sem zapísať. **Stav: otvorené – čaká na schránku.**

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
