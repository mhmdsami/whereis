# whereis

One page that answers where Sami is. It reads a public gist, resolves the stop that covers today in
Asia/Kolkata, and renders the city.

Live at [whereis.sam1.space](https://whereis.sam1.space).

## Stack

| Piece | Choice |
|---|---|
| Framework | Next 16, App Router |
| Runtime | Cloudflare Workers via `@opennextjs/cloudflare` |
| Styles | Tailwind v4, shadcn (`base-nova`) |
| Type | Geist Mono for the readout, Geist Sans for prose |
| Store | A public GitHub gist, plus a 12 hour edge snapshot of the last good read. No database |
| Metadata | static OG card, sitemap, robots, manifest |

## How it reads the schedule

The store is a hand-edited gist:

```
https://gist.githubusercontent.com/sm-sami/1a450cdd0cdb863fe52d5b8f69edeead/raw/state.json
```

Only `stops` is used. Each stop is `{ from, to, city, country }` with `YYYY-MM-DD` dates that are
inclusive on both ends.

1. Today is the date in Asia/Kolkata, not the visitor's timezone.
2. A stop is active when `from <= today <= to`.
3. If stops overlap, the one with the latest `from` wins. Boundary days are deliberate.
4. If nothing is active, the page shows the most recent stop that already ended, labelled past.
5. If there is no past stop either, it says `no stop scheduled`.
6. A city is never inferred or interpolated.

The fetch uses `${url}?v=<floor(Date.now() / 60000)>` with `cache: "no-store"`, the same trick the
portfolio uses, so a gist edit shows within about a minute without polling GitHub.

The last good document is also kept in the Worker's cache (the Cache API, per colo, best effort).
When a live read fails the page renders that snapshot and says how old it is, so a slow or blocked
GitHub degrades to "last good read 12 minutes ago" instead of a blank page. A snapshot older than
12 hours is ignored. Nothing is stored outside the Worker.

If the gist is unreachable, slow, or malformed and there is no usable snapshot, the page renders
`location unavailable` instead of asserting a city. A document with any invalid stop is rejected
whole rather than half-read.

Dates resolve in IST, printed as `UTC+5:30`; the month and weekday are formatted in the visitor's
`Accept-Language` locale. The footer reports the reading: `checked just now` for a live read,
`last good read ...` for a snapshot, with the zone beside it. The reference date is not printed,
because the visitor already knows their own.

## Commands

```sh
pnpm install
pnpm dev        # next dev
pnpm preview    # build the Worker and run it in workerd
pnpm deploy     # build and deploy to Cloudflare
pnpm gate       # types, lint, boundaries, display, tests, build, smoke
pnpm og         # re-render public/og.png from og/og.html
```

Copy `.env.example` to `.dev.vars` for local work. `STATE_URL` is optional and overrides the gist.

## Layout

```
src/app/            the page, layout, metadata routes
src/lib/state.ts    the resolver: today, activeStop, lastStop, parseState, fetchSiteState
src/lib/format.ts   locale formatting for dates
src/lib/site.ts     name, description, canonical URL, colours, route list
src/platform/       the port and its Cloudflare adapter
scripts/            boundary, display, smoke and asset checks
```

## Deploy

The Worker is `whereis` and claims the custom domain `whereis.sam1.space` from `wrangler.jsonc`.
Cloudflare creates the DNS record on deploy. Set `CLOUDFLARE_API_TOKEN` as a repository secret and
`CLOUDFLARE_ACCOUNT_ID` as a repository variable; `.github/workflows/deploy.yml` runs on `main`.

There is no database, so there are no migrations to apply. The gist is the only write path.

## Notes

- Use `pnpm` only. pnpm 12 blocks dependency build scripts, so `pnpm-workspace.yaml` allowlists them.
- The layout is dynamic (`force-dynamic`); nothing is prerendered except the metadata routes.
- Geist Sans and Geist Mono come from the `geist` package. Instrument Serif is vendored and unused on
  the current route, so it is not preloaded. All three are under the SIL Open Font License 1.1.
