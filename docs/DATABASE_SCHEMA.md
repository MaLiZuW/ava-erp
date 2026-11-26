# DATABASE_SCHEMA.md – Add Value Agency (interný Q2C/ERP systém)

Verzia: 1.0 – schválené vlastníkom 26. 11. 2026
Databáza: PostgreSQL (Supabase), schéma `public` + `private` (pomocné funkcie, nevystavené cez API).
Procesy a stavy: pozri `BUSINESS_PROCESSES.md`.

## 0. Konvencie

| Pravidlo | Hodnota |
|---|---|
| Primárny kľúč | `id uuid primary key default gen_random_uuid()` |
| Peniaze | `bigint` v **centoch** (`*_cents`), mena `char(3) default 'EUR'`; od fázy 3 každá suma v kmeňových dátach a nastaveniach `check (>= 0)`, percentá `>= 0` (schválené vlastníkom) |
| Percentá | `numeric(7,4)` (napr. 25.0000 = 25 %) |
| Množstvá | `numeric(14,4)` |
| Čas | `timestamptz`, dátumy `date`; zobrazenie DD/MM/YYYY |
| Audit stĺpce (každá tabuľka) | `created_at timestamptz not null default now()`, `created_by uuid references auth.users`, `updated_at timestamptz not null default now()`, `updated_by uuid` (trigger `set_updated`) |
| Mazanie | kmeňové dáta: `is_active boolean` (soft delete); doklady: nikdy fyzicky po vystavení (trigger) |
| Stavy | PostgreSQL `enum` pre každý stavový automat; prechody sú dáta v `status_transitions`, mení ich iba `public.transition()` |
| Čísla dokladov | `text unique`, pridelené funkciou `next_document_number(doc_type)` |
| Názvy | tabuľky a stĺpce anglicky, snake_case; UI slovensky |
| Migrácie | výhradne `supabase/migrations/*.sql`, žiadne zmeny cez dashboard |
| Prenositeľnosť | čistý PostgreSQL; jediné Supabase špecifiká: `auth.users`, `auth.jwt()`, `storage`, `vault` (zdokumentované v MIGRATION_TO_SELF_HOSTED.md) |

FK pravidlo mazania: ak nie je uvedené inak, `on delete restrict`.

## 1. Enumy

```sql
create type app_role            as enum ('admin','manager','accountant','external');
create type division_code       as enum ('AVENG','AGENCY');
create type job_type            as enum ('ENG','EVENT','PROMO','SEASON','SERVICE');
create type party_kind          as enum ('company','person');
create type inquiry_source      as enum ('email','phone','web','personal','other');
create type inquiry_status      as enum ('new','in_progress','waiting_customer','ready_for_costing','closed','rejected');
create type quote_version_status as enum ('draft','pending_approval','approved','sent','accepted','rejected','expired','superseded');
create type item_type           as enum ('goods','external_service','labor','resource','package','other');
create type pricing_mode        as enum ('none','margin','markup');
create type job_status          as enum ('received','confirmed','planning','in_progress','ready_for_delivery','delivered','invoiced','closed','cancelled');
create type visual_status       as enum ('draft','sent','approved','rejected');
create type supplier_rfq_status as enum ('draft','sent','quoted','selected','closed');
create type po_status           as enum ('draft','sent','confirmed','partially_received','received','cancelled');
create type delivery_doc_kind   as enum ('delivery_note','handover_protocol','service_report');
create type delivery_doc_status as enum ('draft','issued','confirmed','cancelled');
create type invoice_kind        as enum ('invoice','proforma','credit_note');
create type invoice_status      as enum ('draft','issued','sent','partially_paid','paid','overdue','cancelled');
create type received_inv_status as enum ('received','verified','approved_for_payment','paid','disputed');
create type received_inv_source as enum ('manual_pdf','xml_import','peppol_api');
create type payment_direction   as enum ('incoming','outgoing');
create type task_status         as enum ('todo','in_progress','done','blocked');
create type email_direction     as enum ('inbound','outbound');
create type doc_type            as enum ('DOP','CP','ZAK','OD','PRI','DL','FA','ZF','DB','RFQ');
-- DOP dopyt, CP ponuka, ZAK zákazka, OD objednávka dodávateľovi, PRI príjemka,
-- DL doklad dodania, FA faktúra, ZF zálohová faktúra, DB dobropis, RFQ dopyt na dodávateľa
```

## 2. Systém a bezpečnosť

### companies (1 riadok: AV-agency, s.r.o.)
| Stĺpec | Typ | Null | Poznámka |
|---|---|---|---|
| id | uuid | PK | |
| legal_name | text | no | obchodné meno |
| brand_name | text | no | 'Add Value Agency' |
| ico, dic | text | yes | |
| ic_dph | text | yes | null = neplatiteľ |
| vat_payer | boolean | no | default false |
| street, city, zip, country | text | yes | country default 'SK' |
| registry_entry | text | yes | zápis v OR (text na doklady) |
| iban, bank_name, swift | text | yes | |
| email, phone, web | text | yes | |
| logo_document_id | uuid | yes | FK documents |

### divisions
`id`, `code division_code unique`, `name`, `is_active`.

### profiles
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | = `auth.users.id`, `on delete cascade` |
| full_name | text | |
| email | text | |
| phone | text | |
| is_active | boolean | |

### user_roles
`user_id uuid FK profiles on delete cascade`, `role app_role`; PK (user_id, role).

### feature_flags
`key text PK` (napr. `service_cnc`, `ai_legal_summary`, `email_sync`), `enabled boolean default false`, `note`.

### system_settings
`key text PK`, `value jsonb not null`, `description`. Príklady: `min_profit_pct`, `quote_validity_days`, `invoice_due_days`, `notification_emails`, `vat_registration_threshold_cents` (hodnota z aktuálneho znenia zákona – [OVERIŤ]).

### number_series
| Stĺpec | Typ | Poznámka |
|---|---|---|
| doc_type | doc_type | |
| year | int | |
| prefix | text | napr. 'FA' |
| next_number | int | default 1 |
| PK | (doc_type, year) | |

Funkcia `public.next_document_number(p doc_type) returns text` – `select … for update`, formát `PREFIX-RRRR-NNNN` (4 číslice, ak > 9999 → 5). Volá sa len v triggri pri prechode do vystaveného stavu (FA až pri `issued`, ostatné pri vytvorení).

### status_transitions (jadro – pozri ARCHITECTURE_CORE.md)
`entity_table`, `from_status`, `to_status`, `label_sk`, `is_primary`, `required_role app_role`, `guard_fn text`; PK (entity_table, from_status, to_status). Naplnené migráciou podľa tabuliek prechodov v BUSINESS_PROCESSES.md kap. 4. Stav dokladu mení výhradne `public.transition(entity_table, id, to_status, note)`; priama zmena stĺpca `status` je triggerom zakázaná.

### activity_logs
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | bigint identity PK | |
| table_name | text | |
| record_id | uuid | |
| action | text | insert / update / delete / transition |
| old_data, new_data | jsonb | |
| from_status, to_status | text | pri prechode |
| note | text | |
| actor | uuid | `auth.uid()` |
| at | timestamptz | |
Index: (table_name, record_id), (at). Zápis iba triggerom `private.log_change()`; tabuľka je append-only (žiadny UPDATE/DELETE ani pre admina).

### notifications
`id`, `user_id FK profiles`, `type text`, `title`, `body`, `entity_table`, `entity_id`, `read_at`, `emailed_at`. Index (user_id, read_at).

### notification_recipients
`id`, `email text`, `event_types text[]`, `is_active`.

## 3. Dokumenty

### documents
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| entity_table | text | napr. 'jobs', 'invoices' |
| entity_id | uuid | |
| category | text | 'quote_pdf', 'invoice_pdf', 'visual_preview', 'signed_delivery', 'supplier_invoice_xml', 'attachment', 'email_attachment', 'logo', 'content_image' (fáza 3) … – pre `logo` a `content_image` constraint: PNG/JPEG/WebP, najviac 2 MB |
| storage_bucket | text | 'documents' (súkromný) |
| storage_path | text | `RRRR/<entity_table>/<entity_id>/<uuid>-<názov>` |
| file_name, mime_type | text | |
| size_bytes | bigint | |
| sha256 | text | kontrolný súčet |
| version | int | default 1 |
| is_locked | boolean | true pre vygenerované doklady |
| retention_until | date | archivácia |
Index: (entity_table, entity_id). Zamknutý dokument nejde zmazať ani prepísať.

### document_templates
`id`, `code text unique` ('quote', 'order_confirmation', 'purchase_order', 'delivery_note', 'handover_protocol', 'invoice', 'proforma', 'credit_note', 'visual_approval_request'), `name`, `version int`, `content jsonb` (texty, rozloženie), `is_active`.

## 4. Kmeňové dáta

### customers
| Stĺpec | Typ | Null | Poznámka |
|---|---|---|---|
| id | uuid | PK | |
| kind | party_kind | no | company / person |
| name | text | no | |
| ico, dic, ic_dph | text | yes | unique (ico) where ico is not null |
| vat_payer | boolean | no | default false |
| street, city, zip | text | yes | |
| country | char(2) | no | default 'SK' |
| billing_email | text | yes | |
| peppol_id | text | yes | |
| payment_terms_days | int | yes | |
| note | text | yes | |
| is_active | boolean | no | |
Index: trigram na `name` (vyhľadávanie).

### customer_contacts
`id`, `customer_id FK on delete cascade`, `full_name`, `position`, `email`, `phone`, `is_primary`, `is_active`. Index (email) – pre priradenie e-mailov.

### customer_machines  *(feature flag `service_cnc`)*
`id`, `customer_id FK`, `manufacturer`, `model`, `serial_number`, `year_built int`, `control_system text`, `location`, `note`, `is_active`.

### suppliers
Rovnaké stĺpce ako `customers` + `is_foreign boolean generated always as (country <> 'SK') stored`, `categories text[]` (napr. 'potlač', 'catering', 'technika').

### supplier_contacts
Ako `customer_contacts`, FK `supplier_id`.

### units
`code text PK` ('ks','hod','bal','m','m2','kg','km','paušál'), `name`.

### catalog_items
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| code | text unique | interný kód |
| name | text | |
| item_type | item_type | |
| division_id | uuid FK | voliteľne |
| unit_code | text FK units | |
| default_cost_cents | bigint | posledná známa nákupná cena |
| default_supplier_id | uuid FK suppliers | |
| default_pricing_mode | pricing_mode | default 'none' |
| default_pricing_pct | numeric(7,4) | |
| description | text | |
| is_active | boolean | |

### package_components (kusovník balíčka)
`package_item_id FK catalog_items on delete cascade`, `component_item_id FK catalog_items`, `quantity numeric(14,4) > 0`; PK (package_item_id, component_item_id). Check: komponent nesmie byť ten istý balíček. **Jedna úroveň** (rozhodnutie vlastníka, fáza 3): rodič musí mať `item_type = 'package'`, komponent nesmie byť balíček; trigger stráži aj zmenu typu položky.

### labor_roles a labor_rates
- `labor_roles`: `id`, `name` (napr. 'Konzultant', 'Projektový manažér', 'Event koordinátor'), `is_active`.
- `labor_rates`: `id`, `role_id FK`, `cost_rate_cents` (kalkulačná sadzba), `bill_rate_cents`, `valid_from date`, `valid_to date null`; exclusion constraint na prekrývajúce sa obdobia rovnakej roly.

### resources
`id`, `name`, `kind text` ('zariadenie','vozidlo','technika'), `purchase_cost_cents`, `expected_life_hours numeric` (**check > 0**), `operating_cost_per_hour_cents`, `cost_rate_cents` (generovaný stĺpec: `round(purchase ÷ hodiny) + prevádzka/h`, centy, polovica nahor), `bill_rate_cents`, `is_active`.

## 5. Predaj

### inquiries (DOP)
| Stĺpec | Typ | Null | Poznámka |
|---|---|---|---|
| id | uuid | PK | |
| number | text | no | unique, DOP-RRRR-NNNN |
| customer_id | uuid | yes | môže vzniknúť pred založením zákazníka |
| contact_id | uuid | yes | FK customer_contacts |
| division_id | uuid | yes | |
| job_type | job_type | yes | povinné pre `ready_for_costing` |
| title | text | no | |
| description | text | yes | |
| source | inquiry_source | no | |
| email_message_id | uuid | yes | FK email_messages |
| received_at | timestamptz | no | |
| due_date | date | yes | požadovaný termín CP |
| owner_id | uuid | yes | FK profiles |
| status | inquiry_status | no | default 'new' |
| status_note | text | yes | dôvod zamietnutia / čo chýba |
| closed_at | timestamptz | yes | pre KPI |

### supplier_rfqs (dopyt na dodávateľa)
`id`, `number` (RFQ-…), `supplier_id FK`, `inquiry_id FK null`, `job_id FK null` (check: aspoň jedno), `subject`, `description`, `sent_at`, `response_due date`, `status supplier_rfq_status`.

### supplier_quotes
`id`, `rfq_id FK`, `supplier_quote_ref text`, `received_at`, `valid_until`, `total_cents`, `currency`, `note`, `is_selected boolean`.

### supplier_quote_items
`id`, `supplier_quote_id FK on delete cascade`, `description`, `quantity`, `unit_code`, `unit_cost_cents`.

### quotations (CP – obálka)
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| number | text unique | CP-RRRR-NNNN |
| inquiry_id | uuid FK | |
| customer_id | uuid FK | povinné |
| contact_id | uuid FK | |
| division_id | uuid FK | |
| job_type | job_type | |
| title | text | |
| current_version_id | uuid | FK quotation_versions (deferrable) |
| owner_id | uuid FK profiles | |

### quotation_versions
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| quotation_id | uuid FK on delete restrict | |
| version_no | int | unique (quotation_id, version_no) |
| status | quote_version_status | default 'draft' |
| valid_until | date | |
| delivery_terms, payment_terms, intro_text, closing_text | text | |
| total_cost_cents | bigint | prepočítava trigger |
| total_price_cents | bigint | |
| profit_cents | bigint | |
| profit_pct | numeric(7,4) | |
| approved_by, approved_at | | |
| sent_at, sent_to | | |
| customer_decision_at, customer_decision_note | | |
| pdf_document_id | uuid FK documents | |
Trigger: v stave ≠ `draft` sa verzia ani jej položky nedajú meniť.

### quotation_items
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| version_id | uuid FK on delete cascade (len pre draft) | |
| position | int | poradie |
| parent_item_id | uuid FK self | komponent balíčka |
| item_type | item_type | |
| catalog_item_id | uuid FK | voliteľné |
| description | text | |
| quantity | numeric(14,4) | > 0 |
| unit_code | text FK units | |
| supplier_id | uuid FK | |
| supplier_quote_item_id | uuid FK | zdroj ceny |
| labor_role_id | uuid FK | pre `labor` |
| resource_id | uuid FK | pre `resource` |
| hours | numeric(10,2) | pre labor/resource |
| unit_cost_cents | bigint | uložená použitá sadzba/cena |
| pricing_mode | pricing_mode | |
| pricing_pct | numeric(7,4) | check: margin < 100 |
| unit_price_cents | bigint | vypočítané (alebo ručne pri `none`) |
| line_cost_cents, line_price_cents | bigint | |
| is_optional | boolean | voliteľná položka (nezapočíta sa) |
Výpočet: SQL funkcia `private.calc_quote_item()` v triggri (rovnaký vzorec testovaný aj v TypeScripte).

## 6. Objednávky a zákazky

### customer_orders
`id`, `quotation_version_id FK` (musí byť `accepted`), `customer_id FK`, `customer_order_ref text` (číslo objednávky zákazníka), `received_at`, `email_message_id FK null`, `document_id FK null`, `note`.

### jobs (ZAK)
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| number | text unique | ZAK-RRRR-NNNN |
| customer_order_id | uuid FK unique | 1 objednávka = 1 zákazka |
| customer_id | uuid FK | |
| division_id | uuid FK | |
| job_type | job_type | |
| title | text | |
| status | job_status | |
| owner_id | uuid FK | |
| planned_start, planned_end | date | |
| event_date | date | EVENT |
| event_location | text | EVENT |
| machine_id | uuid FK customer_machines | SERVICE |
| baseline_cost_cents, baseline_price_cents | bigint | z akceptovanej CP |
| baseline_locked_at | timestamptz | |
| cancel_reason | text | |
| closed_at | timestamptz | |

### job_budget_lines (baseline)
Kópia `quotation_items` akceptovanej verzie: `id`, `job_id FK`, `source_quote_item_id`, `item_type`, `description`, `quantity`, `unit_code`, `supplier_id`, `unit_cost_cents`, `unit_price_cents`, `line_cost_cents`, `line_price_cents`. Po vytvorení iba na čítanie.

### visual_approvals (PROMO)
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK | |
| version_no | int | unique (job_id, version_no) |
| preview_document_id | uuid FK documents | povinné |
| status | visual_status | |
| sent_at, sent_to | | |
| decided_at | timestamptz | |
| decided_by_name | text | meno zákazníka |
| decision_note | text | |
| evidence_email_id | uuid FK email_messages | dôkaz súhlasu |
| evidence_document_id | uuid FK documents | alternatívny dôkaz |
Check: `approved` vyžaduje `decided_at`, `decided_by_name` a aspoň jeden dôkaz.

## 7. Projekty

### project_tasks
`id`, `job_id FK on delete cascade`, `parent_task_id FK self`, `name`, `description`, `start_date`, `end_date` (check end ≥ start), `is_milestone`, `progress_pct int 0–100`, `status task_status`, `assignee_user_id FK profiles null`, `assignee_supplier_id FK suppliers null`, `planned_hours`, `sort_order`, `billing_milestone boolean` (fakturačný míľnik).

### task_dependencies
`predecessor_id FK project_tasks on delete cascade`, `successor_id FK … cascade`, `lag_days int default 0`; PK (predecessor_id, successor_id); check predecessor ≠ successor; ochrana proti cyklu (trigger).

### time_entries
`id`, `job_id FK`, `task_id FK null`, `user_id FK profiles`, `labor_role_id FK`, `work_date`, `hours numeric(5,2) > 0`, `billable boolean`, `cost_rate_cents` (snapshot), `note`.

## 8. Nákup

### purchase_orders (OD)
`id`, `number` OD-…, `supplier_id FK`, `job_id FK`, `supplier_quote_id FK null`, `status po_status`, `order_date`, `expected_date`, `sent_at`, `delivery_address`, `note`, `total_cents`, `pdf_document_id`.
Trigger: prechod do `sent` pre zákazku typu PROMO vyžaduje `exists visual_approvals where status='approved'`.

### purchase_order_items
`id`, `po_id FK on delete cascade (len draft)`, `job_budget_line_id FK null`, `description`, `quantity`, `unit_code`, `unit_cost_cents`, `line_cost_cents`.

### goods_receipts (PRI)
`id`, `number` PRI-…, `po_id FK`, `received_at`, `supplier_delivery_ref`, `document_id FK null`, `note`.

### goods_receipt_items
`id`, `receipt_id FK cascade`, `po_item_id FK`, `quantity_received > 0`, `actual_unit_cost_cents null`.

## 9. Dodanie

### delivery_documents (DL)
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| number | text unique | DL-RRRR-NNNN |
| kind | delivery_doc_kind | `service_report` iba s feature flagom |
| job_id | uuid FK | |
| customer_id | uuid FK | |
| status | delivery_doc_status | |
| delivery_date | date | |
| delivery_address | text | |
| issued_at | timestamptz | |
| confirmed_at | timestamptz | |
| confirmed_by_name | text | |
| signed_document_id | uuid FK documents | sken/fotka |
| confirmation_email_id | uuid FK email_messages | |
| pdf_document_id | uuid FK | |
| replaces_id | uuid FK self | pri storne |
| note | text | |

### delivery_document_items
`id`, `delivery_document_id FK cascade (len draft)`, `job_budget_line_id FK null`, `description`, `quantity`, `unit_code`, `service_hours null`.

## 10. Fakturácia

### invoices
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| kind | invoice_kind | |
| number | text unique null | pridelené pri `issued` (FA/ZF/DB) |
| variable_symbol | text | z čísla |
| job_id | uuid FK | |
| customer_id | uuid FK | |
| customer_snapshot | jsonb | adresa/IČO v čase vystavenia |
| supplier_snapshot | jsonb | údaje firmy v čase vystavenia |
| issue_date | date | |
| delivery_date | date | dátum dodania |
| due_date | date | |
| currency | char(3) | |
| total_cents | bigint | |
| paid_cents | bigint | prepočet z payments |
| status | invoice_status | |
| corrects_invoice_id | uuid FK self | dobropis |
| proforma_deducted_cents | bigint | odpočet zálohy |
| pdf_document_id | uuid FK | |
| xml_document_id | uuid FK | pripravené pre e-faktúru |
| note | text | |
Kontroly: `issued` → nemenné (okrem `paid_cents`, `status`); unique (number).

### invoice_items
`id`, `invoice_id FK cascade (len draft)`, `position`, `job_budget_line_id FK null`, `delivery_item_id FK null`, `description`, `quantity`, `unit_code`, `unit_price_cents`, `line_total_cents`, `vat_rate numeric null` (null = neplatiteľ).

### received_invoices
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| supplier_id | uuid FK | |
| supplier_invoice_no | text | unique (supplier_id, supplier_invoice_no) |
| variable_symbol | text | |
| issue_date, delivery_date, due_date | date | |
| currency | char(3) | |
| total_cents | bigint | |
| vat_cents | bigint | info od dodávateľa |
| source | received_inv_source | |
| xml_document_id, pdf_document_id | uuid FK | |
| peppol_message_id | text | pre budúce API |
| status | received_inv_status | |
| po_id | uuid FK null | |

### received_invoice_allocations
`received_invoice_id FK cascade`, `job_id FK`, `amount_cents`; PK (received_invoice_id, job_id). Check: súčet ≤ total.

### payments
`id`, `direction payment_direction`, `invoice_id FK null`, `received_invoice_id FK null` (check: práve jedno), `paid_at date`, `amount_cents > 0`, `method text` ('bank','cash','card'), `bank_reference`, `note`. Trigger prepočíta `paid_cents` a stav faktúry.

## 11. E-mail

### email_accounts
`id`, `email_address unique`, `display_name`, `imap_host`, `imap_port`, `smtp_host`, `smtp_port`, `username`, `vault_secret_id uuid` (heslo v Supabase Vault, nikdy v tabuľke), `sync_enabled`, `last_synced_at`, `last_uid bigint`, `last_error text`.

### email_messages
| Stĺpec | Typ | Poznámka |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK | |
| direction | email_direction | |
| message_id | text | unique (account_id, message_id) |
| in_reply_to | text | vlákno |
| from_address | text | |
| to_addresses, cc_addresses | text[] | |
| subject | text | |
| body_text | text | |
| body_html_document_id | uuid FK documents | HTML uložené ako súbor |
| sent_at | timestamptz | |
| customer_id, supplier_id | uuid FK null | auto-priradenie |
| inquiry_id, quotation_id, job_id, purchase_order_id, invoice_id | uuid FK null | auto/ručné priradenie |
| assignment_status | text | 'auto','manual','unassigned','ignored' |
Index: (from_address), (job_id), (sent_at desc), fulltext na subject+body_text.

### email_attachments
`email_message_id FK cascade`, `document_id FK documents`; PK oboch.

## 12. Legislatíva a validácia

### legal_watchlist
`id`, `code` (napr. '222/2004'), `title`, `source_url`, `last_version_ref text`, `last_checked_at`, `last_check_ok boolean`, `is_active`.

### legal_changes
`id`, `watchlist_id FK`, `detected_at`, `version_ref`, `source_url`, `ai_summary text null` (flag `ai_legal_summary`), `acknowledged_by FK profiles`, `acknowledged_at`, `action_note`.

### validation_rules
`id`, `rule_key text` (implementované v kóde), `doc_type doc_type`, `description`, `legal_basis text`, `severity text` ('error' blokuje, 'warning' upozorní), `valid_from date`, `valid_to date null`, `is_active`. Unique (rule_key, valid_from).

### validation_results
`id`, `entity_table`, `entity_id`, `rule_key`, `severity`, `message`, `checked_at`. (história kontrol pri vystavení dokladu)

## 13. Pohľady (views) pre dashboard

| View | Obsah |
|---|---|
| `v_job_economics` | baseline vs. skutočnosť na zákazku (náklady z OD/príjmov/prijatých faktúr/hodín, tržby z faktúr) |
| `v_open_items` | počty: nové dopyty, CP na schválenie, čakajúce vizuály, omeškané úlohy, nevyfakturované dodané zákazky, faktúry po splatnosti |
| `v_receivables` | neuhradené vydané faktúry, dni po splatnosti |
| `v_payables` | neuhradené prijaté faktúry |
| `v_turnover_ytd` | obrat za 12 mesiacov – sledovanie limitu registrácie DPH |
| `v_kpi_services` | podklady KPI S1–S8 (projekt W) – neskôr |

Pohľady s `security_invoker = true`, aby rešpektovali RLS.

## 14. Row Level Security

1. RLS zapnuté na **všetkých** tabuľkách v `public`.
2. Na každej tabuľke **reštriktívna** politika 2FA:
   ```sql
   create policy "require_aal2" on <table> as restrictive to authenticated
     using ((select auth.jwt()->>'aal') = 'aal2')
     with check ((select auth.jwt()->>'aal') = 'aal2');
   ```
3. Pomocná funkcia `private.has_role(app_role) returns boolean` (security definer, `stable`).
4. Permisívne politiky podľa roly:

| Rola | Prístup |
|---|---|
| admin | všetko (select/insert/update; delete len tam, kde ho dovolí trigger) |
| manager | všetko okrem `system_settings`, `user_roles`, `email_accounts`, `validation_rules`; nevidí `labor_rates.cost_rate_cents` (cez view) – pripravené, v MVP nepoužité |
| accountant | select: invoices, invoice_items, received_invoices, payments, customers, suppliers, documents (kategórie faktúr) – pripravené |
| external | select/update vlastných `project_tasks`, insert `time_entries` – pripravené |

5. `anon` nemá prístup k ničomu.
6. Storage bucket `documents` súkromný; politiky podľa `documents` (prístup iba cez podpísané URL generované po kontrole RLS).
7. `service_role` iba v Edge Functions (PDF, e-mail, plánované úlohy), nikdy vo frontende.
8. Každá politika má pgTAP test (prístup s aal1 = nič; admin s aal2 = áno; neprihlásený = nič).

## 15. Triggery a funkcie (prehľad)

| Funkcia | Účel |
|---|---|
| `private.set_updated()` | updated_at / updated_by |
| `private.log_change()` | zápis do activity_logs |
| `public.transition(entity_table, id, to_status, note)` | jediný spôsob zmeny stavu: overí `status_transitions`, rolu a `guard_fn`, zapíše audit, vráti ďalšie možné kroky |
| `private.block_direct_status_update()` | zakáže zmenu `status` mimo `transition()` |
| `public.next_document_number(doc_type)` | číslovanie s uzamknutím riadku |
| `private.lock_issued()` | zákaz zmien vystavených dokladov |
| `private.calc_quote_item()` / `private.recalc_quote_totals()` | kalkulácia |
| `public.accept_quote_version(version_id, order_ref, received_at)` | atómovo: verzia → accepted, objednávka, zákazka, baseline |
| `public.issue_invoice(invoice_id)` | validácia + číslo + zámok |
| `private.check_promo_visual()` | blokuje odoslanie OD bez schváleného vizuálu |
| `private.recalc_invoice_payments()` | paid_cents a stav |
| `private.prevent_task_cycle()` | Gantt bez cyklov |

## 16. Plánované úlohy (pg_cron / Edge Functions)

| Úloha | Frekvencia |
|---|---|
| Expirácia CP, faktúry po splatnosti | denne 06:00 |
| Synchronizácia e-mailu | každých 5–15 min (overiť limity) |
| Kontrola Slov-Lex | denne |
| Notifikácie termínov | denne |
| Export zálohy (pg_dump + súbory) | denne – fáza 7 |

## 17. Otvorené otázky k schéme

| # | Otázka | Predvolené |
|---|---|---|
| S1 | Formát čísla: 4 číslice (CP-2026-0001) stačí? | áno |
| S2 | Variabilný symbol = číslo faktúry bez pomlčiek (napr. 20260001)? | áno |
| S3 | Zálohové faktúry budete vystavovať? | pripravené |
| S4 | Môže mať zákazka viac objednávok (dodatky)? | nie – dodatok = nová CP verzia pred prijatím, po prijatí nová zákazka |

## 18. Doplnok 26. 11. 2026 – reporting, hodnotenie partnerov, dokumenty

### overhead_costs (réžia)
`id`, `month date` (1. deň mesiaca), `division_id FK null` (null = spoločná), `category text`, `amount_cents bigint`, `note`. Unique **nulls not distinct** (month, division_id, category) – inak by sa dala vložiť duplicitná spoločná réžia.

### income_tax_brackets (sadzby dane z príjmov PO)
`id`, `valid_from date`, `valid_to date null`, `revenue_from_cents bigint`, `revenue_to_cents bigint null`, `rate_pct numeric(7,4)`, `source_note text`. Hodnoty sa zadávajú migráciou/nastavením podľa aktuálneho zákona a overujú s účtovníkom – nikdy v kóde.

### capacity_plans (dostupné hodiny pre utilizáciu)
`id`, `user_id FK profiles`, `month date`, `available_hours numeric(6,2)`. Unique (user_id, month).

### nonconformities (nezhody a reklamácie)
`id`, `number` (NZ-RRRR-NNNN), `party_type text` ('customer','supplier','internal'), `customer_id FK null`, `supplier_id FK null`, `job_id FK null`, `purchase_order_id FK null`, `reported_at`, `description`, `severity text` ('low','medium','high'), `cost_cents bigint`, `action_taken text`, `status text` ('open','resolved'), `resolved_at`.

### partner_ratings (ručné hodnotenie)
`id`, `party_type text` ('customer','supplier'), `customer_id FK null`, `supplier_id FK null`, `job_id FK null`, `rated_at`, `rated_by FK profiles`, `scores jsonb` (napr. `{"quality":4,"on_time":5,"price":3,"communication":4}` – kritériá podľa typu partnera), `note`. Check: práve jeden z customer_id/supplier_id.

### kpi_targets
`id uuid PK`, `kpi_key text`, `division_id FK null` (null = Spolu), `target_value numeric`, `warning_value numeric`, `direction text` ('higher_better','lower_better'), `valid_from date`. Unique **nulls not distinct** (kpi_key, division_id, valid_from). (Upresnené vo fáze 3: stĺpec s NULL nemôže byť v primárnom kľúči.) Hranica upozornenia leží na horšej strane cieľa.

### content_blocks (knižnica obsahu pre prezentácie)
`id`, `key text` (napr. 'about_company', 'service_ENG', 'service_PROMO'), `division_id FK null`, `job_type job_type null`, `title`, `body text` (markdown), `image_document_ids uuid[]` (len dokumenty kategórie `content_image`), `language char(2) default 'sk'`, `is_active`, `version int` (zvyšuje trigger pri zmene textu alebo obrázkov). Unique (key, language).

### references (referencie / case studies)
`id`, `job_id FK`, `customer_id FK`, `title`, `challenge`, `solution`, `result`, `image_document_ids uuid[]`, `customer_consent boolean not null default false`, `consent_document_id FK documents null`, `is_publishable boolean generated always as (customer_consent) stored`.

### document_templates – rozšírenie kódov
`company_presentation_quote`, `company_presentation_general`, `service_catalog`, `reference_sheet`, `job_summary`, `reminder`, `goods_receipt`, `supplier_rfq`, `dashboard_report`, `partner_scorecard`, `kpi_report`.

### Nové pohľady
| View | Obsah |
|---|---|
| `v_finance_monthly` | po mesiacoch a divíziách: tržby, priame náklady, hrubý zisk, réžia, prevádzkový zisk, odhad dane |
| `v_customer_kpi` | KPI zákazníka (kap. 13.1) |
| `v_supplier_kpi` | KPI dodávateľa (kap. 13.2) |
| `v_partner_score` | vážené skóre a kategória A/B/C |
| `v_process_kpi` | procesné KPI (kap. 14) s cieľmi z `kpi_targets` |
| `v_receivables_aging` | vekové pásma pohľadávok |

`doc_type` enum rozšíriť o `NZ` (nezhoda).
