# STEP-03 až STEP-08 – prehľad ďalších fáz

Podrobné zadanie každej fázy sa pripraví až po bráne predchádzajúcej fázy. Každá fáza: vetva `phase-XX-*`, plán na schválenie, testy, report.

## STEP-03 – Kmeňové dáta a knižnica obsahu
- Zákazníci + kontakty, dodávatelia + kontakty (upozornenie pri zahraničnom dodávateľovi), jednotky, katalóg, kusovník balíčkov, roly a sadzby, zdroje, karta stroja (skrytá).
- Knižnica obsahu pre dokumenty: texty o firme, popisy služieb podľa divízie a typu zákazky, obrázky (`content_blocks`).
- Nastavenia pre reporting: réžia (`overhead_costs`), sadzby dane z príjmov (`income_tax_brackets` – hodnoty overené s účtovníkom), kapacity (`capacity_plans`), ciele KPI (`kpi_targets`).
- Brána: reálne kmeňové dáta a texty o firme zadané vlastníkom.

## STEP-04 – Dopyt → kalkulácia → CP → objednávka → zákazka + prvé dokumenty
- Dopyty, dopyty na dodávateľov, kalkulačné jadro, verzie CP, schvaľovanie, `accept_quote_version()`.
- **Generátor dokumentov** (prototyp technológie PDF hneď na začiatku fázy): cenová ponuka, **firemná prezentácia k CP**, potvrdenie objednávky, dopyt na dodávateľa. Uzamknuté PDF + hash.
- Na začiatku fázy: **prílohy podľa D23** (jedna dlaždica „Prílohy“, kategórie a typy ako konfigurácia v DB, adaptér úložiska) – pred generátorom CP.
- **Zdroje (D24):** z labor riadkov prijatej CP vznikajú `resource_requirements` (DATABASE_SCHEMA §19); pri CP orientačná kontrola kapacity v dotknutých týždňoch.
- Brána: reálna CP s prezentáciou od dopytu po zákazku; výpočet sedí s ručnou kalkuláciou.

## STEP-05a – Projekty a zdroje (D24)
Podklad: `docs/analyzy/ANALYZA-RIADENIE-PROJEKTOV-A-ZDROJOV.md`, DATABASE_SCHEMA §19.
- Register zdrojov a kalendáre (týždenný vzor + výnimky + SK sviatky) sú **hotové vo F3 (blok H)**; vo F5a sa aktivujú typy dodávateľ a technika a doplnia priradenia.
- Šablóny úloh podľa typu zákazky so spätným plánovaním od kotvy (štart, dátum eventu, termín dodania).
- Priradenia úloha × zdroj (predbežné z CP / pevné zo zákazky), rezervácie techniky bez prekrytia.
- Gantt s časovým baseline, výkaz hodín za deň (bez stopiek), heatmapa vyťaženia zdroj × týždeň, „Môj týždeň“, kalendár zdroja.
- Scenár dňa eventu (run-of-show) + PDF pre tím a dodávateľov; iCal export.
- Brána [NÁVRH]: zákazka EVENT naplánovaná zo šablóny, so scenárom dňa a bez konfliktu techniky; vyťaženie konateľov zodpovedá ich kalendáru.

## STEP-05b – Vizuál, nákup, dodanie, e-mail, nezhody
- Schválenie vizuálu (PDF žiadosť), OD, príjemky, doklady dodania (dodací list, preberací protokol), plán vs. skutočnosť, e-mailový modul.
- Termíny OD dodávateľa (`confirmed_date`, `delivered_date`) – zobrazenie v Gantte z F5a.
- Nezhody a reklamácie, ručné hodnotenie dodávateľa po príjme.
- Brána: zákazka PROMO od vizuálu po potvrdené dodanie s PDF dokladmi.

## STEP-06 – Fakturácia
- Faktúry bez DPH, zálohové, dobropisy, upomienky (PDF); úhrady; prijaté faktúry (XML/PDF import); export pre účtovníka; sledovanie limitu registrácie DPH.
- Ručné hodnotenie zákazníka po uzavretí zákazky.
- Brána: prijatá e-faktúra načítaná do zákazky; účtovník potvrdil export.

## STEP-07 – Reporting, KPI, hodnotenie partnerov, propagácia
- Dashboard podľa DESIGN_SYSTEM.md 6.1: Spolu / Agentúra / AVENG, finančné ukazovatele a grafy (BUSINESS_PROCESSES.md kap. 12), tlač a PDF/CSV/XLSX export.
- Karty zákazníkov a dodávateľov s KPI a skóre A/B/C (kap. 13), procesné KPI so semaformi a drill-downom (kap. 14).
- Zdroje (D24): kapacita vs. pipeline (predbežné rezervácie z CP), utilizácia v KPI (z kalendárov a výkazov), prognóza do konca (EAC), KPI dodržania termínov dodávateľov.
- Propagačné dokumenty: všeobecná firemná prezentácia, katalóg služieb, referenčný list (len so súhlasom zákazníka), súhrn zákazky.
- Brána: vlastník overí čísla dashboardu voči ručnému prepočtu za 1 mesiac; vytlačí report.

## STEP-08 – Archív, legislatíva, prevádzka
- Archív s hashmi, export mimo Supabase, legislatívny watchlist + Slov-Lex, notifikácie, denné zálohy a test obnovy, prechod na Supabase Pro, nezávislá bezpečnostná revízia.
- Brána: obnova zo zálohy odskúšaná; revízia bez nálezov; ostré spustenie.
