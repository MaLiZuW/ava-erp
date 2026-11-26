# DECISIONS.md – rozhodnutia vlastníka

Zdroj: analytická fáza 26. 11. 2026 (dokument „AVENG Q2C/ERP systém – hĺbková analýza a plán implementácie“).
Zmenu rozhodnutia zapisuje vlastník; Claude Code ich iba číta.

| # | Téma | Rozhodnutie | Dátum |
|---|---|---|---|
| D1 | Subjekt | AV-agency, s.r.o.; AVENG je jej súčasťou (divízia inžinierskych služieb) | 26. 11. 2026 |
| D2 | DPH | firma **nie je platiteľ DPH** – doklady bez DPH | 26. 11. 2026 |
| D3 | Názov systému | Add Value Agency | 26. 11. 2026 |
| D4 | Branding | logo Add Value Agency + znak AV; farby biela, modrá #00B0EF, čierna #231E1F, tmavomodrá #00384C (vybraná podľa WCAG) | 26. 11. 2026 |
| D5 | Používatelia | dvaja konatelia, administrátori, povinné 2FA | 26. 11. 2026 |
| D6 | Zisk | na každej položke voliteľne marža % alebo prirážka % | 26. 11. 2026 |
| D7 | Typy zákaziek | ENG (inžinierske), EVENT (reklama/eventy), PROMO (reklamné predmety), SEASON (sezónne balíčky); SERVICE (diely a servis CNC) pripravený, skrytý | 26. 11. 2026 |
| D8 | Schválenie vizuálu | povinné pri reklamných predmetoch pred objednaním u dodávateľa | 26. 11. 2026 |
| D9 | Účtovníctvo | externý účtovník; systém nie je účtovný softvér, robí export | 26. 11. 2026 |
| D10 | Digitálny poštár | zabezpečuje účtovník; napojenie API neskôr; dovtedy import XML/PDF prijatých e-faktúr; proces sa kvôli tomu nezastavuje | 26. 11. 2026 |
| D11 | E-mail | prepojenie s mailovou schránkou, práca s e-mailmi v systéme | 26. 11. 2026 |
| D12 | Sklad, sadzby, číslovanie, zdroje | zatiaľ neexistujú – riešiť od nuly; MVP bez skladu | 26. 11. 2026 |
| D13 | Hosting | WebSupport Smart (zdieľaný Apache); aplikácia na app.av-agency.sk (koreň /av-agency.sk/sub/app) | 26. 11. 2026 |
| D14 | Databáza | Supabase; Free na vývoj, Pro pred ostrými dátami, neskôr možnosť self-hosted na domácom serveri | z prm.txt |
| D16 | Dashboard | rozdelenie Agentúra / AVENG + súhrn spolu; náklady vs. zisk, dane (odhad dane z príjmov), marža, tržby podľa zákazníkov, všetky podstatné ukazovatele a grafy; tlač | 26. 11. 2026 |
| D17 | Dokumenty | systém sám pripraví firemnú prezentáciu k CP (PDF), CP, dodací list, faktúru a ďalšie dokumenty na tlač aj propagáciu | 26. 11. 2026 |
| D18 | Hodnotenie partnerov | sledovanie a hodnotenie zákazníkov a dodávateľov, KPI k nim aj k vlastným procesom | 26. 11. 2026 |
| D19 | Dizajn a jadro | moderný čistý dizajn, modulárna bento mriežka; jednoduché jednotné jadro dokladov | 26. 11. 2026 |
| D20 | Schválenie návrhu | BUSINESS_PROCESSES.md, DATABASE_SCHEMA.md, ARCHITECTURE_CORE.md, DESIGN_SYSTEM.md vrátane všetkých [NÁVRH] bodov (kroky podľa typu zákazky, schválenie CP aj autorom, číslovanie PREFIX-RRRR-NNNN, VS = číslo faktúry bez pomlčiek, vzhľad podľa návrhu obrazoviek) | 26. 11. 2026 |
| D21 | Supabase pri vývoji | najprv online Supabase Free (cloud), bez lokálneho Dockeru; len testovacie dáta; ostré dáta až na Pro | 26. 11. 2026 |
| D15 | Postup | najprv analýza a návrh, implementácia po fázach so schválením | z prm.txt |
| D22 | Osobné údaje na dev projekte (brána fázy 3) | na dev projekte (Free) sa zadávajú reálne firmy – obchodné meno, IČO, adresa (verejné údaje z OR) –, katalóg, sadzby, zdroje a texty o firme; **osobné kontakty** (mená, osobné e-maily a telefóny konkrétnych ľudí) sa na dev **nezadávajú**, len všeobecné firemné kontakty (napr. info@); osobné kontakty až na projekte Pro. Pri kontaktoch je vo formulári krátky text o spracúvaní osobných údajov na účely plnenia zmluvy (detail GDPR vo fáze 8) | 26. 11. 2026 |
| D23 | Prílohy (implementácia na začiatku fázy 4, pred generátorom CP) | **jedna dlaždica „Prílohy“** nad tabuľkou `documents` (`entity_table` + `entity_id`) pre všetky moduly; položka katalógu má navyše **hlavnú fotku** pre CP a prezentáciu + **galériu**. Prvé použitie: položka katalógu, zákazník, dodávateľ, technika (`resources`); kontakty bez príloh (D22). Kategórie: foto, technický list, certifikát, zmluva, výkres, iné. **Povolené typy a limity podľa kategórie sú konfigurácia v DB**, nie natvrdo v kóde (neskôr napr. DWG/DXF/STEP bez programovania); teraz PNG, JPEG, WebP, PDF, DOCX, XLSX – **nikdy SVG, HTML ani spustiteľné súbory**. Úložisko ostáva Supabase Storage, ale **vymeniteľné**: stĺpec `storage_provider` v `documents` a všetok prístup k súborom cez **jeden adaptér** (nahratie, podpísané URL, mazanie). Fotky sa zmenšia v prehliadači (max 2000 px, WebP); nahrávanie myšou, Ctrl+V, na mobile fotoaparát. Fáza 8: sledovanie obsadenia úložiska (Free 1 GB), antivírusová kontrola | 26. 11. 2026 |
| D24 | Riadenie projektov a zdrojov (podklad `docs/analyzy/ANALYZA-RIADENIE-PROJEKTOV-A-ZDROJOV.md`, schválená analýza) | (1) Externé osoby na hodiny **zatiaľ nie** – dodávatelia sú firmy s termínom; model je **rozšíriteľný**: typ zdroja je konfigurácia (`resource_kinds`), neskôr **externá osoba** alebo **AI agent / automatizovaná služba** bez zmeny jadra. (2) Výkaz: **hodiny za deň** k zákazke/úlohe, bez stopiek. (3) Dodávatelia **bez prístupu** do systému – dostávajú e-mail/PDF (OD, harmonogram, scenár eventu); rola `external` ostáva len pripravená. (4) Kapacita konateľov: **týždenný vzor** + **výnimky na konkrétne dni** (dovolenka, nedostupnosť, extra hodiny) + **SK sviatky automaticky**. (5) **Scenár dňa eventu** (run-of-show) je súčasť zákazky EVENT, s PDF pre tím a dodávateľov. (6) Fáza 5 sa delí na **F5a** (projekty a zdroje) a **F5b** (vizuál, nákup, dodanie, e-mail). V UI sa tabuľka `resources` volá „Technika a vybavenie“; „zdroj“ znamená človeka, dodávateľa aj techniku | 26. 11. 2026 |

## Otvorené

| # | Téma | Stav |
|---|---|---|
| O1 | Poskytovateľ digitálneho poštára a API | neskôr |
| O2 | Ktorá e-mailová schránka sa pripojí | pred fázou 4 |
| O3 | HTTPS certifikát app.av-agency.sk | overiť pred koncom fázy 1 |
| O4 | Registračné povinnosti DPH pri nákupe zo zahraničia (§ 7, § 7a) | overiť s účtovníkom |
| O5 | Hodnoty sadzieb rolí | zadá vlastník vo fáze 3 |
| O6 | Návrhy [NÁVRH] | schválené 26. 11. 2026 (D20) |
