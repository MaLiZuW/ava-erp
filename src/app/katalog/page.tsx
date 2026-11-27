"use client";

import { Suspense } from "react";
import { CatalogPage } from "@/features/catalog/catalog-page";

export default function Page() {
  return (
    <Suspense>
      <CatalogPage />
    </Suspense>
  );
}
