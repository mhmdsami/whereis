export interface Stop {
  from: string;
  to: string;
  city: string;
  country: string;
}

export interface SiteState {
  stops: Array<Stop>;
}

/** Where the last good document is kept. Implemented by the platform adapter. */
export interface SnapshotStore {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

export interface Reading {
  state: SiteState;
  /** When the document was fetched from the source, not when it was rendered. */
  readAt: Date;
  /** True when the live fetch failed and this came from the snapshot. */
  fromCache: boolean;
}

/** A snapshot older than this is treated as no snapshot at all. */
const MAX_SNAPSHOT_AGE_MS = 12 * 60 * 60 * 1000;

export const DEFAULT_STATE_URL =
  "https://gist.githubusercontent.com/sm-sami/1a450cdd0cdb863fe52d5b8f69edeead/raw/state.json";

export const TIME_ZONE = "Asia/Kolkata";

/** IST has no daylight saving, so the offset is stable and safe to print. */
export const TIME_ZONE_LABEL = "UTC+5:30";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function today(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** The stop covering `date`, with the latest start winning on overlapping days. */
export function activeStop(stops: Array<Stop> | undefined, date = new Date()): Stop | null {
  if (!stops?.length) return null;

  const day = today(date);
  return (
    [...stops]
      .sort((a, b) => a.from.localeCompare(b.from))
      .filter((stop) => stop.from <= day && day <= stop.to)
      .at(-1) ?? null
  );
}

/** The most recent stop that has already ended, for when nothing is active. */
export function lastStop(stops: Array<Stop> | undefined, date = new Date()): Stop | null {
  if (!stops?.length) return null;

  const day = today(date);
  return (
    [...stops]
      .filter((stop) => stop.to < day)
      .sort((a, b) => a.to.localeCompare(b.to) || a.from.localeCompare(b.from))
      .at(-1) ?? null
  );
}

/**
 * Where the person lands after the stop that covers `date`. Boundary days are shared
 * between stops, so this looks at the day after the current stop ends rather than at
 * the current stop's end date.
 */
export function nextStop(stops: Array<Stop> | undefined, date = new Date()): Stop | null {
  if (!stops?.length) return null;

  const current = activeStop(stops, date);
  const base = current ? current.to : today(date);
  const following = activeStop(stops, atDay(dayAfter(base)));

  if (following) return following;

  return (
    [...stops]
      .filter((stop) => stop.from > base)
      .sort((a, b) => a.from.localeCompare(b.from))
      .at(0) ?? null
  );
}

function atDay(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function dayAfter(iso: string): string {
  const date = atDay(iso);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Parses the document whole: one malformed stop invalidates it rather than half a schedule. */
export function parseState(value: unknown): SiteState | null {
  if (typeof value !== "object" || value === null) return null;

  const raw = value as { stops?: unknown };
  if (!Array.isArray(raw.stops)) return null;

  const stops = raw.stops.flatMap<Stop>((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { from, to, city, country } = entry as Record<string, unknown>;
    if (typeof from !== "string" || !isDay(from)) return [];
    if (typeof to !== "string" || !isDay(to)) return [];
    if (typeof city !== "string" || typeof country !== "string") return [];
    return [{ from, to, city, country }];
  });

  if (stops.length !== raw.stops.length) return null;

  return { stops };
}

export async function fetchSiteState(source = DEFAULT_STATE_URL): Promise<SiteState | null> {
  try {
    const bucket = Math.floor(Date.now() / 60_000);
    const join = source.includes("?") ? "&" : "?";
    const response = await fetch(`${source}${join}v=${bucket}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return parseState(await response.json());
  } catch (error) {
    console.warn(`state unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** Live read when possible, last good read when not, nothing when neither. */
export async function loadState(source: string | undefined, store: SnapshotStore): Promise<Reading | null> {
  const state = await fetchSiteState(source);

  if (state) {
    const readAt = new Date();
    try {
      await store.write(JSON.stringify({ readAt: readAt.getTime(), state }));
    } catch {}
    return { state, readAt, fromCache: false };
  }

  return readSnapshot(store);
}

async function readSnapshot(store: SnapshotStore): Promise<Reading | null> {
  try {
    const raw = await store.read();
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { readAt?: unknown; state?: unknown };
    if (typeof parsed.readAt !== "number") return null;
    if (Date.now() - parsed.readAt > MAX_SNAPSHOT_AGE_MS) return null;

    const state = parseState(parsed.state);
    if (!state) return null;

    return { state, readAt: new Date(parsed.readAt), fromCache: true };
  } catch {
    return null;
  }
}
