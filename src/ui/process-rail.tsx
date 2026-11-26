import { cn } from "./cn";

/** Process axis – docs/DESIGN_SYSTEM.md §6.2. */
export const PROCESS_STEPS = [
  "Dopyt",
  "Ponuka",
  "Objednávka",
  "Vizuál",
  "Nákup",
  "Dodanie",
  "Faktúra",
  "Úhrada",
  "Archív",
] as const;

/** `current` = index of the active step; earlier steps are done, later ones are pending. */
export function ProcessRail({
  current,
  steps = PROCESS_STEPS,
}: {
  current?: number;
  steps?: readonly string[];
}) {
  return (
    <nav aria-label="Priebeh procesu">
      <ol className="flex flex-wrap gap-x-6 gap-y-2">
        {steps.map((step, i) => {
          const state =
            current == null ? "todo" : i < current ? "done" : i === current ? "current" : "todo";
          const srText =
            state === "done" ? " (hotovo)" : state === "current" ? " (aktuálny krok)" : " (čaká)";
          return (
            <li
              key={step}
              aria-current={state === "current" ? "step" : undefined}
              data-state={state}
              className={cn(
                "flex items-center gap-2 text-[13px] leading-5 font-medium",
                state === "todo" ? "text-neutral-500" : "text-navy",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-3 rounded-full border-2",
                  state === "done" && "border-navy bg-navy",
                  state === "current" && "border-brand ring-brand/30 bg-white ring-2",
                  state === "todo" && "border-neutral-200 bg-white",
                )}
              />
              {step}
              <span className="sr-only">{srText}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
