import { BentoGrid, Tile } from "./tile";
import { EmptyState } from "./empty-state";

/** Placeholder for modules that arrive in later phases. */
export function ComingSoon({ module }: { module: string }) {
  return (
    <BentoGrid>
      <Tile size="L" title={module}>
        <EmptyState
          title="Pripravujeme"
          description="Tento modul bude dostupný v niektorej z ďalších fáz projektu."
        />
      </Tile>
    </BentoGrid>
  );
}
