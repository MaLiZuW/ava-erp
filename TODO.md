# TODO.md

## Fáza 3 – čaká na vlastníka (brána)

Podľa D22: na dev reálne firmy (verejné údaje z OR), katalóg, sadzby, zdroje a texty o firme; osobné kontakty až na Pro.

- [ ] Zákazníci a dodávatelia – reálne firmy (názov, IČO, adresa), len všeobecné firemné kontakty.
- [ ] Katalóg: položky, balíčky (napr. sezónne), jednotky podľa potreby.
- [ ] Roly a hodinové sadzby (O5) – kalkulačná aj fakturovaná sadzba s platnosťou.
- [ ] Technika a vybavenie (obstarávacia cena, životnosť v hodinách, prevádzka/h).
- [ ] Knižnica obsahu: „O firme“, „Prečo my“, „Ako pracujeme“, „Kontakt“ + popisy služieb (ENG, EVENT, PROMO, SEASON), prípadne obrázky (bod brány).
- [ ] Nastavenia → Reporting: réžia, **pásma dane z príjmov overené s účtovníkom**, kapacity, ciele KPI (môžu prísť aj neskôr – dashboard ich využije vo fáze 7).

## Fáza 4 – na začiatku (pred generátorom CP)

**Prílohy podľa D23** (`docs/DECISIONS.md`):

- [ ] Migrácia: `documents.storage_provider` (predvolene `supabase`), konfigurácia kategórií príloh v DB (kód, názov, povolené MIME typy, max. veľkosť) – foto, technický list, certifikát, zmluva, výkres, iné; povolené PNG, JPEG, WebP, PDF, DOCX, XLSX; zákaz SVG, HTML a spustiteľných súborov aj v DB.
- [ ] Jeden adaptér súborov (rozšírenie `src/core/documents.ts`): nahratie, podpísané URL, mazanie – všetok prístup k súborom len cez neho.
- [ ] Dlaždica „Prílohy“ (jedna pre všetky moduly): položka katalógu (+ hlavná fotka pre CP a prezentáciu, galéria), zákazník, dodávateľ, technika a vybavenie; kontakty bez príloh (D22).
- [ ] Zmenšenie fotiek v prehliadači (max 2000 px, WebP); nahrávanie myšou, Ctrl+V, na mobile fotoaparát.
- [ ] pgTAP, Vitest, e2e; rozšírenie bucketu (typy, limity) v súlade s konfiguráciou.

**Zdroje podľa D24** (analýza kap. 7):

- [ ] Z labor riadkov prijatej CP vznikajú `resource_requirements` (DATABASE_SCHEMA §19).
- [ ] Pri CP orientačná kontrola kapacity v dotknutých týždňoch.

## Fáza 5a – projekty a zdroje (D24)

- [ ] Implementácia `DATABASE_SCHEMA.md` §19: register zdrojov (`resource_kinds`, `bookable_resources`), kalendáre (týždenný vzor, výnimky, SK sviatky), šablóny so spätným plánovaním, priradenia (`task_assignments` namiesto `assignee_*`), rezervácie techniky bez prekrytia, Gantt s baseline, výkaz hodín za deň, heatmapa vyťaženia, scenár dňa eventu + PDF, iCal. Podrobne v `docs/steps/STEP-03-az-08-prehlad.md` (STEP-05a) a v analýze.

## Fáza 2 – čaká na vlastníka (brána)

- [x] `SUPABASE_SECRET_KEY` v `.env.local`; `npm run db:test:api` – aal1 token = žiadne dáta (bod brány splnený 27/11/2026); Playwright 8/8.
- [x] Verejná registrácia vypnutá; `db:test:api` ALL PASSED 50/50 (27/11/2026).
- [ ] Skontrolovať nastavenia Supabase Auth podľa kontrolného zoznamu (`DEPLOYMENT.md`, časť A, bod 2) – registrácia, anonymné prihlásenie a nepoužívaní provideri vypnutí, bezpečná zmena e-mailu, min. heslo 12, JWT 3600 s, TOTP zapnuté, Redirect URLs.
- [x] Edge Function `admin-mfa-reset` nasadená; `db:test:api` – 5/5 kontrol funkcie (27/11/2026).
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
- [ ] Prepínač divízie (Všetko / AVENG / Agentúra) v hornej lište – `DESIGN_SYSTEM.md` §5; presunuté do fázy 4 (zmysel má až s dopytmi a zákazkami).
- [ ] GDPR: informačná povinnosť ku kontaktom zákazníkov a dodávateľov (presné znenie, doba uchovania, práva dotknutých osôb) – fáza 8; vo formulári kontaktu je zatiaľ krátky text (D22).
- [ ] História zmien kusovníka a jednotiek nie je viazaná na konkrétny záznam (tabuľky nemajú stĺpec `id`); v Katalógu sa zobrazuje história celej časti. Ak to bude prekážať, doplniť `id` alebo rozšíriť `log_change`.
- [ ] **Po zlúčení fázy 3:** samostatný malý PR – `.gitattributes` (`* text=auto eol=lf`) a jednorazové preformátovanie (Prettier hlási ~20 starších súborov kvôli koncom riadkov CRLF/LF po `core.autocrlf`). Teraz sa nič neformátuje.
- [ ] Politiky pre role `manager`, `accountant`, `external` (s modulmi, ktoré ich potrebujú).
- [ ] Trigger `lock_issued` a `status_transitions` naplniť podľa `BUSINESS_PROCESSES.md` kap. 4 (s prvými dokladmi).
- [ ] Typy udalostí pre `notification_recipients.event_types` – až s notifikáciami (nevymýšľať vopred).
- [ ] Bucket `documents`: rozšíriť povolené typy (PDF, prílohy) a limity s modulmi, ktoré ich potrebujú.
- [ ] Na produkčnom projekte Pro: serverový limit nečinnosti relácie (Auth → Sessions) a overenie, či reset 2FA ukončí relácie cieľa.
- [ ] Pred ostrými dátami: samostatný projekt Pro, zálohy, nezávislá bezpečnostná revízia (fáza 8).

## Hotové vo fáze 3

- [x] Ľavé menu sa posúva, Nastavenia pripnuté dole; TOTP kód s medzerou.
- [x] Zákazníci, dodávatelia, kontakty, stroje (skryté), katalóg, kusovník, jednotky, roly a sadzby, zdroje.
- [x] Knižnica obsahu, réžia, dane z príjmov (bez hodnôt), kapacity, ciele KPI.
- [x] D22 zapísané v `docs/DECISIONS.md`.

## Hotové vo fáze 2

- [x] Supabase klient v `src/core/supabase` a typy z `db:types`.
- [x] FK `companies.logo_document_id` → `documents`.
- [x] Farby `success`/`warning`/`danger` a neutrály – kontrast WCAG AA overený testom.
