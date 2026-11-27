import { TriangleAlert } from "lucide-react";

/** O4: purchases from abroad – possible VAT registration duty; verify with the accountant. */
export const FOREIGN_SUPPLIER_WARNING =
  "Možná registračná povinnosť DPH (§ 7, § 7a) – overiť s účtovníkom.";

/** Shown for every supplier outside Slovakia – supplier form and detail, catalog import. */
export function ForeignSupplierNotice() {
  return (
    <p
      role="note"
      data-testid="foreign-supplier-warning"
      className="border-warning/40 text-warning flex items-start gap-2 rounded-xl border px-3 py-2 text-[15px] font-medium"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span>
        <span className="sr-only">Upozornenie: </span>Zahraničný dodávateľ.{" "}
        {FOREIGN_SUPPLIER_WARNING}
      </span>
    </p>
  );
}
