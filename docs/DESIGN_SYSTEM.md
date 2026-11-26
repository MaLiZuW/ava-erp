# DESIGN_SYSTEM.md – Add Value Agency

Verzia 1.0 · schválené 26. 11. 2026 · požiadavka vlastníka: „brutálne moderný a čistý, modulárny grid / block-based UI, veľké okná“.
Vizuálny návrh obrazoviek (Prehľad, Detail zákazky): https://claude.ai/artifact/AaPtr3uKPA8XgtouGo1qz6

Interpretácia [NÁVRH]: **švajčiarsky (Swiss) štýl** – prísna mriežka, silná typografia, veľa voľného miesta – + **bento / modulárna mriežka** – obrazovky poskladané z veľkých blokov (dlaždíc) rôznej veľkosti.

## 1. Princípy

1. **Jeden blok = jedna vec.** Každá informácia žije vo vlastnej dlaždici s nadpisom, obsahom a najviac jednou akciou.
2. **Jeden ďalší krok.** Každý doklad zobrazuje práve jedno hlavné tlačidlo – ďalší povolený krok zo stavového automatu (napr. „Odoslať ponuku“). Ostatné akcie sú v menu „…“.
3. **Veľkosť = dôležitosť.** Čo je najdôležitejšie, má najväčšiu dlaždicu vľavo hore.
4. **Bez ozdôb.** Žiadne gradienty, tiene len jemné (alebo 1 px okraj), žiadne ilustrácie. Farba nesie význam, nie dekoráciu.
5. **Čísla sú hrdinovia.** Sumy, termíny a počty veľkým písmom s tabulárnymi číslicami.
6. **Klávesnica prvá.** Globálne vyhľadávanie a príkazy cez `Ctrl+K`, skratky na hlavné akcie.
7. **Prístupnosť WCAG 2.1 AA** minimum: kontrast textu ≥ 4,5 : 1, viditeľné zameranie (focus), stav vždy aj textom/ikonou, nie len farbou.
8. **História zmien je vždy posledná.** Poradie stránky: obsah a formuláre → **História zmien** ako posledná dlaždica na celú šírku, nikdy medzi formulármi (Nastavenia, detaily zákazníka/dodávateľa, katalóg, dokumenty, neskôr všetky doklady). Hodnoty v histórii sú v slovenskom formáte (čiarka, sumy €, DD/MM/YYYY, áno/nie) a odkazy sa zobrazujú ako názvy záznamov, nie UUID. *(Pripomienka vlastníka, fáza 3.)*
9. **Lepiaca hlavička stránky – nadpis modulu vždy viditeľný.** Horná lišta (nadpis, v režime nastavení navigačná cesta a popis, hlavné tlačidlo stránky, Hľadať, + Nové) ostáva pri rolovaní hore v celej aplikácii. *(Pripomienka vlastníka 21.)*

## 2. Mriežka a rozmery

| Prvok | Hodnota |
|---|---|
| Základná jednotka | 8 px (všetky odstupy sú násobky 8; výnimka 4 px vo vnútri komponentov) |
| Mriežka obsahu (desktop ≥ 1280 px) | 12 stĺpcov, medzera 24 px, okraj 32 px, max. šírka 1600 px |
| Bento mriežka dlaždíc | 4 stĺpce × riadky po 160 px, medzera 16 px |
| Tablet (768–1279 px) | 2 stĺpce bento, okraj 24 px |
| Mobil (< 768 px) | 1 stĺpec, okraj 16 px, dlaždice pod sebou v poradí dôležitosti |

Veľkosti dlaždíc (bento):

| Kód | Rozmer (stĺpce × riadky) | Použitie |
|---|---|---|
| `S` | 1 × 1 | jedno číslo (KPI) |
| `M` | 2 × 1 | krátky zoznam, stav |
| `L` | 2 × 2 | zoznam, graf, ekonomika zákazky |
| `XL` | 4 × 2 | Gantt, tabuľka, časová os |
| `HERO` | 4 × 1 | hlavička dokladu s ďalším krokom |

Dlaždica: zaoblenie 20 px, vnútorný okraj 24 px, okraj 1 px `neutral-200`, pozadie biele; nadpis dlaždice 13 px, verzálky, prestrkanie +0,04 em, `neutral-500`.

## 3. Farby (tokeny)

| Token | Hex | Použitie |
|---|---|---|
| `brand-navy` | `#00384C` | primárne tlačidlá, aktívna navigácia, nadpisy |
| `brand-blue` | `#00B0EF` | akcenty, ikony, grafy, zameranie, progres – **nie text na bielom** |
| `ink` | `#231E1F` | text |
| `white` | `#FFFFFF` | pozadie dlaždíc |
| `canvas` | `#F4F6F7` [NÁVRH] | pozadie aplikácie pod dlaždicami |
| `neutral-200/500/700` | [NÁVRH] odvodiť zo `ink` | okraje / sekundárny text / popisy |
| `success` / `warning` / `danger` | [NÁVRH] doplní fáza 2 s kontrolou kontrastu | stavy – vždy so štítkom textu |

Tmavý režim [NÁVRH]: pripraviť tokeny (CSS premenné), zapnúť až po MVP.

## 4. Typografia

| Úroveň | Veľkosť / riadkovanie | Hrúbka |
|---|---|---|
| Display (čísla KPI) | 48 / 52 | 600, tabulárne číslice |
| H1 (názov stránky / dokladu) | 32 / 40 | 600 |
| H2 (sekcia) | 20 / 28 | 600 |
| Body | 15 / 24 | 400 |
| Small / popisy | 13 / 20 | 400–500 |
| Nadpis dlaždice | 13 / 16, verzálky | 600 |

Písmo [NÁVRH]: **Inter** (bezplatné, OFL, plná podpora slovenskej diakritiky), lokálne pribalené (bez externého CDN – CSP). Čísla vždy `font-variant-numeric: tabular-nums`.

## 5. Rozloženie aplikácie

```
┌──────┬──────────────────────────────────────────────────────────┐
│ znak │  Názov stránky                     [Ctrl+K hľadať]  [+ Nové] │
│  AV  ├──────────────────────────────────────────────────────────┤
│      │  ┌─────────── HERO / XL ──────────┐ ┌── S ──┐ ┌── S ──┐   │
│ menu │  │                                │ │  12   │ │ 3 450 €│   │
│ ikony│  └────────────────────────────────┘ └───────┘ └───────┘   │
│  +   │  ┌──── L ─────┐ ┌──── L ─────┐ ┌──── M ─────────────┐     │
│ text │  │            │ │            │ └────────────────────┘     │
│      │  └────────────┘ └────────────┘                            │
└──────┴──────────────────────────────────────────────────────────┘
```

- Ľavý panel 72 px (ikony) / 240 px rozbalený: Prehľad, Dopyty, Ponuky, Zákazky, Nákup, Dodanie, Faktúry, E-maily · oddeľovač · Zákazníci, Dodávatelia, Katalóg · dole Nastavenia, profil.
- Horná lišta: názov stránky (H1), vyhľadávanie `Ctrl+K`, tlačidlo „+ Nové“ (dopyt, zákazník, …).
- Prepínač divízie (Všetko / AVENG / Agentúra) v hornej lište – filtruje celú aplikáciu.

## 6. Kľúčové obrazovky

### 6.1 Prehľad (dashboard)

Hore prepínač **Spolu / Agentúra / AVENG** a obdobie (mesiac, štvrťrok, rok, vlastné, porovnanie s minulým rokom); vpravo **Tlačiť / PDF**.

| Dlaždica | Veľkosť | Obsah |
|---|---|---|
| Výsledok obdobia | XL | tržby, náklady, hrubý zisk, marža %, odhad dane z príjmov, zisk po dani – stĺpec Spolu + Agentúra + AVENG |
| Tržby, náklady, zisk po mesiacoch | XL | stĺpcový graf + čiara zisku |
| Na dnes | L | čo čaká na mňa – každý riadok s jedným tlačidlom |
| Most zisku | L | vodopád: tržby → priame náklady → réžia → daň → zisk |
| Pohľadávky | S | neuhradené €, z toho po splatnosti |
| Pipeline | S | odoslané CP v hre |
| Obrat 12 mes. | S | voči limitu registrácie DPH |
| Úspešnosť CP | S | % s trendom |
| Top zákazníci | L | tržby a marža, prekliknutie na kartu zákazníka |
| Dodávatelia – skóre | L | kategória A/B/C, dodanie včas % |
| Procesné KPI | XL | semafory voči cieľom (doba dopyt→CP, dodanie včas, DSO, utilizácia…) |

### 6.1a Karta zákazníka / dodávateľa

HERO (názov, kategória A/B/C, skóre) + dlaždice KPI (kap. 13 BUSINESS_PROCESSES.md) + graf tržieb/nákupov v čase + nezhody + ručné hodnotenia + zákazky.

### 6.1b Tlač

Tlačový štýl A4 na výšku aj na šírku: biele pozadie, logo, názov reportu, obdobie, dátum a autor, dlaždice sa preusporiadajú do 2 stĺpcov, grafy vo vektorovej kvalite.

### 6.2 Detail dokladu (rovnaká šablóna pre DOP, CP, ZAK, OD, DL, FA)

1. **HERO dlaždica:** číslo dokladu, stav (štítok), zákazník, suma, **jedno hlavné tlačidlo „ďalší krok“**.
2. **Procesná os** pod HERO: Dopyt → Ponuka → Objednávka → Vizuál → Nákup → Dodanie → Faktúra → Úhrada → Archív; hotové kroky plné, aktuálny zvýraznený, budúce prázdne; klik = otvorí súvisiaci doklad.
3. Bento dlaždice podľa typu dokladu, napr. pri zákazke: Ekonomika (plán vs. skutočnosť) L, Úlohy/Gantt XL, Nákup M, Dokumenty M, E-maily M.
4. **História zmien** ako posledná sekcia stránky na celú šírku (princíp 8).

### 6.3 Zoznamy

Čistá tabuľka (bez pruhovania), riadok 48 px, lepiaca hlavička, filtre ako „čipy“ nad tabuľkou, uložené pohľady, hromadné akcie. Na mobile sa riadky menia na karty.

### 6.4 Editor položiek CP

Tabuľkový editor ako v tabuľkovom procesore (klávesnica, Tab/Enter), napravo lepiaca dlaždica **Súhrn**: náklad, cena, zisk € a %, marža aj prirážka – prepočet okamžite.

### 6.5 Režim nastavení (vzor Linear / Vercel / GitHub) – pripomienky vlastníka 20–22

- **Ľavý panel sa prepne:** po vstupe do Nastavení nahradí hlavné menu menu Nastavení. Hore „← Späť do aplikácie“ (posledná stránka aplikácie) a nadpis „Nastavenia“, pod tým skupiny: Firma · Bezpečnosť · Systém · AI · Reporting · Dáta · História zmien. Žiadne podpoložky v hlavnom menu, žiadne druhé menu vedľa hlavného.
- **Položky:** ikona + krátky názov na jeden riadok; nadpisy skupín malé sivé. **Aktívna položka:** jemné pozadie `canvas`, 2 px linka `brand-blue` vľavo, tučný text `navy` – nie plný tmavý blok. **Stav pri položke:** bodka (prípadne číslo), celý text v popise a pre čítačky (napr. „Logo chýba“, „Na overenie N“).
- **Podstránky s vlastnou adresou** (`/nastavenia/firma/logo/` …); jedna konfigurácia `SETTINGS_GROUPS` (`src/core/navigation.ts`) riadi menu, úvod a Ctrl+K (aj podľa názvov polí).
- **Hlavička podstránky (lepiaca):** navigačná cesta „Nastavenia / Skupina“, nadpis, jeden riadok popisu, hlavné tlačidlo sekcie vpravo. Titulok okna „Stránka · Nastavenia · Add Value Agency“. Dlaždica pod hlavičkou **nemá vlastný nadpis** (žiadna duplicita).
- **Obsah má jednotnú šírku** (max. 960 px): dlaždice na celú šírku obsahu alebo vzor „nadpis a popis vľavo, polia vpravo“.
- **Úvod `/nastavenia/`:** dlaždice skupín v poradí menu s popisom, stavom a odkazmi; „V poriadku“ až po načítaní dát.
- **Mobil:** zoznam sekcií (úvod) ako prvá obrazovka; sekcia samostatne s „← Nastavenia“ v hlavičke.
- **História zmien** sekcie naspodku (princíp 8), len jej záznamy, ako ľudské vety bez technických polí; celá v skupine História zmien.

## 7. Pohyb a odozva

- Prechody 150–200 ms, `ease-out`; žiadne poskakovanie.
- Optimistické uloženie s potvrdením (toast) a možnosťou „Späť“ pri nedeštruktívnych akciách.
- Skeleton namiesto spinnerov pri načítaní dlaždíc.
- Kritické akcie (vystaviť faktúru, storno) – potvrdzovacie okno s jasným textom následku.

## 8. Komponenty (shadcn/ui základ)

`Tile` (veľkosti S–XL, HERO), `StatusBadge`, `NextStepButton`, `ProcessRail`, `KpiNumber`, `DataTable` (TanStack Table), `CommandPalette` (cmdk), `MoneyInput`, `PercentInput`, `DateInput` (DD/MM/YYYY), `LineItemsEditor`, `Gantt` [výber knižnice vo fáze 5], `FileDrop`, `EmailThread`, `AuditTimeline`, `EmptyState`.

Každý komponent: varianty, stavy (hover, focus, disabled, loading, error), test prístupnosti.

## 9. Doklady (PDF)

Rovnaký jazyk: biela strana, logo vľavo hore, tmavomodrá linka, mriežka 12 stĺpcov, Inter, tabuľka položiek bez rámčekov s jemnými deliacimi čiarami, súčty vpravo veľkým písmom.
