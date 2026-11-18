import { headers } from "next/headers";
import { formatDay, resolveLocale, since } from "@/lib/format";
import { activeStop, lastStop, loadState, TIME_ZONE_LABEL, today } from "@/lib/state";
import { platform } from "@/platform";

export const dynamic = "force-dynamic";

const label = "font-mono text-xs uppercase tracking-[0.18em]";

export default async function Page() {
  const reading = await loadState(platform.env().stateUrl, platform.snapshot);
  const locale = resolveLocale((await headers()).get("accept-language"));
  const day = today();

  const state = reading?.state ?? null;
  const current = activeStop(state?.stops);
  const past = current ? null : lastStop(state?.stops);
  const stop = current ?? past;
  const withYear = stop ? stop.to.slice(0, 4) !== day.slice(0, 4) : false;
  const freshness = reading
    ? reading.fromCache
      ? `last good read ${since(reading.readAt)}`
      : `checked ${since(reading.readAt)}`
    : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 py-8">
      <header className="font-mono text-xs text-text-tertiary">
        <span>where is sami?</span>
      </header>

      <div className="flex flex-1 flex-col justify-center py-16">
        {!state ? (
          <>
            <p className={`${label} text-text-tertiary`}>Status</p>
            <h1 className="mt-3 font-mono text-2xl text-text-secondary">location unavailable</h1>
          </>
        ) : stop ? (
          <>
            <p className={`${label} ${current ? "text-primary" : "text-text-tertiary"}`}>
              {current ? "Now" : "Last seen"}
            </p>
            <h1
              className={`mt-3 font-mono text-4xl font-medium tracking-tight sm:text-5xl ${
                current ? "text-foreground" : "text-text-secondary"
              }`}
            >
              {stop.city}
            </h1>
            <p className={`mt-2 font-mono text-sm ${current ? "text-text-secondary" : "text-text-tertiary"}`}>
              {stop.country}
            </p>
            <p className="mt-8 flex gap-2 font-mono text-sm text-text-tertiary">
              <span>{current ? "until" : "through"}</span>
              <time className={current ? "text-text-secondary" : "text-text-tertiary"} dateTime={stop.to}>
                {formatDay(stop.to, locale, withYear)}
              </time>
            </p>
          </>
        ) : (
          <>
            <p className={`${label} text-text-tertiary`}>Schedule</p>
            <h1 className="mt-3 font-mono text-2xl text-text-secondary">no stop scheduled</h1>
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-xs text-text-tertiary">
        {freshness ? <span className={reading?.fromCache ? "text-text-secondary" : undefined}>{freshness}</span> : null}
        <span>{TIME_ZONE_LABEL}</span>
      </footer>
    </main>
  );
}
