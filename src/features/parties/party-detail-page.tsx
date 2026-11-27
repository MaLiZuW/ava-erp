"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RequireRole } from "@/core/auth/require-role";
import { useAttachmentQueue } from "@/core/attachments/api";
import { AttachmentsTile, NewRecordAttachments } from "@/core/attachments/attachments-tile";
import { RecordHistoryTile } from "@/core/record-history";
import { useFeatureFlag } from "@/core/shared-queries";
import type { AuditEntry } from "@/ui/audit-timeline";
import { Button } from "@/ui/button";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { EmptyState } from "@/ui/empty-state";
import { FormMessage } from "@/ui/field";
import { StatusBadge } from "@/ui/status-badge";
import { BentoGrid, Tile } from "@/ui/tile";
import { useContacts, useParty, useSetPartyActive, type Party } from "./api";
import { ContactsTile } from "./components/contacts-tile";
import { ForeignSupplierNotice } from "./components/foreign-supplier-notice";
import { MachinesTile } from "./components/machines-tile";
import { PartyForm } from "./components/party-form";
import {
  ATTACHMENT_FIELD_LABELS,
  CONTACT_FIELD_LABELS,
  MACHINE_FIELD_LABELS,
  PARTY_FIELD_LABELS,
  PARTY_TEXT,
  type PartyKind,
} from "./schema";

/** Detail pages need a stretchable grid (forms and lists grow with their content). */
const GRID = "md:auto-rows-[minmax(160px,auto)]";

function DataTile({ kind, party }: { kind: PartyKind; party: Party }) {
  const rows: [string, string | null | undefined][] = [
    ["Typ", party.kind === "person" ? "Fyzická osoba" : "Firma"],
    ["IČO", party.ico],
    ["DIČ", party.dic],
    ["IČ DPH", party.ic_dph],
    ["Platiteľ DPH", party.vat_payer ? "áno" : "nie"],
    [
      "Adresa",
      [party.street, [party.zip, party.city].filter(Boolean).join(" "), party.country]
        .filter(Boolean)
        .join(", "),
    ],
    ["Fakturačný e-mail", party.billing_email],
    ["Splatnosť", party.payment_terms_days == null ? null : `${party.payment_terms_days} dní`],
  ];
  if (kind === "suppliers") rows.push(["Kategórie", party.categories?.join(", ")]);
  return (
    <Tile size="L" title="Údaje" className="md:row-span-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-700">{label}</dt>
            <dd className="min-w-0 break-words">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {party.note && (
        <p className="mt-4 border-t border-neutral-200 pt-3 text-[15px] whitespace-pre-line">
          {party.note}
        </p>
      )}
    </Tile>
  );
}

function Detail({ kind, id }: { kind: PartyKind; id: string }) {
  const text = PARTY_TEXT[kind];
  const party = useParty(kind, id);
  const contacts = useContacts(kind, id);
  const setActive = useSetPartyActive(kind);
  const machinesOn = useFeatureFlag("service_cnc");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (party.isPending) {
    return (
      <BentoGrid>
        <Tile size="HERO">
          <div aria-hidden className="bg-canvas h-10 w-1/2 animate-pulse rounded-xl" />
        </Tile>
      </BentoGrid>
    );
  }
  if (party.error) return <FormMessage tone="error">{party.error.message}</FormMessage>;
  if (!party.data) {
    return (
      <BentoGrid>
        <Tile size="L" title={text.one}>
          <EmptyState title="Záznam sa nenašiel" description="Mohol byť zadaný zlý odkaz.">
            <Link href={text.href} className="text-navy font-medium underline">
              Späť na zoznam
            </Link>
          </EmptyState>
        </Tile>
      </BentoGrid>
    );
  }

  const p = party.data;
  const childIds = [id, ...(contacts.data ?? []).map((c) => c.id)];
  const recordLabel = (e: AuditEntry) =>
    e.table_name === text.contactsTable
      ? `Kontakt: ${String(((e.new_data ?? e.old_data) as { full_name?: string } | null)?.full_name ?? "")}`
      : e.table_name === "documents"
        ? `Príloha: ${String(((e.new_data ?? e.old_data) as { file_name?: string } | null)?.file_name ?? "")}`
        : e.table_name === "customer_machines"
          ? "Stroj"
          : text.one;

  return (
    <div className="flex flex-col gap-4">
      <BentoGrid>
        <Tile size="HERO" title={text.one}>
          <div className="flex h-full flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-navy text-[32px] leading-10 font-semibold break-words">
                  {p.name}
                </p>
                {p.is_active ? (
                  <StatusBadge label="Aktívny" tone="success" />
                ) : (
                  <StatusBadge label="Neaktívny" />
                )}
                {kind === "suppliers" && p.is_foreign && (
                  <StatusBadge label="Zahraničný" tone="warning" />
                )}
              </div>
              <p className="text-[15px] text-neutral-700 tabular-nums">
                {[p.ico && `IČO ${p.ico}`, p.city].filter(Boolean).join(" · ")}
              </p>
            </div>
            {!editing && <Button onClick={() => setEditing(true)}>Upraviť údaje</Button>}
          </div>
        </Tile>
      </BentoGrid>
      {kind === "suppliers" && p.is_foreign && <ForeignSupplierNotice />}
      <BentoGrid className={GRID}>
        {editing ? (
          <PartyForm
            kind={kind}
            party={p}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <DataTile kind={kind} party={p} />
        )}
        <ContactsTile kind={kind} partyId={id} />
        {kind === "customers" && machinesOn && <MachinesTile customerId={id} />}
        <AttachmentsTile entityTable={kind} entityId={id} size="XL" />
        <Tile size="M" title="Stav">
          <div className="flex flex-col items-start gap-3">
            <p className="text-[15px] text-neutral-700">
              {p.is_active
                ? "Neaktívny záznam sa nezobrazuje v zoznamoch na výber, história ostáva."
                : "Záznam je neaktívny. Aktiváciou sa znova zobrazí na výber."}
            </p>
            <Button variant="secondary" onClick={() => setConfirm(true)}>
              {p.is_active ? "Deaktivovať" : "Aktivovať"}
            </Button>
            {setActive.error && <FormMessage tone="error">{setActive.error.message}</FormMessage>}
          </div>
        </Tile>
      </BentoGrid>
      {/* change history is always the last section of the page (DESIGN_SYSTEM §1) */}
      <RecordHistoryTile
        tables={[
          kind,
          text.contactsTable,
          "documents",
          ...(kind === "customers" ? ["customer_machines"] : []),
        ]}
        recordIds={childIds}
        attachmentsOf={id}
        fieldLabels={{
          [kind]: PARTY_FIELD_LABELS,
          [text.contactsTable]: CONTACT_FIELD_LABELS,
          customer_machines: MACHINE_FIELD_LABELS,
          documents: ATTACHMENT_FIELD_LABELS,
        }}
        recordLabel={recordLabel}
      />
      <ConfirmDialog
        open={confirm}
        title={p.is_active ? `Deaktivovať – ${p.name}?` : `Aktivovať – ${p.name}?`}
        confirmLabel={p.is_active ? "Deaktivovať" : "Aktivovať"}
        busy={setActive.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          setActive.mutate({ id, is_active: !p.is_active }, { onSettled: () => setConfirm(false) })
        }
      >
        {p.is_active
          ? "Záznam sa nezmaže. Zmizne zo zoznamov na výber, údaje aj história ostanú zachované."
          : "Záznam sa znova zobrazí v zoznamoch na výber."}
      </ConfirmDialog>
    </div>
  );
}

function NewParty({ kind }: { kind: PartyKind }) {
  const router = useRouter();
  const text = PARTY_TEXT[kind];
  const queue = useAttachmentQueue();
  // saved, but some files failed: the form stays with "Nahrať znova"
  const [saved, setSaved] = useState<Party | null>(null);
  const finish = async (row: Party) => {
    setSaved(row);
    const { failed } = await queue.run(kind, row.id);
    if (failed === 0) router.replace(`${text.href}detail/?id=${row.id}`);
  };
  return (
    <BentoGrid className={GRID}>
      <PartyForm
        kind={kind}
        party={saved}
        onSaved={(row) => void finish(row)}
        onCancel={() => router.push(text.href)}
      />
      <Tile size="HERO" title="Prílohy">
        <NewRecordAttachments queue={queue} retry={saved ? () => void finish(saved) : undefined} />
      </Tile>
    </BentoGrid>
  );
}

function DetailRoute({ kind }: { kind: PartyKind }) {
  const id = useSearchParams().get("id");
  if (id === "new") return <NewParty kind={kind} />;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return (
      <EmptyState title="Chýba odkaz na záznam">
        <Link href={PARTY_TEXT[kind].href} className="text-navy font-medium underline">
          Späť na zoznam
        </Link>
      </EmptyState>
    );
  }
  return <Detail key={id} kind={kind} id={id} />;
}

/** /zakaznici/detail/?id=… and /dodavatelia/detail/?id=… (`id=new` opens an empty form). */
export function PartyDetailPage({ kind }: { kind: PartyKind }) {
  return (
    <RequireRole role="admin">
      <DetailRoute kind={kind} />
    </RequireRole>
  );
}
