/**
 * Known notification event types – one list for the UI and the DB check
 * (notification_recipients_known_events). Sending arrives in phase 8 (TODO.md).
 */
export const NOTIFICATION_EVENTS = [
  { value: "data_review_due", label: "Dáta na overenie (po termíne a do 30 dní)" },
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]["value"];
