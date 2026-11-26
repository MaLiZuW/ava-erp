# Report fázy 1 – Základ projektu (`phase-01-foundation`)

Dátum: 26/11/2026

## Stav draft PR

Draft PR sa zatiaľ nevytvoril: `gh` nie je v shelli Claude Code prihlásené (`gh auth status` – „You are not logged into any GitHub hosts“). Po `gh auth login` v PowerShelli:

```powershell
gh pr create --draft --base main --head phase-01-foundation --title "Phase 1: Foundation" --body-file "$env:TEMP\pr-phase-01-body.md"
```

Vetva je pushnutá a `origin/phase-01-foundation` je synchronizovaná.

## 1. Čo bolo vytvorené

- Next.js 16 so statickým exportom, Tailwind 4, tokeny dizajnu a lokálne písmo Inter.
- Komponenty `Tile` a `BentoGrid`, `StatusBadge`, `KpiNumber`, `ProcessRail`, `DocumentShell`, `EmptyState`, `Button` a `CommandPalette` (Ctrl+K).
- Rozloženie s bočným menu (14 položiek) a stránky „Pripravujeme“.
- Utility `formatDate` (DD/MM/YYYY), `formatMoney` a `parseMoneyToCents`.
- Databázové jadro: `transition()`, `next_document_number()` a RLS s `aal2` na všetkých tabuľkách.
- `public/.htaccess`, skripty `db:*`, CI a dokumenty v koreni.

## 2. Zmenené súbory

Proti `main` je to 78 súborov, 14 722 pridaných riadkov, žiadne zmazané. Hlavné časti sú `src/`, `supabase/`, `scripts/`, `public/` a `e2e/`.

## 3. Databázové zmeny (migrácie)

Jedna migrácia: `20261126140000_core_foundation.sql`.

- Rozšírenia, schéma `private`, enumy a 9 tabuliek: `companies`, `divisions`, `profiles`, `user_roles`, `feature_flags`, `system_settings`, `number_series`, `status_transitions`, `activity_logs`.
- Funkcie: `set_updated`, `log_change`, `has_role`, `next_document_number`, `transition`, `block_direct_status_update`.
- Seed: firma so zástupnými textami `TODO`, divízie AVENG a Agentúra, 4 feature flagy a číselné rady.

## 4. Testy – čo prešlo, čo nie

Spustené znova 26/11/2026 na `ava-erp-dev`; všetko prešlo.

| Kontrola | Výsledok |
|---|---|
| Migrácie na `ava-erp-dev` (`db:push`, `db:seed`, `db:types`) | Prebehli podľa záznamu v `TODO.md` z 26/11/2026. Dnes znova nespúšťané, lebo menia dev databázu. |
| `npm run db:test` (pgTAP) | Prešlo: 91 assertov v 4 súboroch (RLS 51, číslovanie 11, prechody 17, audit 12). Súbežnosť: 10 paralelných sessions dalo rôzne čísla bez medzier. |
| `npm run db:test:api` | Prešlo. Anon dostane HTTP 401 a 0 riadkov na všetkých 9 tabuľkách; RPC `next_document_number`, `transition` aj INSERT sú odmietnuté. Pokrýva bod brány „bez 2FA žiadne dáta“. |
| Postavenie DB od nuly | Prebehlo podľa záznamu (commit `d190926`, `TODO.md`): reset, `db:push`, `db:seed`, `db:test`, `db:test:api` na `ava-erp-dev` so súhlasom vlastníka, všetko zelené. Dnes neopakované – reset je deštruktívny. |
| `npm test` (Vitest) | 26/26 |
| `npm run lint`, `npm run typecheck` | bez chýb |
| `npm run build` | OK |
| Playwright e2e | 3/3, proti `out/` lokálne |

## 5. Otvorené problémy a riziká

Body brány, ktoré ostávajú **otvorené**:

1. **Nasadenie na `https://app.av-agency.sk`.** Hosting je pozastavený zo strany WebSupportu; overené je len lokálne (build a e2e). Zostáva:
   - obnoviť HTTPS certifikát (O3 v `DECISIONS.md`);
   - nahrať `out/` cez WinSCP vrátane skrytého `.htaccess`;
   - skontrolovať HTTP → HTTPS (301), hlavičky, obnovenie `/zakazky/` bez 404 a 404.html;
   - overiť, že CSP neblokuje Supabase (konzola bez CSP chýb).
2. **Prototyp IMAP/SMTP.** Zatiaľ nebeží, chýba testovacia schránka na WebSupport. Riziko na overenie: Edge Functions blokujú odchádzajúce porty 25 a 587, preto sa SMTP skúša na 465. Nezdržuje bránu.

Body brány, ktoré sú **splnené**: build, `npm test` a pgTAP; DB od nuly (podľa záznamu); bez 2FA žiadne dáta.

Riziká:

- `.htaccess` je overený len testom textu, nie na skutočnom Apache.
- Dev projekt Free sa po 7 dňoch nečinnosti pozastaví a nemá zálohy; zdrojom pravdy sú migrácie a seed.
- CSP zatiaľ používa `'unsafe-inline'` pre skripty (plán: fáza 8).

## 6. Odporúčaný ďalší krok

- Nechať PR ako draft a nezlučovať ho, kým nie je splnený bod 1 brány.
- Medzitým pripraviť plán fázy 2 (`docs/steps/STEP-02-bezpecnost.md`: prihlásenie a 2FA); podľa `CLAUDE.md` najprv plán a počkať na súhlas.

## 7. Čo mám overiť ja

1. V PowerShelli spustiť `gh auth login` a príkaz na vytvorenie PR vyššie; skontrolovať, že PR je Draft.
2. `npm run dev`, otvoriť `http://localhost:3000` – prázdna bento mriežka a menu so 14 položkami.
3. Ctrl+K, prejsť na „Zákazky“, obnoviť stránku (F5) – nesmie dať 404.
4. Po obnovení hostingu: nastaviť HTTPS certifikát pre `app.av-agency.sk`, nahrať obsah `out/` cez WinSCP do `/av-agency.sk/sub/app` aj s `.htaccess` a prejsť kroky z `DEPLOYMENT.md`, časť E.
5. Rozhodnúť, či zriadiť testovaciu schránku na WebSupport pre prototyp IMAP/SMTP.
