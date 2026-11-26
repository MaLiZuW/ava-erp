"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/ui/empty-state";
import { BentoGrid, Tile } from "@/ui/tile";
import { useAuth } from "./auth-provider";
import { hasRole, type AppRole } from "./status";

export function useHasRole(role: AppRole): boolean {
  const { roles } = useAuth();
  return hasRole(roles, role);
}

/**
 * Hides UI the role may not use. Security is enforced by RLS in the database;
 * this only keeps the screen honest.
 */
export function RequireRole({
  role,
  children,
  fallback,
}: {
  role: AppRole;
  children: ReactNode;
  /** what to show instead; default = "no access" tile, `null` = render nothing */
  fallback?: ReactNode;
}) {
  const allowed = useHasRole(role);
  if (allowed) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <BentoGrid>
      <Tile size="L" title="Prístup">
        <EmptyState
          title="Nemáte oprávnenie"
          description="Táto časť je dostupná len pre administrátora."
        />
      </Tile>
    </BentoGrid>
  );
}
