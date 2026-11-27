# Analýza: AI spracovanie prichádzajúcich e-mailov (triáž)

Stav: **SCHVÁLENÉ vlastníkom 26. 11. 2026** (D27) · F4 e-mail bez AI, F4.5 AI triáž
Súvisí: BUSINESS_PROCESSES (tok dokladov – E-mail, kap. e-mailový modul), DATABASE_SCHEMA (email_accounts, email_messages, inquiries.email_message_id, visual_approvals.evidence_email_id), ANALYZA-AI-IMPORT-KATALOGU (Nastavenia → AI, D25), D22, otvorená otázka O2 (ktorá schránka).

## 1. Požiadavka

Systém sleduje zadané e-mailové schránky. Pri prijatí e-mailu ho analyzuje, zaradí do kategórie a spracuje podľa postupu: dopyt na CP, schválenie ponuky, dohoda o termíne, schválenie vizuálu, odpoveď dodávateľa, faktúra…

## 2. Je to možné? Áno

Je to štandardný vzor „AI e-mail triage“ (Salesforce Einstein, HubSpot, Zendesk, Microsoft Copilot v Dynamics). Technicky:

1. **Načítanie pošty:** schránky na WebSupporte podporujú IMAP → plánovaná Edge Function (každých 5–15 min) načíta nové správy (len čítanie, priznak „spracované“ v našej DB, nie mazanie v schránke). Prílohy do Storage cez adaptér príloh (D23).
2. **Deterministické párovanie (bez AI, najprv):** odosielateľ → kontakt/zákazník/dodávateľ; čísla dokladov v predmete/texte (DOP-, CP-, ZAK-, OD-, FA-RRRR-NNNN); vlákno (In-Reply-To / References) → už spárovaný doklad.
3. **AI klasifikácia a extrakcia (cez Nastavenia → AI, Gemini adaptér):** kategória + spoľahlivosť + vytiahnuté údaje (termíny, sumy, čísla, požadované položky, meno rozhodujúcej osoby) ako štruktúrovaný JSON.
4. **Návrh akcie, nie automatická akcia** pre všetko, čo má právny alebo obchodný dosah.

## 3. Kategórie a postup

| Kategória | Čo systém urobí sám | Čo navrhne na potvrdenie |
|---|---|---|
| Nový dopyt / žiadosť o CP | priradí zákazníka (ak ho pozná) | **návrh DOP** s vyplneným popisom, termínom, prílohami; neznámy odosielateľ → návrh nového zákazníka |
| Doplnenie k dopytu / otázka k CP | pripojí e-mail k DOP/CP | zmena stavu (napr. waiting_customer → in_progress) |
| **Prijatie ponuky** | pripojí k CP | **„Zákazník prijal CP-… – potvrdiť“** → až človek spustí accept_quote_version (vznik zmluvy = vždy človek) |
| Odmietnutie ponuky / požiadavka na zmenu | pripojí k CP | zmena stavu CP, nová verzia CP |
| **Schválenie vizuálu** (PROMO) | pripojí k vizuálu | návrh „schválené“ s e-mailom ako dôkazom (evidence_email_id) – potvrdí človek |
| Dohoda o termíne | pripojí k zákazke | návrh zmeny termínu úlohy/eventu, záznam do harmonogramu |
| Odpoveď dodávateľa na dopyt (cenová ponuka) | pripojí k RFQ | návrh supplier_quote (AI extrakcia položiek a cien) |
| Potvrdenie objednávky / dodacia lehota dodávateľa | pripojí k OD | návrh confirmed_date |
| Dodací list / faktúra dodávateľa | pripojí, uloží prílohu | návrh prijatej faktúry (od 2027 e-faktúry cez digitálneho poštára) |
| Upomienka, platba | pripojí k FA | upozornenie |
| Newsletter, reklama, spam | označí, skryje | – |
| Iné / nejasné | ponechá v „Neroztriedené“ | ručné zaradenie |

Pravidlá:
- **Prah spoľahlivosti** (konfigurovateľný): nad prahom sa návrh zobrazí ako „pripravený“, pod prahom ako „skontrolovať“; deterministické párovanie má prednosť pred AI.
- **Žiadna AI akcia nemení stav dokladu ani neodosiela e-mail bez potvrdenia človekom.** Automaticky len: pripojenie e-mailu k záznamu, štítok kategórie, označenie spamu.
- Každé rozhodnutie (AI návrh, potvrdenie, oprava) v Histórii zmien; opravy kategórie sa ukladajú ako spätná väzba (neskôr zlepšenie promptu/prahov).
- Odpovede zákazníkom (neskôr): AI môže pripraviť koncept odpovede, odoslanie vždy človek.

## 4. Obrazovky

- **E-maily → Doručená pošta systému:** zoznam s kategóriou, spárovaným záznamom, spoľahlivosťou, návrhom akcie; filtre (Neroztriedené, Na potvrdenie, podľa kategórie, schránky).
- **Detail e-mailu:** text, prílohy, vlákno, „Navrhovaná akcia“ (jedno hlavné tlačidlo podľa DESIGN_SYSTEM) + „Zmeniť kategóriu“ / „Priradiť k…“.
- **Na doklade (DOP, CP, ZAK, OD, FA):** dlaždica E-maily (už v DESIGN_SYSTEM 6.2).
- **Dashboard:** „E-maily na potvrdenie“.
- **Nastavenia → E-mailové schránky:** IMAP server, používateľ, heslo len na zápis (Vault), interval, ktoré priečinky, zapnutie AI triáže pre schránku.

## 5. Ochrana osobných údajov (GDPR) – dôležité

- E-maily obsahujú osobné údaje (mená, kontakty, podpisy) → spracovanie AI je spracovanie osobných údajov sprostredkovateľom (Google). Potrebné: platené služby Gemini (podmienky spracovania dát), zmienka v informácii o spracúvaní OÚ (fáza 8), minimalizácia – posielať len text tela a predmet, bez príloh, ak nie sú potrebné; skrátenie histórie vlákna (citovaných starších správ).
- **D22:** na dev projekte Free nie reálne osobné údaje → reálna schránka sa pripojí až na projekte Pro. Na vývoj a test: **testovacia schránka** (napr. test@av-agency.sk) so zjavne fiktívnymi e-mailmi.
- Uchovávanie: e-maily viazané na doklady podľa archivácie dokladov; nezaradené/spam mazať po lehote (napr. 90 dní) – nastaviteľné.

## 6. Náklady

E-mail je krátky text → rádovo stovky až nízke tisíce tokenov; pri lacnom modeli zlomok centu na e-mail. Rozpočet a poistka z Nastavení → AI platia aj tu (funkcia `ai_email_triage` v ai_usage).

## 7. Zaradenie do fáz (návrh)

| Fáza | Obsah |
|---|---|
| F3 – blok L | Nastavenia → AI (základ, už zadané) |
| F3.5 | AI asistent katalógu – overí adaptér, prompt, poistku v praxi |
| **F4** | e-mailové schránky: IMAP načítanie (prototyp hneď na začiatku – technika pripojenia z Edge Function), uloženie správ a príloh, deterministické párovanie, ručné „Priradiť k…“ a „Vytvoriť DOP z e-mailu“ |
| **F4.5 – AI triáž e-mailov** | kategórie, extrakcia, návrhy akcií podľa tabuľky v kap. 3, prahy, spätná väzba, dashboard „Na potvrdenie“ |
| F5b, F6 | rozšírenie kategórií o vizuál, dodávateľov, faktúry (keď tie moduly existujú) |
| F8 | informácia o spracúvaní OÚ, retencia, prechod reálnych schránok na Pro |

## 8. Rozhodnutia vlastníka (26. 11. 2026) – D27

| # | Otázka | Rozhodnutie |
|---|---|---|
| 1 | Ktoré schránky (O2) | **parameter v Nastaveniach → E-mailové schránky**; vlastník ich doplní sám (odporúčané spoločné info@, ponuky@). O2 tým uzavretá. |
| 2 | Testovacia schránka | **áno** – vlastník založí test@av-agency.sk na WebSupporte (fiktívne e-maily na dev). |
| 3 | Odosielanie | **zatiaľ len čítanie**; AI môže pripraviť **koncept odpovede** (draft) na skopírovanie, systém **neodosiela** (SMTP neimplementovať). |
| 4 | Pravidlo | **AI navrhuje, človek potvrdzuje**; automaticky len pripojenie e-mailu k záznamu, štítok kategórie, označenie spamu. |
| 5 | Zaradenie | **e-mail (IMAP, párovanie, bez AI) vo F4**, **AI triáž vo F4.5**. |

Stav dokumentu: **SCHVÁLENÉ**.
