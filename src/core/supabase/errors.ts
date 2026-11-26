/** Postgres / PostgREST error code → Slovak message for one specific situation. */
export type DbMessages = Partial<Record<string, string>>;

/** PostgREST / Postgres error → Slovak message. Raw database messages are never shown. */
export function dbErrorMessage(
  error: { code?: string } | null | undefined,
  messages: DbMessages = {},
): string {
  const specific = error?.code ? messages[error.code] : undefined;
  if (specific) return specific;
  switch (error?.code) {
    case "42501":
    case "PGRST301":
      return "Na túto akciu nemáte oprávnenie alebo vypršalo prihlásenie.";
    case "23505":
      return "Taký záznam už existuje.";
    case "23P01":
      return "Obdobie sa prekrýva s iným záznamom.";
    case "23514":
    case "22P02":
    case "23502":
      return "Hodnota nespĺňa pravidlá databázy. Skontrolujte vyplnené údaje.";
    case "23503":
      return "Záznam sa používa inde, preto ho nemožno zmeniť.";
    default:
      return "Uloženie sa nepodarilo. Skúste to znova.";
  }
}

/** Throws a plain Error carrying the Slovak message (for TanStack Query). */
export function throwDb(error: { code?: string } | null | undefined, messages?: DbMessages): never {
  throw new Error(dbErrorMessage(error, messages));
}
