# MIGRATION_TO_SELF_HOSTED.md

Cieľ: možnosť presunúť databázu zo Supabase cloud na vlastný server (D14). Dátový model je čistý PostgreSQL; tu je zoznam všetkého, čo je Supabase-špecifické a treba pri presune nahradiť.

## Supabase-špecifické závislosti (stav fáza 2)

| Závislosť                                    | Kde sa používa                                                                      | Pri self-hosted                                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.users`                                 | FK `created_by`, `profiles.id`, trigger `on_auth_user_created`                      | Supabase Auth (GoTrue) sa dá hostovať samostatne; alebo vlastná tabuľka používateľov + úprava FK                                                             |
| `auth.mfa_factors`                           | `admin_list_users()` (počet overených TOTP faktorov)                                | GoTrue má rovnakú tabuľku; inak upraviť funkciu podľa náhradného Auth servera                                                                                |
| Auth Admin API (`auth.admin.*`)              | Edge Function `admin-mfa-reset`, testovací používatelia                             | GoTrue Admin API alebo ekvivalent                                                                                                                            |
| `auth.uid()`, `auth.jwt()`                   | RLS politiky, `set_updated`, `log_change`, `transition()`                           | ak ostane PostgREST + vlastný JWT, treba funkcie s rovnakým významom (čítajú `request.jwt.claims`)                                                           |
| Claim `aal` v JWT                            | politika `require_aal2`, `transition()`                                             | musí ho vydávať Auth server (TOTP MFA)                                                                                                                       |
| Roly `anon`, `authenticated`, `service_role` | `GRANT`/`REVOKE`, `to authenticated` v politikách                                   | vytvoriť rovnaké roly (PostgREST prepína rolu podľa JWT)                                                                                                     |
| Schéma `extensions`                          | `pgcrypto`, `pg_trgm`, `btree_gist` (fáza 3), `pgtap`                               | vytvoriť schému alebo upraviť `with schema`                                                                                                                  |
| `storage` (od fázy 2)                        | bucket `documents` (logo, obsah, prílohy D23), politiky na `storage.objects`, podpísané URL; trigger `sync_documents_bucket` píše do `storage.buckets` | Supabase Storage API sa dá hostovať samostatne; inak MinIO/S3 + vlastné podpísané odkazy a prenos politík (admin + aal2, bez prepisu, zámok cez `documents`). Aplikácia volá úložisko **len cez adaptér** `src/core/storage/adapter.ts`: nové úložisko = nová implementácia `StorageAdapter` + hodnota v check `documents.storage_provider` |
| `vault` (od fázy 5)                          | heslá k e-mailovým účtom                                                            | iný správca tajomstiev (napr. pgsodium, SOPS, súbor mimo repozitára)                                                                                         |
| Edge Functions (Deno)                        | `admin-mfa-reset` (fáza 2); neskôr PDF, e-mail, cron                                | Deno/Node služba za reverzným proxy; logika je v `handler.ts` bez závislosti od Supabase; cron cez `pg_cron`/systémový plánovač                              |
| Session pooler                               | pripojenie skriptov                                                                 | PgBouncer alebo priame pripojenie                                                                                                                            |

## Čo sa prenáša bez zmeny

Migrácie v `supabase/migrations`, seed, pgTAP testy (`supabase/tests`), všetky funkcie v schémach `public` a `private`, enumy, triggery, RLS.

## Postup (návrh)

1. Postaviť PostgreSQL 17 + PostgREST + Auth (GoTrue) alebo kompatibilnú náhradu.
2. Vytvoriť roly a schému `extensions`; aplikovať migrácie; spustiť `db:test` proti novému serveru.
3. `pg_dump` zo Supabase → obnova; kontrolné súčty (počty riadkov, `sha256` dokumentov).
4. Presmerovať `NEXT_PUBLIC_SUPABASE_URL` na nový server, znova zostaviť a nahrať frontend.
5. Otestovať prihlásenie s TOTP a kritické toky (Playwright).

Dokument sa dopĺňa s každou fázou, ktorá pridá ďalšiu závislosť od Supabase.
