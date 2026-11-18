const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** First Accept-Language tag the runtime can format, otherwise English. */
export function resolveLocale(header: string | null): string {
  if (!header) return "en";

  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim();
    if (!tag || tag === "*") continue;
    try {
      if (Intl.DateTimeFormat.supportedLocalesOf(tag).length > 0) return tag;
    } catch {}
  }

  return "en";
}

/** Formats a calendar date in the visitor's locale without shifting its day. */
export function formatDay(iso: string, locale: string, withYear: boolean): string {
  if (!DAY.test(iso)) return iso;

  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(date);
}

/** How stale the reading is, in the house voice. English on purpose. */
export function since(date: Date, now = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return ago(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return ago(hours, "hour");

  return ago(Math.floor(hours / 24), "day");
}

function ago(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}
