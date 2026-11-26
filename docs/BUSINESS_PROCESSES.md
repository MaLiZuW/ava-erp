# BUSINESS_PROCESSES.md – Add Value Agency (interný Q2C/ERP systém)

Verzia: 1.0 – schválené vlastníkom 26. 11. 2026
Subjekt: AV-agency, s.r.o. (neplatiteľ DPH) · divízie: **AVENG** (inžinierske služby) a **Agentúra** (reklama, eventy, predmety, sezónne balíčky)

Označenie:
- **[POTVRDENÉ]** – rozhodnutie vlastníka (26. 11. 2026)
- **[NÁVRH]** – odporúčanie, platí kým ho vlastník nezmení
- **[CHÝBA]** – informácia, ktorá zatiaľ nie je k dispozícii

---

## 1. Princípy

1. Každý obchodný prípad má jeden koreňový záznam **zákazka (ZAK)** vytvorený z prijatej objednávky. Všetky doklady po objednávke (nákup, dodanie, faktúra, hodiny, e-maily, dokumenty) sú na ňu naviazané. Pred objednávkou je koreňom **dopyt (DOP)**. [NÁVRH]
2. Stav dokladu mení len povolený prechod (tabuľky nižšie). Nepovolený prechod zablokuje databáza, nie iba obrazovka. [NÁVRH, z prm.txt]
3. Vystavený doklad (schválená verzia CP, potvrdenie objednávky, vystavený dodací list, vystavená faktúra) sa nikdy neprepisuje ani nemaže. Oprava = nová verzia alebo opravný doklad. [NÁVRH, z prm.txt]
4. Každá zmena stavu sa zapisuje do auditného logu (kto, kedy, z akého stavu, do akého, poznámka).
5. Dokumenty (PDF) sa generujú zo schválených údajov v databáze, nie z voľného textu.
6. Systém používajú dvaja konatelia s rolou administrátor a povinným 2FA. [POTVRDENÉ]

## 2. Typy zákaziek

| Kód | Typ | Divízia | Špecifiká procesu | Stav |
|---|---|---|---|---|
| `ENG` | Inžinierska služba | AVENG | projekt s cieľom, míľnikmi a hodinami; Gantt; fakturácia po míľnikoch alebo jednorazovo | [POTVRDENÉ typ] |
| `EVENT` | Reklamná / eventová služba | Agentúra | dátum a miesto podujatia; viac externých dodávateľov na jednu zákazku; preberací protokol | [POTVRDENÉ typ] |
| `PROMO` | Reklamné predmety | Agentúra | nákup tovaru + kooperácia (napr. potlač); **povinné schválenie vizuálu zákazníkom pred objednaním u dodávateľa** | [POTVRDENÉ] |
| `SEASON` | Sezónny balíček (napr. mikulášsky) | Agentúra | balíček = kusovník z viacerých položiek; prepočet nákupu na N kusov | [POTVRDENÉ typ] |
| `SERVICE` | Náhradné diely a servis strojov (CNC) | Agentúra | karta stroja zákazníka, identifikácia dielu, servisný protokol | [POTVRDENÉ: pripravené, **skryté** cez feature flag `service_cnc`] |

Tabuľka rozdielov krokov (✔ = krok sa používa, – = nepoužíva, ○ = voliteľný):

| Krok | ENG | EVENT | PROMO | SEASON | SERVICE |
|---|---|---|---|---|---|
| Dopyt | ✔ | ✔ | ✔ | ✔ | ✔ |
| Dopyt na dodávateľov | ○ | ✔ | ✔ | ✔ | ✔ |
| Kalkulácia + CP | ✔ | ✔ | ✔ | ✔ | ✔ |
| Objednávka → zákazka | ✔ | ✔ | ✔ | ✔ | ✔ |
| Schválenie vizuálu | – | ○ | ✔ povinné | ○ | – |
| Gantt / úlohy | ✔ | ✔ | ○ | ○ | ○ |
| Evidencia hodín | ✔ | ✔ | ○ | ○ | ✔ |
| Scenár dňa eventu (D24) | – | ✔ | – | – | – |
| Objednávka dodávateľovi | ○ | ✔ | ✔ | ✔ | ✔ |
| Príjem tovaru/služby | ○ | ✔ | ✔ | ✔ | ✔ |
| Dodací list | ○ | – | ✔ | ✔ | ✔ |
| Preberací protokol | ✔ | ✔ | ○ | ○ | – |
| Servisný protokol | – | – | – | – | ✔ |
| Faktúra | ✔ | ✔ | ✔ | ✔ | ✔ |

[NÁVRH – potvrď alebo oprav jednotlivé ✔/○/–]

## 3. Tok dokladov

```
Zákazník:   DOP ──► CP (verzie) ──► Objednávka ──► ZAK ──► [Vizuál] ──► Realizácia ──► DL / Protokol ──► FA ──► Úhrada ──► Archív
                      ▲                              │
Dodávateľ:   Dopyt na dodávateľa ◄─────┘            ├──► OD (objednávka dodávateľovi) ──► Príjem ──► Prijatá e-faktúra ──► Úhrada
                                                     └──► Hodiny, úlohy (Gantt)
E-mail:     prichádzajúci e-mail ──► priradenie k zákazníkovi / DOP / ZAK ──► (voliteľne) nový DOP
```

## 4. Stavové automaty

### 4.1 Dopyt (DOP)

| Stav | Kód | Význam |
|---|---|---|
| Nový | `new` | zaevidovaný (ručne alebo z e-mailu) |
| V spracovaní | `in_progress` | priradený, zbierajú sa podklady |
| Čaká na doplnenie | `waiting_customer` | chýbajú informácie od zákazníka |
| Pripravený na kalkuláciu | `ready_for_costing` | podklady kompletné |
| Uzatvorený | `closed` | vznikla z neho CP |
| Zamietnutý | `rejected` | nebude sa ponúkať (dôvod povinný) |

| Z → Do | Podmienka |
|---|---|
| new → in_progress | priradený zodpovedný |
| in_progress → waiting_customer | poznámka, čo chýba |
| waiting_customer → in_progress | – |
| in_progress → ready_for_costing | vyplnený typ zákazky a popis |
| ready_for_costing → closed | existuje CP naviazaná na dopyt (automaticky) |
| new / in_progress / waiting_customer / ready_for_costing → rejected | dôvod povinný |

Zdroj dopytu: `email`, `phone`, `web`, `personal`, `other`. Ak vznikol z e-mailu, je naviazaný na správu.

### 4.2 Cenová ponuka (CP) a jej verzie

CP je obálka, obsah je vo **verziách**. Upraviť sa dá len verzia v stave `draft`.

| Stav verzie | Kód | Význam |
|---|---|---|
| Rozpracovaná | `draft` | editovateľná |
| Na schválenie | `pending_approval` | čaká na interné schválenie |
| Schválená | `approved` | uzamknutá, vygenerované PDF |
| Odoslaná | `sent` | odoslaná zákazníkovi (e-mailom zo systému alebo ručne) |
| Akceptovaná | `accepted` | zákazník prijal → vzniká objednávka |
| Zamietnutá | `rejected` | zákazník odmietol (dôvod) |
| Expirovaná | `expired` | uplynula platnosť (automaticky, denná úloha) |
| Nahradená | `superseded` | existuje novšia verzia |

| Z → Do | Podmienka |
|---|---|
| draft → pending_approval | aspoň 1 položka; všetky položky majú množstvo a cenu; vyplnená platnosť |
| pending_approval → draft | vrátenie s poznámkou |
| pending_approval → approved | schvaľovateľ = admin; [NÁVRH] pri 2 adminoch smie schváliť aj autor (rozhodnutie Q-P1) |
| approved → sent | PDF existuje |
| sent → accepted / rejected | záznam o reakcii zákazníka |
| sent → expired | dnešný dátum > valid_until (automaticky) |
| draft / approved / sent → superseded | vznikla nová verzia (automaticky) |

Upozornenie na zisk [NÁVRH]: ak je zisk CP pod nastavenou hranicou (`system_settings.min_profit_pct`, predvolene **nenastavené**), prechod do `pending_approval` zobrazí varovanie; neblokuje.

### 4.3 Objednávka zákazníka a zákazka (ZAK)

Prijatie objednávky = záznam objednávky zákazníka (jeho číslo, dátum, dokument/e-mail) + automatické vytvorenie zákazky. Rozpočet zákazky sa skopíruje z akceptovanej verzie CP a uzamkne (**baseline**).

| Stav zákazky | Kód | Význam |
|---|---|---|
| Prijatá | `received` | objednávka zaevidovaná |
| Potvrdená | `confirmed` | potvrdenie objednávky odoslané zákazníkovi |
| V plánovaní | `planning` | úlohy, nákupy, termíny |
| V realizácii | `in_progress` | práca beží |
| Pripravená na dodanie | `ready_for_delivery` | – |
| Dodaná | `delivered` | potvrdený DL / protokol |
| Vyfakturovaná | `invoiced` | vystavená konečná faktúra |
| Uzatvorená | `closed` | faktúra uhradená, náklady skontrolované |
| Zrušená | `cancelled` | dôvod povinný; len ak nie je vystavená faktúra |

| Z → Do | Podmienka |
|---|---|
| received → confirmed | potvrdenie objednávky vygenerované |
| confirmed → planning | – |
| planning → in_progress | – (pri PROMO blokuje nákup bez schváleného vizuálu pravidlo v 4.6, nie tento prechod) |
| in_progress → ready_for_delivery | – |
| ready_for_delivery → delivered | existuje potvrdený DL alebo preberací/servisný protokol |
| delivered → invoiced | existuje vystavená faktúra (nie zálohová) |
| invoiced → closed | faktúra(y) uhradené; prijaté faktúry dodávateľov priradené |
| received…ready_for_delivery → cancelled | dôvod; žiadna vystavená faktúra |

### 4.4 Schválenie vizuálu (PROMO, voliteľne EVENT/SEASON) [POTVRDENÉ – povinné pre PROMO]

| Stav | Kód |
|---|---|
| Pripravený náhľad | `draft` |
| Odoslaný zákazníkovi | `sent` |
| Schválený | `approved` |
| Zamietnutý – na prepracovanie | `rejected` |

- Každý náhľad je **verzia** (v1, v2…), súbor v dokumentoch, hash.
- Záznam súhlasu: kto (meno zákazníka), kedy, ktorá verzia, dôkaz (e-mail v systéme alebo nahraný dokument).
- **Pravidlo:** objednávku dodávateľovi (OD) zákazky typu PROMO nemožno odoslať, kým neexistuje vizuál v stave `approved`. Vynúti databáza.

### 4.5 Dopyt na dodávateľa a ponuka dodávateľa

| Stav | Kód |
|---|---|
| Rozpracovaný | `draft` |
| Odoslaný | `sent` |
| Ponuka prijatá | `quoted` |
| Vybraná | `selected` |
| Nevybraná / bez odpovede | `closed` |

Cena z vybranej ponuky sa dá prevziať do položky CP (väzba položka → ponuka dodávateľa).

### 4.6 Objednávka dodávateľovi (OD)

| Stav | Kód | Podmienka |
|---|---|---|
| Rozpracovaná | `draft` | – |
| Odoslaná | `sent` | PROMO: schválený vizuál |
| Potvrdená dodávateľom | `confirmed` | – |
| Čiastočne prijatá | `partially_received` | existuje príjem |
| Prijatá | `received` | všetky položky prijaté |
| Zrušená | `cancelled` | dôvod; bez príjmu |

### 4.7 Príjem tovaru / služby

Príjemka (PRI) zaznamená prijaté množstvo k položkám OD, dátum, číslo dodacieho listu dodávateľa a sken. Pri službe = potvrdenie vykonania. Skutočná nákupná cena sa porovná s rozpočtom zákazky.

### 4.8 Dodací list / preberací protokol / servisný protokol (DL)

Jedna tabuľka dokladov dodania s druhom: `delivery_note`, `handover_protocol`, `service_report` (posledný skrytý s feature flagom).

| Stav | Kód |
|---|---|
| Rozpracovaný | `draft` |
| Vystavený | `issued` (uzamknutý, PDF) |
| Potvrdený zákazníkom | `confirmed` |
| Stornovaný | `cancelled` (len z `issued`, s dôvodom; nový doklad) |

Potvrdenie [NÁVRH, Q17 bez odpovede]: nahratie podpísaného skenu/fotky alebo potvrdenie e-mailom (správa v systéme) + meno preberajúceho a dátum. Elektronický podpis na tablete – neskôr.

### 4.9 Vydaná faktúra (FA)

Firma **nie je platiteľ DPH** [POTVRDENÉ] → faktúry bez DPH. Druhy: `invoice` (faktúra), `proforma` (zálohová faktúra – nie je daňový doklad), `credit_note` (dobropis – opravný doklad k faktúre).

| Stav | Kód |
|---|---|
| Rozpracovaná | `draft` |
| Vystavená | `issued` (číslo pridelené, uzamknutá, PDF) |
| Odoslaná | `sent` |
| Čiastočne uhradená | `partially_paid` |
| Uhradená | `paid` |
| Po splatnosti | `overdue` (automaticky, denná úloha) |
| Stornovaná | `cancelled` (iba dobropisom; číslo sa nikdy neuvoľní) |

- Číslo faktúry sa pridelí až pri prechode `draft → issued`, nepretržitý rad v roku.
- Náležitosti účtovného dokladu (zákon č. 431/2002 Z. z., § 10) sa kontrolujú validačnými pravidlami pred vystavením. Presný zoznam náležitostí prevezme vývoj z aktuálneho znenia zákona [OVERIŤ] a zapíše do `validation_rules`.
- Sledovanie obratu voči registračnému limitu DPH (§ 4 zákona o DPH) – upozornenie; výška limitu z aktuálneho znenia [OVERIŤ].
- Zahraničný dodávateľ → upozornenie na možnú registračnú povinnosť (§ 7, § 7a) [OVERIŤ s účtovníkom].

### 4.10 Prijatá faktúra (e-faktúra od dodávateľa)

Od 1. 1. 2027 prijíma firma e-faktúry v sieti Peppol cez digitálneho poštára, ktorého zabezpečuje externý účtovník [POTVRDENÉ]. Napojenie API neskôr [POTVRDENÉ]; dovtedy:

1. Import XML (Peppol BIS / EN 16931) alebo PDF ručne → parsovanie hlavičky (dodávateľ, číslo, dátumy, suma) → kontrola duplicity (dodávateľ + číslo faktúry).
2. Priradenie k OD / zákazke (aj rozpočítanie na viac zákaziek).

| Stav | Kód |
|---|---|
| Prijatá | `received` |
| Skontrolovaná | `verified` (sedí s OD/príjmom) |
| Na úhradu | `approved_for_payment` |
| Uhradená | `paid` |
| Reklamovaná | `disputed` |

### 4.11 Úhrady

Úhrada sa eviduje ručne (dátum, suma, variabilný symbol, poznámka). Import bankového výpisu – neskôr [NÁVRH].

## 5. Kalkulácia (ceny a zisk)

### 5.1 Typy položiek CP

| Typ | Kód | Náklad na jednotku | Predajná cena |
|---|---|---|---|
| Materiál / tovar | `goods` | nákupná cena (z ponuky dodávateľa alebo katalógu) | náklad + navýšenie |
| Externá služba / kooperácia | `external_service` | cena dodávateľa | náklad + navýšenie |
| Vlastná práca | `labor` | hodiny × interná (kalkulačná) sadzba roly | hodiny × fakturovaná sadzba roly, alebo náklad + navýšenie |
| Vlastný zdroj (zariadenie) | `resource` | hodiny × nákladová sadzba zdroja | hodiny × predajná sadzba zdroja |
| Balíček | `package` | súčet komponentov × množstvo | náklad + navýšenie, alebo súčet predajných cien komponentov |
| Ostatné / réžia | `other` | zadaná suma | zadaná suma alebo náklad + navýšenie |

### 5.2 Navýšenie na položke [POTVRDENÉ]

Na každej položke voliteľne:

| Režim | Kód | Vzorec |
|---|---|---|
| Bez navýšenia | `none` | cena = náklad (alebo ručne zadaná cena) |
| Marža % | `margin` | cena = náklad ÷ (1 − m) ; m < 100 % |
| Prirážka % | `markup` | cena = náklad × (1 + k) |

Systém pri každej položke ukáže oba ukazovatele (maržu aj prirážku) a celkový zisk CP v € a %:
- zisk = Σ cena − Σ náklad
- zisk % (marža CP) = zisk ÷ Σ cena

Zaokrúhlenie [NÁVRH]: výpočty v celých centoch, jednotková cena zaokrúhlená na cent (polovica nahor), riadok = jednotková cena × množstvo.

### 5.3 Sadzby a zdroje [NÁVRH – hodnoty zadá vlastník vo fáze 3]

- Roly a sadzby majú platnosť od–do; CP si pri vytvorení verzie uloží použitú sadzbu (zmena sadzby nezmení starú CP).
- Konatelia nemajú odmenu → **kalkulačná sadzba** = cieľová hodnota hodiny pre kalkuláciu, nie mzda.
- Vlastný zdroj: nákladová sadzba = (obstarávacia cena ÷ predpokladané hodiny životnosti) + prevádzkové náklady na hodinu. Kalkulačné opotrebenie, nie účtovný odpis.

### 5.4 Plán vs. skutočnosť

- Baseline = kópia položiek akceptovanej verzie CP pri vytvorení zákazky.
- Skutočnosť = OD/príjmy + prijaté faktúry priradené k zákazke + hodiny × kalkulačná sadzba.
- Ak skutočný zisk klesne pod baseline o viac ako nastavený prah [NÁVRH: prah nenastavený, kým ho vlastník nezadá] → notifikácia.

## 6. E-mail [POTVRDENÉ požiadavka, NÁVRH riešenie]

1. Systém sa pripojí k schránke na WebSupporte (IMAP na čítanie, SMTP na odosielanie). Prístupové údaje uložené šifrovane na serveri (Supabase Vault).
2. Synchronizácia každých N minút (plánovaná úloha) – nové správy sa uložia (hlavička, text, prílohy do úložiska).
3. Automatické priradenie:
   - k zákazníkovi/dodávateľovi podľa e-mailovej adresy kontaktu,
   - k dokladu podľa čísla v predmete (napr. `CP-2026-0007`, `ZAK-2026-0003`).
4. Z nepriradeného e-mailu jedným klikom: nový dopyt, priradenie k existujúcej zákazke, ignorovať.
5. Odosielanie zo systému (CP, potvrdenie objednávky, náhľad vizuálu, dopyt na dodávateľa, OD, faktúra) – číslo dokladu v predmete, PDF v prílohe, kópia v histórii zákazky.
6. Riziko na overenie vo fáze 1: dostupnosť IMAP/SMTP z Supabase Edge Functions. Záloha: transakčná e-mailová služba cez HTTPS na odosielanie.
7. [CHÝBA] Ktorá schránka (adresa) sa pripojí – pravdepodobne na doméne aveng.sk alebo av-agency.sk.

## 7. Notifikácie [NÁVRH]

| Udalosť | Komu | Kanál |
|---|---|---|
| Nový dopyt (aj z e-mailu) | obaja admini | aplikácia + e-mail |
| CP čaká na schválenie | admini | aplikácia + e-mail |
| CP expiruje o 3 dni | autor | aplikácia |
| Zákazník schválil/zamietol vizuál | zodpovedný za zákazku | aplikácia + e-mail |
| Termín úlohy/míľnika o 2 dni, omeškanie | priradený | aplikácia + e-mail |
| Faktúra po splatnosti | admini | e-mail |
| Prijatá faktúra čaká na priradenie | admini | aplikácia |
| Zisk zákazky pod baseline | admini | e-mail |
| Zmena sledovaného predpisu (Slov-Lex) | adresy v nastaveniach | e-mail |
| Obrat sa blíži k limitu registrácie DPH | admini | e-mail |

## 8. Legislatívny monitoring [NÁVRH, Q15 bez odpovede]

- Watchlist (predvolene): zákon č. 222/2004 Z. z. o DPH, č. 431/2002 Z. z. o účtovníctve, č. 513/1991 Zb. Obchodný zákonník, č. 18/2018 Z. z. o ochrane osobných údajov.
- Denná úloha: kontrola novej časovej verzie predpisu na Slov-Lexe → záznam zmeny → e-mail na nastavené adresy. Technika (formát stránok/URL) sa overí prototypom; ak zlyhá, úloha to sama nahlási.
- AI zhrnutie zmien: **vypnuté** (predvolene). Validačné pravidlá mení vždy človek.

## 9. Archivácia [NÁVRH]

- Faktúry vydané aj prijaté a účtovné záznamy: 10 rokov po roku, ktorého sa týkajú (zákon o účtovníctve § 35, zákon o DPH) → `retention_until` na dokumente.
- Ostatné obchodné dokumenty: 10 rokov (zjednodušenie, kým vlastník nerozhodne inak).
- Každý súbor má SHA-256; archív sa pravidelne exportuje mimo Supabase (domáci server) – fáza 7.

## 10. Predvolené rozhodnutia pre otázky bez odpovede [NÁVRH]

| Otázka | Predvolené riešenie |
|---|---|
| Q15 watchlist, AI | 4 predpisy v kap. 8; AI vypnuté |
| Q16 úložisko | Supabase Storage (súkromné buckety), záloha na domáci server |
| Q17 potvrdenie dodania | sken/fotka podpísaného dokladu alebo e-mail v systéme |
| Q18 Gantt | úlohy, podúlohy, míľniky, závislosti „koniec–začiatok“, priradenie osobe alebo dodávateľovi. **Rozšírené rozhodnutím D24** a analýzou `docs/analyzy/ANALYZA-RIADENIE-PROJEKTOV-A-ZDROJOV.md` (plánovanie zdrojov, kalendáre, šablóny, baseline, scenár eventu – fáza 5a) |
| Q19 jazyk, mena | doklady SK, mena EUR (pole meny pripravené) |
| Q20 B2C | primárne B2B; zákazník môže byť aj fyzická osoba (typ zákazníka) – GDPR |
| Q21 import | bez importu, dáta sa zadajú ručne vo fáze 3 |
| Q22 Supabase | Free na vývoj s testovacími dátami → Pro pred ostrými dátami → neskôr self-hosted |
| Q23 čas | bez termínov |
| Q-P1 schválenie CP | pri 2 adminoch smie schváliť aj autor (inak by jeden konateľ nemohol pracovať sám) |

## 11. KPI pre projekt Rodinné podnikanie W [NÁVRH]

Systém bude zbierať údaje pre KPI služieb S1–S8 (napr. fakturované vs. dostupné hodiny, čas od prijatia po uzavretie požiadavky, reklamácie). Prehľady sa doplnia po fáze 5.

## 12. Reporting, ukazovatele a grafy [POTVRDENÉ požiadavka 26. 11. 2026, NÁVRH riešenie]

Upozornenie: systém nie je účtovníctvo. Všetky finančné čísla sú **manažérske** – počítané z dokladov v systéme. Záväzné sú čísla externého účtovníka.

### 12.1 Pohľad: Spolu / AV-agency (Agentúra) / AVENG

Každý ukazovateľ sa dá zobraziť za **celú firmu**, za **Agentúru** a za **AVENG** (vedľa seba alebo prepínačom), za zvolené obdobie (mesiac, štvrťrok, rok, vlastné) a v porovnaní s rovnakým obdobím minulého roka.

### 12.2 Finančné ukazovatele

| Ukazovateľ | Výpočet [NÁVRH] |
|---|---|
| Tržby | vystavené faktúry (bez zálohových) podľa dátumu dodania |
| Priame náklady | prijaté faktúry priradené k zákazkám + hodiny × kalkulačná sadzba |
| Hrubý zisk a marža % | tržby − priame náklady; ÷ tržby |
| Réžia | mesačné fixné náklady zadané ručne (tabuľka `overhead_costs`), voliteľne rozdelené na divízie |
| Prevádzkový zisk | hrubý zisk − réžia |
| Odhad dane z príjmov PO | sadzba podľa pásma výnosov z tabuľky `income_tax_brackets` (hodnoty s dátumom platnosti, nie v kóde); len informatívny odhad |
| Zisk po dani (odhad) | prevádzkový zisk − odhad dane |
| Pohľadávky / záväzky | neuhradené vydané / prijaté faktúry, z toho po splatnosti |
| Príjmy a výdavky peňazí | evidované úhrady |
| Pipeline | odoslané CP v hre (suma, počet) |
| Obrat 12 mesiacov vs. limit registrácie DPH | z faktúr; limit z `system_settings` |
| Tržby a zisk podľa zákazníka | rebríček (Pareto – koľko zákazníkov tvorí 80 % tržieb) |
| Tržby a zisk podľa typu zákazky | ENG / EVENT / PROMO / SEASON (SERVICE skryté) |

DPH: firma je neplatiteľ, preto sa DPH neodvádza; ukazovateľ „Dane“ = odhad dane z príjmov PO.

### 12.3 Grafy [NÁVRH]

| Graf | Typ |
|---|---|
| Tržby, náklady, zisk po mesiacoch | stĺpce (tržby, náklady) + čiara (zisk), oddelene Agentúra / AVENG |
| Podiel divízií na tržbách a zisku | skladaný stĺpec |
| Most zisku (tržby → náklady → réžia → daň → zisk) | vodopádový graf |
| Top 10 zákazníkov podľa tržieb a marže | vodorovné stĺpce |
| Úspešnosť CP v čase | čiara |
| Splatnosť pohľadávok | stĺpce podľa vekových pásiem (do splatnosti, 1–30, 31–60, > 60 dní) |
| Dodanie včas – dodávatelia | vodorovné stĺpce |

### 12.4 Tlač a export

Každý prehľad, zoznam a graf má **Tlačiť / PDF** (tlačový štýl A4, logo, obdobie, dátum vytvorenia) a export do CSV/XLSX.

## 13. Hodnotenie zákazníkov a dodávateľov [POTVRDENÉ požiadavka, NÁVRH riešenie]

### 13.1 Zákazník – karta ukazovateľov

| KPI | Výpočet |
|---|---|
| Tržby, zisk, marža % | z faktúr a nákladov jeho zákaziek |
| Počet zákaziek, priemerná zákazka | – |
| Úspešnosť ponúk | akceptované CP ÷ odoslané CP |
| Platobná disciplína | priemerné dni úhrady po splatnosti, podiel faktúr po splatnosti |
| Reklamácie | počet a náklady z tabuľky `nonconformities` |
| Opakované nákupy | zákazky za 12 mesiacov |
| Hodnotenie | ručné hodnotenie po zákazke (1–5): komunikácia, spolupráca, platby |

### 13.2 Dodávateľ – karta ukazovateľov

| KPI | Výpočet |
|---|---|
| Objem nákupu | prijaté faktúry |
| Dodanie včas % | príjem ≤ očakávaný dátum OD |
| Cenová presnosť | fakturovaná cena vs. ponuka/OD (%) |
| Kvalita | nezhody a reklamácie voči dodávateľovi |
| Reakčná doba | odoslanie dopytu → prijatie ponuky (dni) |
| Úspešnosť ponúk | vybrané ponuky ÷ prijaté ponuky |
| Hodnotenie | ručné hodnotenie po príjme/zákazke (1–5): kvalita, termín, cena, komunikácia |

**Skóre partnera** = vážený priemer KPI a ručného hodnotenia; váhy nastaviteľné v nastaveniach (predvolene rovnaké). Kategória A / B / C podľa skóre – hranice nastaví vlastník.

### 13.3 Nezhody a reklamácie

Nový evidenčný záznam: kto (zákazník/dodávateľ), zákazka, popis, závažnosť, náklad, opatrenie, stav (otvorená / vyriešená). Vstup pre KPI kvality.

## 14. Procesné KPI (väzba na projekt Rodinné podnikanie W)

| KPI | Výpočet | Väzba na W |
|---|---|---|
| Doba dopyt → CP | odoslanie CP − prijatie dopytu (dni) | S3 service level |
| Úspešnosť CP | akceptované ÷ odoslané | – |
| Doba objednávka → dodanie | potvrdené dodanie − prijatie objednávky | lead time |
| Dodanie včas % | dodané ≤ plánovaný termín | – |
| Doba dodanie → faktúra | vystavenie FA − potvrdené dodanie | – |
| DSO (dni inkasa) | priemer dní od vystavenia po úhradu | – |
| Zákazky pod plánovaným ziskom | podiel uzavretých zákaziek so ziskom < baseline | – |
| Utilizácia | fakturované hodiny ÷ dostupné hodiny (kapacita z kalendára: týždenný vzor − dni pracovného pokoja ± výnimky, D24) | S1 |
| Realizovaná sadzba | tržby za hodinové služby ÷ fakturované hodiny | S2 |
| Miera reklamácií | zákazky s reklamáciou ÷ všetky | S5 |
| Opakované nákupy | zákazníci s ≥ 2 zákazkami ÷ aktívni | S7 |

Každé KPI má cieľ (nastaviteľný) a semafor; z dashboardu sa dá prekliknúť až na konkrétne zákazky (drill-down).

## 15. Dokumenty na tlač a propagáciu [POTVRDENÉ požiadavka, NÁVRH riešenie]

Všetky dokumenty generuje systém zo schválených údajov a zo šablón v brandingu Add Value Agency (DESIGN_SYSTEM.md kap. 9).

| Dokument | Kedy | Zdroj dát |
|---|---|---|
| **Firemná prezentácia k CP** (PDF, viacstranová) | pri odoslaní CP, voliteľne | titulná strana, o firme, služby divízie a typu zákazky, riešenie a rozsah (z CP), harmonogram (z úloh), cena (z CP), referencie, kontakt |
| Cenová ponuka | CP schválená | verzia CP |
| Potvrdenie objednávky | zákazka potvrdená | objednávka, CP |
| Žiadosť o schválenie vizuálu | vizuál odoslaný | náhľad, verzia |
| Dopyt na dodávateľa, objednávka dodávateľovi | nákup | RFQ, OD |
| Príjemka | príjem | príjem |
| Dodací list, preberací protokol, (servisný protokol – skrytý) | dodanie | doklad dodania |
| Faktúra, zálohová faktúra, dobropis, upomienka | fakturácia | faktúra |
| Súhrn zákazky (report) | uzavretie | zákazka, ekonomika |
| **Propagačné:** firemná prezentácia (všeobecná, podľa divízie), katalóg služieb / cenník, referenčný list (case study) | kedykoľvek | knižnica obsahu + uzavreté zákazky **so súhlasom zákazníka** |
| Reporty: dashboard, KPI, karta zákazníka/dodávateľa | kedykoľvek | ukazovatele |

Knižnica obsahu: texty o firme, popisy služieb podľa divízie a typu zákazky, referencie (len so súhlasom zákazníka – GDPR a obchodné tajomstvo), fotografie a vizuály. Systém z nej skladá prezentácie automaticky; texty upravuje vlastník.

Voliteľne (flag `ai_text_drafts`, predvolene **vypnuté**): návrh textov prezentácie pomocou AI – vyžaduje rozhodnutie o poskytovateľovi a nesmie posielať osobné údaje.

Technológia generovania PDF (server vs. prehliadač) sa overí prototypom vo fáze 4; doklady s právnym významom (CP, FA, DL) sa vždy ukladajú ako uzamknuté PDF s hashom.
