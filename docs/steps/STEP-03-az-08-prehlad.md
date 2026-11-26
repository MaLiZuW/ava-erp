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
- Brána: reálna CP s prezentáciou od dopytu po zákazku; výpočet sedí s ručnou kalkuláciou.

## STEP-05 – Vizuál, nákup, dodanie, projekty, e-mail
- Schválenie vizuálu (PDF žiadosť), OD, príjemky, doklady dodania (dodací list, preberací protokol), Gantt, hodiny, plán vs. skutočnosť, e-mailový modul.
- Nezhody a reklamácie, ručné hodnotenie dodávateľa po príjme.
- Brána: zákazka PROMO od vizuálu po potvrdené dodanie s PDF dokladmi.

## STEP-06 – Fakturácia
- Faktúry bez DPH, zálohové, dobropisy, upomienky (PDF); úhrady; prijaté faktúry (XML/PDF import); export pre účtovníka; sledovanie limitu registrácie DPH.
- Ručné hodnotenie zákazníka po uzavretí zákazky.
- Brána: prijatá e-faktúra načítaná do zákazky; účtovník potvrdil export.

## STEP-07 – Reporting, KPI, hodnotenie partnerov, propagácia
- Dashboard podľa DESIGN_SYSTEM.md 6.1: Spolu / Agentúra / AVENG, finančné ukazovatele a grafy (BUSINESS_PROCESSES.md kap. 12), tlač a PDF/CSV/XLSX export.
- Karty zákazníkov a dodávateľov s KPI a skóre A/B/C (kap. 13), procesné KPI so semaformi a drill-downom (kap. 14).
- Propagačné dokumenty: všeobecná firemná prezentácia, katalóg služieb, referenčný list (len so súhlasom zákazníka), súhrn zákazky.
- Brána: vlastník overí čísla dashboardu voči ručnému prepočtu za 1 mesiac; vytlačí report.

## STEP-08 – Archív, legislatíva, prevádzka
- Archív s hashmi, export mimo Supabase, legislatívny watchlist + Slov-Lex, notifikácie, denné zálohy a test obnovy, prechod na Supabase Pro, nezávislá bezpečnostná revízia.
- Brána: obnova zo zálohy odskúšaná; revízia bez nálezov; ostré spustenie.
