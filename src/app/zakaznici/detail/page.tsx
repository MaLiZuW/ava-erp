"use client";

import { Suspense } from "react";
import { PartyDetailPage } from "@/features/parties/party-detail-page";

// static export: the record id comes from ?id= (no dynamic segments) – CLAUDE.md
export default function Page() {
  return (
    <Suspense>
      <PartyDetailPage kind="customers" />
    </Suspense>
  );
}
