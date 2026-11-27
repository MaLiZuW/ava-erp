# STEP-03 až STEP-08 – prehľad ďalších fáz

Podrobné zadanie každej fázy sa pripraví až po bráne predchádzajúcej fázy. Každá fáza: vetva `phase-XX-*`, plán na schválenie, testy, report.

## STEP-03 – Kmeňové dáta a knižnica obsahu
- Zákazníci + kontakty, dodávatelia + kontakty (upozornenie pri zahraničnom dodávateľovi), jednotky, katalóg, kusovník balíčkov, roly a sadzby, technika a vybavenie, karta stroja (skrytá).
- Knižnica obsahu pre dokumenty: texty o firme, popisy služieb podľa divízie a typu zákazky, obrázky (`content_blocks`).
- Nastavenia pre reporting: réžia (opakovaná s verziami + jednorazová), sadzby dane z príjmov (`income_tax_brackets` – hodnoty overené s účtovníkom), kapacity (kalendár D24 – blok H; `capacity_plans` zrušená), ciele KPI (`kpi_targets`).
- Doplnené pripomienkami vlastníka (bloky G–L): periodické overovanie dát (Na overenie), prílohy podľa D23 s hlavnou fotkou položky, nový a duplikovaný balíček, import katalógu XLSX/CSV s menami a DPH (D26), EAN/GTIN, Nastavenia → AI (D25), režim nastavení.
- Brána: reálne kmeňové dáta a texty o firme zadané vlastníkom.

## STEP-03.5 – AI asistent katalógu (D25, D26) – **neimplementované, len zaradenie**
Podklad: `docs/analyzy/ANALYZA-AI-IMPORT-KATALOGU.md`. Predpoklad: Nastavenia → AI (blok L) s kľúčom, modelom a cenou.
- Pri novej položke vložiť **screenshot alebo PDF** (web / katalóg dodávateľa) → AI vráti **štruktúrovaný návrh** (názov, kód dodávateľa, EAN, cena, mena, s/bez DPH, jednotka, balenie, min. odber, popis, parametre) so **spoľahlivosťou ku každému poľu**; polia so štítkom „AI“, nízka spoľahlivosť žltá, nenájdené prázdne.
- Párovanie cez spoločné `match_catalog_item` (kód dodávateľa → EAN → názov); výsledok nová / existuje (aktualizovať cenu?) / viac kandidátov.
- Balíček: zo zloženia **návrh kusovníka** (spárované + návrhy nových položiek), pravidlo jednej úrovne ostáva.
- Zdrojový obrázok/PDF sa uloží ako príloha položky (kategória „zdroj údajov“); audit „vytvorené s pomocou AI“ a kto potvrdil; príznak „obrázok/popis od dodávateľa – overiť použitie“.
- Import **PDF cenníkov** (text tabuľky, AI len pri nejasnej štruktúre).
- Človek vždy potvrdzuje; výpadok AI ani vyčerpaný rozpočet neblokujú ručné zadanie (`useAiAvailability`).
- Brána: na prvých reálnych podkladoch dodávateľov overená presnosť; spotreba v rozpočte.

## STEP-04 – Dopyt → kalkulácia → CP → objednávka → zákazka + prvé dokumenty
- Dopyty, dopyty na dodávateľov, kalkulačné jadro, verzie CP, schvaľovanie, `accept_quote_version()`.
- **Generátor dokumentov** (prototyp technológie PDF hneď na začiatku fázy): cenová ponuka, **firemná prezentácia k CP**, potvrdenie objednávky, dopyt na dodávateľa. Uzamknuté PDF + hash.
- **Prílohy (D23)** sú hotové vo F3 (blok J) – nové moduly (dopyt, CP, zákazka) použijú `AttachmentsTile` a doplnia sa do `private.check_attachment_file`.
- **Zdroje (D24):** z labor riadkov prijatej CP vznikajú `resource_requirements` (DATABASE_SCHEMA §19); pri CP orientačná kontrola kapacity v dotknutých týždňoch.
- **O2C tabuľa (D28):** komponent **`BoardView`** (`src/ui`, dnd-kit) a Prehľad s tabuľou pod KPI dlaždicami – stĺpce **Dopyty, Cenové ponuky, Zákazky** (stavy zákazky); presun vždy cez `transition()` s povolenými stavmi, **prijatie CP ťahaním s potvrdením v okne**, „Presunúť do…“ a klávesnica.
- **E-mailové schránky (D27, bez AI):** Nastavenia → E-mailové schránky (IMAP server, používateľ, heslo len na zápis do Vault, interval, priečinky); **prototyp IMAP načítania z Edge Function hneď na začiatku fázy** (testovacia schránka test@av-agency.sk); uloženie správ a príloh cez adaptér úložiska (D23); **deterministické párovanie** (odosielateľ → kontakt/zákazník/dodávateľ, čísla dokladov v predmete/texte, vlákno); „Priradiť k…“, „Vytvoriť DOP z e-mailu“; dlaždica E-maily na doklade. **Len čítanie, systém neodosiela.**
- Do `private.catalog_item_in_use` doplniť použitie položky v CP (blokuje „Vrátiť dávku“ importu).
- Brána: reálna CP s prezentáciou od dopytu po zákazku; výpočet sedí s ručnou kalkuláciou; e-mail z testovacej schránky priradený k dopytu.

## STEP-04.5 – AI triáž e-mailov (D27) – po F4
Podklad: `docs/analyzy/ANALYZA-AI-EMAIL-TRIAZ.md` kap. 3 a 4.
- **Kategórie a postup** podľa tabuľky v kap. 3 (nový dopyt, doplnenie, prijatie / odmietnutie CP, schválenie vizuálu, dohoda o termíne, odpoveď a potvrdenie dodávateľa, dodací list / faktúra, upomienka, spam, iné) – extrakcia údajov ako štruktúrovaný JSON so spoľahlivosťou.
- **AI navrhuje, človek potvrdzuje:** automaticky len pripojenie e-mailu k záznamu, štítok kategórie, označenie spamu; zmena stavu dokladu a prijatie CP vždy človek. Koncept odpovede na skopírovanie, bez odosielania.
- Prah spoľahlivosti (konfigurácia), deterministické párovanie má prednosť; opravy kategórie ako spätná väzba; všetko v Histórii zmien.
- Obrazovky: E-maily → Doručená pošta systému (Neroztriedené, Na potvrdenie), detail s „Navrhovanou akciou“, dashboard „E-maily na potvrdenie“, zapnutie AI triáže pre schránku.
- GDPR: posielať len predmet a text (bez príloh, ak nie sú potrebné), skrátiť citované vlákno; reálne schránky až na Pro (D22); spotreba v rozpočte Nastavení → AI (`ai_email_triage`).
- Brána: na testovacej schránke správne zaradené kategórie a žiadna akcia bez potvrdenia.

## STEP-05a – Projekty a zdroje (D24)
Podklad: `docs/analyzy/ANALYZA-RIADENIE-PROJEKTOV-A-ZDROJOV.md`, DATABASE_SCHEMA §19.
- Register zdrojov a kalendáre (týždenný vzor + výnimky + SK sviatky) sú **hotové vo F3 (blok H)**; vo F5a sa aktivujú typy dodávateľ a technika a doplnia priradenia.
- Šablóny úloh podľa typu zákazky so spätným plánovaním od kotvy (štart, dátum eventu, termín dodania).
- Priradenia úloha × zdroj (predbežné z CP / pevné zo zákazky), rezervácie techniky bez prekrytia.
- Gantt s časovým baseline, výkaz hodín za deň (bez stopiek), heatmapa vyťaženia zdroj × týždeň, „Môj týždeň“, kalendár zdroja.
- **Kanban úloh zákazky** na `BoardView` (D28).
- Scenár dňa eventu (run-of-show) + PDF pre tím a dodávateľov; iCal export.
- Brána [NÁVRH]: zákazka EVENT naplánovaná zo šablóny, so scenárom dňa a bez konfliktu techniky; vyťaženie konateľov zodpovedá ich kalendáru.

## STEP-05b – Vizuál, nákup, dodanie, nezhody
- Schválenie vizuálu (PDF žiadosť), OD, príjemky, doklady dodania (dodací list, preberací protokol), plán vs. skutočnosť.
- E-mail: **namiesto samostatného e-mailového modulu** sa použije F4 (schránky, párovanie) a F4.5 (AI triáž); vo F5b sa rozšíria kategórie a párovanie o vizuál, dopyty a objednávky dodávateľom.
- **O2C tabuľa (D28):** stĺpec Zákazky rozšírený o realizáciu, nákup a dodanie; nákup na `BoardView`.
- Termíny OD dodávateľa (`confirmed_date`, `delivered_date`) – zobrazenie v Gantte z F5a.
- Nezhody a reklamácie, ručné hodnotenie dodávateľa po príjme.
- Brána: zákazka PROMO od vizuálu po potvrdené dodanie s PDF dokladmi.

## STEP-06 – Fakturácia
- Faktúry bez DPH, zálohové, dobropisy, upomienky (PDF); úhrady; prijaté faktúry (XML/PDF import); export pre účtovníka; sledovanie limitu registrácie DPH.
- **O2C tabuľa (D28): stĺpec Fakturácia** (vystavené, po splatnosti, uhradené; zostatok); **vystavenie faktúry ťahaním len s potvrdením v okne**; uhradená = formulár platby.
- Ručné hodnotenie zákazníka po uzavretí zákazky.
- Brána: prijatá e-faktúra načítaná do zákazky; účtovník potvrdil export.

## STEP-07 – Reporting, KPI, hodnotenie partnerov, propagácia
- Dashboard podľa DESIGN_SYSTEM.md 6.1: Spolu / Agentúra / AVENG, finančné ukazovatele a grafy (BUSINESS_PROCESSES.md kap. 12), tlač a PDF/CSV/XLSX export; súčty a filtre O2C tabule napojené na reporting (D28).
- Karty zákazníkov a dodávateľov s KPI a skóre A/B/C (kap. 13), procesné KPI so semaformi a drill-downom (kap. 14).
- Zdroje (D24): kapacita vs. pipeline (predbežné rezervácie z CP), utilizácia v KPI (z kalendárov a výkazov), prognóza do konca (EAC), KPI dodržania termínov dodávateľov.
- Propagačné dokumenty: všeobecná firemná prezentácia, katalóg služieb, referenčný list (len so súhlasom zákazníka), súhrn zákazky.
- Brána: vlastník overí čísla dashboardu voči ručnému prepočtu za 1 mesiac; vytlačí report.

## STEP-08 – Archív, legislatíva, prevádzka
- Archív s hashmi, export mimo Supabase, legislatívny watchlist + Slov-Lex, **odosielanie notifikácií** (overenie dát, rozpočet AI 50/90 %, ďalšie podľa BUSINESS_PROCESSES kap. 7), denné zálohy a test obnovy, prechod na Supabase Pro (reálne e-mailové schránky, `ai-gateway`), sledovanie úložiska a antivírus (D23), GDPR informácia o spracúvaní (aj AI a e-mailov), nezávislá bezpečnostná revízia.
- Brána: obnova zo zálohy odskúšaná; revízia bez nálezov; ostré spustenie.
