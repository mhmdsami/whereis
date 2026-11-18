# AGENTS.md

You are working in whereis, a one-page service that says where Sami is. It reads a hand-edited
public gist and renders the stop that covers today.

## The state contract

`src/lib/state.ts` is the whole contract. Do not reimplement the boundary rules.

1. Today is the date in Asia/Kolkata, not the visitor's timezone and not UTC. IST has no daylight
   saving, so the footer prints it as `UTC+5:30`.
2. A stop is active when `from <= today <= to`. Both ends are inclusive.
3. When stops overlap, the latest `from` wins. Boundary days are intentional.
4. With nothing active, the page shows the most recent stop that has ended, labelled as past. It is
   never presented as current.
5. With no past stop either, the page says `no stop scheduled`.
6. A city is never inferred or interpolated. No home city, no default.

`parseState` reads the document whole. One malformed stop, or a missing `stops` array, invalidates
the document and the page renders `location unavailable`. Silence beats a wrong city.

Unknown keys are ignored. Only `stops` is read.

## Reading the store

- Source: a public gist, overridden by `STATE_URL` through the port. The default lives in
  `src/lib/state.ts`.
- Freshness: `${url}?v=<floor(Date.now() / 60000)>` with `cache: "no-store"`, so an edit lands
  within about a minute without polling.
- Failure: a network error, a non-2xx response, a timeout, or invalid JSON all resolve to `null`.
  The page must stay honest, not clever.
- `loadState` keeps the last good document in the platform's snapshot store: a live read when
  possible, the snapshot when not, nothing when neither. The snapshot is capped at 12 hours.
- The page is `force-dynamic` and reads `Accept-Language` for date formatting. It is not cached.

## The port

Platform code sits behind a port. Application code must not import anything from a hosting provider.

- `src/platform/` holds the interfaces and the adapters. `src/platform/cloudflare/` is the adapter.
- Nothing outside an adapter imports `wrangler`, `@cloudflare/workers-types`, `getCloudflareContext`
  or `drizzle-orm/d1`, and nothing outside an adapter references `D1Database`.
- Environment values come from the port, not from a provider global.
- Deploy belongs to the adapter.

`pnpm boundaries` fails when application code reaches a provider. If a change needs the app to know
its platform, change the port.

## Runtime

This app deploys to Cloudflare Workers with OpenNext, not vinext.

OpenNext keeps the app a standard Next.js app, so moving to Node or another host is a deploy-target
change rather than a migration. vinext reimplements the Next API on Vite and does not claim full
parity. The other sam1.space apps on Workers also run OpenNext, so this keeps one runtime across
them.

`skills/next-on-cloudflare/` holds the runtime decisions. Do not add a database, KV or cache
binding: the gist plus the minute bucket is the caching story.

## Layout

- `src/app/` holds the route and the layout. `globals.css` holds the tokens.
- `src/components/ui/` holds the shadcn primitives. Use them before writing raw styles.
- `src/lib/` holds shared helpers. `utils.ts` contains only `cn()`.
- `scripts/smoke.mjs` starts the dev server and checks that the route renders.

## Design language

- Black surfaces, one green accent, no decoration. The readout carries the page.
- The readout is Geist Mono. Prose, if it ever appears, is Geist Sans.
- Micro-labels are uppercase Geist Mono with tracking between `0.14em` and `0.18em`.
- Instrument Serif is loaded and available, but no route uses it today, so it is not preloaded. The
  display budget is still enforced by `pnpm display`: two uses per route at most, never in labels,
  buttons or error text.
- Tokens are `oklch` custom properties in `globals.css`. Do not write raw colours, spacing or radii
  in components. Use the token and the `@theme` name.
- Primitives first. If a screen needs markup styled from scratch, add a primitive.

## Metadata

- `src/lib/site.ts` holds the name, description, canonical URL, colours and route list. Adding a
  route means adding it there, otherwise the sitemap misses it.
- `layout.tsx` holds the metadata defaults: `metadataBase`, the title template, canonical, Open
  Graph and Twitter. A page overrides what it needs and inherits the rest.
- `sitemap.ts` reads the route list and skips anything marked `noindex`. Indexing is on by default
  and `NEXT_PUBLIC_ROBOTS=noindex` turns it off. Next reads that value at build time, so changing it
  needs a rebuild.
- Icons are generated. Change `assets/icon.svg`, run `pnpm assets` and commit the output.
- The Open Graph card is a screenshot of `og/og.html`, rendered by `pnpm og` with headless Chrome
  into `public/og.png`. Change the copy in the html, rerun, and commit the png. It is a static card
  on purpose: a build-time card cannot carry a location that changes daily.
- `colors` in `site.ts` repeats the `oklch` tokens as hex because the manifest and `theme-color`
  need hex. Change both together.
- `SITE_URL` must be set at build time as well as at runtime. `robots.txt` and `sitemap.xml` are
  prerendered, so a runtime-only value leaves localhost URLs in the output. The workflows set it.

## Conventions

- Conventional Commits, imperative subject, 50 characters or fewer, one line, no AI co-author
  trailer.
- Branch prefixes: `ft-`, `fx-`, `ch-`, `rf-`.
- No new dependencies without asking.
- Prose is plain. No em dashes, no filler, no stock framing.

## Commands

- `pnpm dev` starts the dev server.
- `pnpm types` runs `tsc --noEmit`.
- `pnpm lint` and `pnpm lint:fix` run biome.
- `pnpm test` runs `node --test`.
- `pnpm smoke` starts the dev server and checks that the route renders.
- `pnpm assets` regenerates the icons from `assets/icon.svg`.
- `pnpm og` regenerates the Open Graph card from `og/og.html`.
- `pnpm boundaries` checks the port.
- `pnpm display` checks the display face budget.
- `pnpm preview` builds the Worker and runs it in workerd.
- `pnpm deploy` builds and deploys to Cloudflare.
- `pnpm gate` runs gate:fast, build and smoke. Run it before pushing.

## Working here

- Use `pnpm` only. The lockfile is `pnpm-lock.yaml`. Build scripts are allowlisted in
  `pnpm-workspace.yaml` under `allowBuilds`, because pnpm 12 blocks them otherwise.
- There is no database, no KV and no R2 binding. The last good document lives in the Cache API,
  behind the port's `snapshot`, and is not a store of record. Do not turn it into one.
- Geist Sans and Geist Mono come from the `geist` package under the SIL Open Font License 1.1.
- Never commit secrets. `.env.example` documents the names only.

## Next 16

This is not the Next.js in your training data. APIs, conventions and file structure changed. Read
the guide in `node_modules/next/dist/docs/` before writing code, and check deprecation notices.
`agentRules` is off in `next.config.ts`, so Next does not append its own notes to this file.
