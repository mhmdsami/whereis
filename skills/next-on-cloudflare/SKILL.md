---
name: next-on-cloudflare
description: Work on this app's Cloudflare runtime. Use when changing the platform adapter, wrangler config, environment values, local bindings, or the deploy path. Covers what this repo has already decided, which is not the same as Cloudflare's general guidance.
---

# Next on Cloudflare

This app runs Next 16 on Workers through OpenNext. It does not use vinext.

## Rules

1. The application never imports a Cloudflare package. Only `src/platform/cloudflare/` may touch
   `wrangler` or `getCloudflareContext`. `pnpm boundaries` enforces this.
2. There is no database, no KV and no R2 binding. The last good document lives in the Cache API,
   reached through the port's `snapshot`. It is best effort and capped at 12 hours. Never treat it
   as a store of record.
3. `SITE_URL` is a build input, not only a runtime value.
4. `STATE_URL` is a runtime input, read through the port. Its default lives in `src/lib/state.ts`.
5. Deploy from CI.

## Why OpenNext

| | OpenNext | vinext |
| --- | --- | --- |
| What the app is | A standard Next.js app | The Next API reimplemented on Vite |
| Leaving Cloudflare | Deploy-target change | Migration |
| Parity | Full Next.js | Upstream does not claim complete parity |

OpenNext is Cloudflare's older recommendation and vinext is the newer one. This app stays on
OpenNext because it has to remain portable and because the other sam1.space apps on Workers already
run it.

## Local

`next dev` reads `.dev.vars` through the adapter's dev hook in `next.config.ts`. That hook is wired
and verified here, so `STATE_URL` and `SITE_URL` behave the same in development as in production.

`pnpm preview` builds the Worker and runs it in workerd. Use it for anything the Node dev server
does not exercise, for example request headers, prerendered metadata routes or the runtime `fetch`.

## Wrangler config

`wrangler.jsonc` holds the only Cloudflare-specific wiring:

| Field | Value | Note |
| --- | --- | --- |
| `main` | `.open-next/worker.js` | Written by the OpenNext build |
| `compatibility_flags` | `["nodejs_compat"]` | Required by the adapter |
| `assets.directory` | `.open-next/assets` | Static output |
| `assets.binding` | `ASSETS` | Serves the static output |
| `routes` | `whereis.sam1.space`, custom domain | Created on the first deploy |
| `vars.SITE_URL` | `https://whereis.sam1.space` | Runtime value |

There is deliberately no `d1_databases`, no `r2_buckets` and no durable objects. The page is
`force-dynamic`, so it needs no incremental cache.

## Build-time values

- `robots.txt` and `sitemap.xml` are metadata routes that read `site.url`. Set `SITE_URL` when
  building as well as at runtime, or the output can carry localhost URLs. The workflows set it.
- There is no Open Graph card. A build-time card cannot represent a location that changes daily, so
  it would ship a stale city.

## Deploy

`deploy.yml` runs `pnpm deploy` and needs `CLOUDFLARE_API_TOKEN` in secrets plus
`CLOUDFLARE_ACCOUNT_ID` in variables. There are no migrations to apply. `ci.yml` runs the gate and
needs no credentials.

## Related

`skills/wrangler/` covers CLI commands and resource management. `skills/workers-best-practices/`
covers runtime patterns and configuration limits.
