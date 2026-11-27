# Návrh: O2C tabuľa (kanban) s drag & drop – D28

Stav: **SCHVÁLENÉ vlastníkom 26. 11. 2026** (D28) · implementácia F4 (Dopyty, Ponuky, Zákazky), F5a/F5b (realizácia, nákup, dodanie, kanban úloh), F6 (Fakturácia)

Požiadavka vlastníka: v Prehľade jednoducho vidieť celý proces O2C v stĺpcoch a presúvať položky medzi stavmi pomocou drag & drop.
Vzor (screenshot vlastníka 26. 11. 2026): nadpis „Celý proces na jednom mieste“, štyri stĺpce s jemne farebným pozadím – Dopyty · Cenové ponuky · Zákazky / Produkcia · Fakturácia; v hlavičke stĺpca farebná bodka, názov, počet, podnadpis so súčtom (napr. „Nové príležitosti · 14 600,00 €“) a tlačidlo „+ Nový …“; karta = štítok typu/čísla dokladu (Dopyt, CP-2026-0018, FV-2026-0012), štítok stavu vpravo (Nový, V riešení, Odoslaná, Prijatá, Dodané, Pripravené na expedíciu, Uhradená), názov, zákazník alebo e-mail, suma veľkým písmom, dátum s ikonou kalendára; pri zákazke riadok „Bez subdodávateľa“, pri faktúre „Uhradené … · zostatok …“.

## Rozhodnutia vlastníka (D28)

| # | Otázka | Rozhodnutie |
|---|---|---|
| 1 | Umiestnenie | **v Prehľade** – tabuľa je hlavná časť Prehľadu, KPI dlaždice nad ňou |
| 2 | Stĺpce | **podľa etáp** (Dopyty · Cenové ponuky · Zákazky · Fakturácia), stav ako štítok na karte; pri ťahaní sa zobrazia povolené cieľové stavy |
| 3 | Kritické kroky | prijatie CP a vystavenie faktúry sa ťahaním len **spustia** a vždy **potvrdia v okne** |

## Riešenie (best practices – Pipedrive, HubSpot, Odoo, Dynamics)

1. **Prehľad:** KPI dlaždice (bento) hore, pod nimi tabuľa O2C na celú šírku. Filtre: Spolu / Agentúra / AVENG, obdobie, zodpovedný, typ zákazky; vyhľadávanie.
2. **Stĺpec:** názov etapy, počet, súčet € (bez DPH – neplatiteľ), „+ Nový …“. Jemný odtieň podľa etapy len ako akcent (WCAG AA), stav vždy aj textom.
3. **Karta:** číslo dokladu, štítok stavu, názov, zákazník, suma, termín (omeškanie červeným textom + ikonou), divízia, ikonky (čaká vizuál, subdodávateľ, e-mail na potvrdenie, AI návrh). Klik = detail dokladu.
4. **Drag & drop vždy cez `public.transition()`:**
   - pri ťahaní sa v cieľovom stĺpci rozbalia **povolené stavy** podľa `status_transitions` (ostatné zašedené);
   - prechod s povinnými údajmi (dôvod zamietnutia, poznámka) → krátke okno;
   - **prijatie CP** (`accept_quote_version`), **vystavenie faktúry** (`issue_invoice`), storno → potvrdzovacie okno s jasným následkom;
   - presun do ďalšej etapy (dopyt → Ponuky) = sprievodca „Vytvoriť CP z dopytu“, nie len zmena stavu;
   - stav vyžadujúci doklad (uhradená = platba) → formulár platby;
   - chyba z DB → karta sa vráti, slovenská hláška;
   - všetko v Histórii zmien; optimistické zobrazenie len pri nevratných krokoch nie.
5. **Prístupnosť:** menu „Presunúť do…“ na karte a ťahanie klávesnicou (dnd-kit s podporou klávesnice a čítačky).
6. **Mobil:** stĺpce vodorovne posúvateľné, presun cez „Presunúť do…“.
7. **Výkon:** v stĺpci posledných N kariet + „Zobraziť všetko“; uzavreté (uhradené, zamietnuté) staršie ako 30 dní skryté (nastaviteľné).
8. **Jeden komponent `BoardView`** v `src/ui` (stĺpce, karty, ťahanie, menu) – znovu použitý pre kanban úloh (F5a) a nákup (F5b).
9. **Realtime:** zmena od druhého konateľa sa prejaví na tabuli (Supabase Realtime, ako v ARCHITECTURE_CORE).

## Zaradenie

| Fáza | Obsah |
|---|---|
| F4 | `BoardView`, Prehľad s tabuľou: Dopyty, Cenové ponuky, Zákazky (stavy zákazky); prijatie CP ťahaním s potvrdením |
| F5a / F5b | Zákazky rozšírené o realizáciu, nákup, dodanie; kanban úloh zákazky |
| F6 | stĺpec Fakturácia (vystavené, po splatnosti, uhradené; zostatok); vystavenie FA ťahaním s potvrdením |
| F7 | súčty a filtre napojené na reporting |
