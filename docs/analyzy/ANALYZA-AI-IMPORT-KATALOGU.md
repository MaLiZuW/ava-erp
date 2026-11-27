# Analýza: AI vyplnenie položky zo screenshotu a import katalógu (XLSX/CSV/PDF)

Stav: **SCHVÁLENÉ vlastníkom 26. 11. 2026** (D25, D26) · import vo F3 (blok K), Nastavenia → AI vo F3 (blok L), AI asistent katalógu vo F3.5

## 1. Požiadavka

1. Pri novej položke vložiť screenshot (web/katalóg dodávateľa) → systém prečíta obrázok, vyplní nájdené údaje, spáruje s existujúcou položkou/dodávateľom; vlastník doplní maržu a chýbajúce údaje a uloží.
2. To isté pre balíčky (zloženie balíčka → komponenty).
3. Hromadné naplnenie katalógu importom XLSX, CSV alebo PDF (cenníky dodávateľov).

## 2. Technológie

| Úloha | Technológia | Spoľahlivosť |
|---|---|---|
| XLSX / CSV | klasický import: načítanie, mapovanie stĺpcov, validácia | presná, deterministická |
| Screenshot, PDF bez štruktúry | AI s videním → štruktúrovaný návrh polí | veľmi dobrá, nie 100 % → vždy kontrola človekom |
| PDF s textovou tabuľkou | extrakcia textu, AI len ak štruktúra nie je jasná | dobrá |

## 3. Best practices (intelligent document processing)

1. Človek vždy potvrdzuje – AI vytvorí len návrh, nikdy neuloží sama.
2. Štruktúrovaný výstup podľa schémy (názov, kód dodávateľa, EAN, cena, mena, s/bez DPH, jednotka, balenie, min. odber, popis, parametre).
3. Ku každému poľu spoľahlivosť – AI polia so štítkom „AI“, nízka spoľahlivosť žltá, nenájdené prázdne.
4. Párovanie v databáze: dodávateľ + kód dodávateľa → EAN → podobnosť názvu (trigram). Výsledok: nová / existuje (aktualizovať cenu?) / viac kandidátov.
5. Ceny a mena: s/bez DPH a mena; prepočet na EUR bez DPH len s potvrdením. Pri nejasnosti pole prázdne.
6. Zdrojový obrázok/PDF sa uloží ako príloha položky (kategória „zdroj údajov“) – dôkaz pôvodu a dátumu ceny.
7. Audit: „vytvorené s pomocou AI“, kto potvrdil.
8. Bezpečnosť: kľúč len na serveri (Edge Function + Vault), limit volaní a rozpočet, feature flag `ai_catalog_assist`, obsah obrázka = dáta, nie pokyny (prompt injection).
9. Import XLSX/CSV: súbor → mapovanie stĺpcov (šablóna dodávateľa) → náhľad chýb → skúšobný beh → potvrdenie → dávka s možnosťou vrátenia.
10. Nová nákupná cena z cenníka = posledná známa cena s dátumom a zdrojom; nemení vystavené CP.

## 4. Balíčky

Screenshot/PDF zloženia → AI vráti komponenty (názov, množstvo, jednotka, cena) → párovanie s katalógom → „Návrh kusovníka“ (spárované + návrhy nových položiek) → po potvrdení balíček + chýbajúce položky. Pravidlo jednej úrovne ostáva.

## 5. Rozhodnutia vlastníka (26. 11. 2026)

| # | Otázka | Rozhodnutie |
|---|---|---|
| 1 | AI poskytovateľ a rozpočet | **Gemini API** (vlastník má), za adaptérom (neskôr aj iný poskytovateľ). Rozpočet **max 5 € jednorazovo**, potom sa uvidí. Nastavenia AI spoločné pre celý systém v **Nastaveniach → AI**. |
| 2 | Vzorové podklady dodávateľov | zatiaľ nie sú → syntetické testovacie súbory; prototyp AI vo F3.5 na prvých reálnych podkladoch |
| 3 | Meny | **EUR, CZK, PLN**; s/bez DPH sa môže líšiť → prepínač, sadzbu DPH zadá používateľ |
| 4 | EAN / kód dodávateľa | môže, nemusí byť → oba nepovinné, párovanie aj podľa názvu |
| 5 | Zaradenie | **import XLSX/CSV vo F3 (blok K)**, **AI asistent ako F3.5** |

Poistka rozpočtu (3 vrstvy): Google Cloud rozpočet 5 € s upozorneniami 50/90/100 % (len upozorňuje), kvóta požiadaviek na deň (napr. 200), poistka v systéme (`ai_usage`, vypnutie AI pri 4,50 €). Ak AI Studio ponúkne predplatený kredit, nabiť 5 €.

Podmienky Gemini API: pre EHP platia pravidlá „Paid Services“ o použití dát aj pri bezplatnej kvóte; napriek tomu odporúčaná aktívna fakturácia s limitom.

## 6. Riziká a pravidlá

- Autorské práva: fotky a popisy dodávateľa – interne áno; do CP/prezentácie len so súhlasom dodávateľa alebo vlastné. Príznak „obrázok/popis od dodávateľa – overiť použitie“.
- Osobné údaje: nenahrávať; upozornenie pri nahratí.
- Chyby AI: cena, jednotka, balenie vždy zvýraznené na kontrolu.
- Výpadok API alebo vyčerpaný rozpočet nesmie blokovať ručné zadanie.

## 7. Zaradenie

| Časť | Kde |
|---|---|
| Import XLSX/CSV, spoločné párovanie, meny a DPH pri nákupnej cene | F3 – blok K |
| Nastavenia → AI (adaptér, kľúč vo Vault, modely, flagy, ai_usage, poistka, prehľad spotreby) | F3 – blok L |
| AI vyplnenie zo screenshotu, PDF cenníky, návrh kusovníka | F3.5 – AI asistent katalógu |
