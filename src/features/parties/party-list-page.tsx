"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { RequireRole } from "@/core/auth/require-role";
import { ChipGroup } from "@/ui/chips";
import { DataTable, type Column } from "@/ui/data-table";
import { EmptyState } from "@/ui/empty-state";
import { FormMessage, Input } from "@/ui/field";
import { StatusBadge } from "@/ui/status-badge";
import { Tile } from "@/ui/tile";
import { buttonClass } from "@/ui/button";
import { useParties, type Party } from "./api";
import { PARTY_TEXT, type PartyKind } from "./schema";

function columns(kind: PartyKind): Column<Party>[] {
  const cols: Column<Party>[] = [
    { key: "name", header: "Názov", cell: (p) => p.name },
    { key: "ico", header: "IČO", cell: (p) => p.ico ?? "—", className: "tabular-nums" },
    { key: "city", header: "Mesto", cell: (p) => p.city ?? "—" },
    {
      key: "country",
      header: "Krajina",
      cell: (p) =>
        kind === "suppliers" && p.is_foreign ? (
          <span className="inline-flex items-center gap-2">
            {p.country}
            <StatusBadge label="Zahraničný" tone="warning" />
          </span>
        ) : (
          p.country
        ),
    },
  ];
  if (kind === "suppliers") {
    cols.push({
      key: "categories",
      header: "Kategórie",
      cell: (p) => (p.categories?.length ? p.categories.join(", ") : "—"),
      hideOnMobile: true,
    });
  }
  cols.push({
    key: "state",
    header: "Stav",
    cell: (p) =>
      p.is_active ? (
        <StatusBadge label="Aktívny" tone="success" />
      ) : (
        <StatusBadge label="Neaktívny" />
      ),
  });
  return cols;
}

function PartyList({ kind }: { kind: PartyKind }) {
  const text = PARTY_TEXT[kind];
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const deferred = useDeferredValue(search);
  const list = useParties(kind, { search: deferred, showInactive });

  return (
    <Tile
      size="XL"
      title={text.many}
      action={
        <Link href={`${text.href}detail/?id=new`} className={buttonClass()}>
          + {text.newLabel}
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label={`Hľadať – ${text.many.toLowerCase()}`}
          placeholder="Hľadať podľa názvu, mesta alebo IČO"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <ChipGroup
          label="Zobraziť"
          options={[
            { value: "active", label: "Aktívni" },
            { value: "all", label: "Všetci" },
          ]}
          value={showInactive ? "all" : "active"}
          onChange={(v) => setShowInactive(v === "all")}
        />
      </div>
      {list.error && <FormMessage tone="error">{list.error.message}</FormMessage>}
      {list.isPending ? (
        <div aria-hidden className="flex animate-pulse flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-canvas h-12 rounded-xl" />
          ))}
        </div>
      ) : (
        <DataTable
          caption={text.many}
          columns={columns(kind)}
          rows={list.data ?? []}
          rowKey={(p) => p.id}
          rowHref={(p) => `${text.href}detail/?id=${p.id}`}
          empty={
            <EmptyState
              title={search ? "Nič sa nenašlo" : `Zatiaľ žiadni ${text.many.toLowerCase()}`}
              description={
                search
                  ? "Skúste iný názov alebo IČO."
                  : "Začnite tlačidlom vpravo hore. Údaje firiem (názov, IČO, adresa) sú verejné z obchodného registra."
              }
            />
          }
        />
      )}
    </Tile>
  );
}

export function PartyListPage({ kind }: { kind: PartyKind }) {
  return (
    <RequireRole role="admin">
      <PartyList kind={kind} />
    </RequireRole>
  );
}
