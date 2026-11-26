import { TriangleAlert } from "lucide-react";
import { FOREIGN_SUPPLIER_WARNING } from "../schema";

/** Shown for every supplier outside Slovakia – in the form and on the detail (O4, verify with the accountant). */
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
