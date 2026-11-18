import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SnapshotStore } from "@/lib/state";
import type { Env, Platform } from "../types";

const SNAPSHOT_KEY = "https://whereis.sam1.space/__state-snapshot";
const SNAPSHOT_TTL_SECONDS = 12 * 60 * 60;

interface Bindings {
  SITE_URL?: string;
  STATE_URL?: string;
}

function bindings(): Bindings {
  const { env } = getCloudflareContext();
  return env as unknown as Bindings;
}

/** The colo cache. Absent under `next dev`, where the memory fallback takes over. */
function edgeCache(): Cache | null {
  const store = (globalThis as { caches?: { default?: Cache } }).caches;
  return store?.default ?? null;
}

/** Last good document for this process, so a cache-less runtime still degrades instead of blanking. */
let memory: string | null = null;

const snapshot: SnapshotStore = {
  async read() {
    const cache = edgeCache();
    if (cache) {
      const hit = await cache.match(SNAPSHOT_KEY);
      if (hit) return hit.text();
    }

    return memory;
  },

  async write(value) {
    memory = value;

    const cache = edgeCache();
    if (!cache) return;

    try {
      await cache.put(
        SNAPSHOT_KEY,
        new Response(value, {
          headers: {
            "content-type": "application/json",
            "cache-control": `max-age=${SNAPSHOT_TTL_SECONDS}`,
          },
        }),
      );
    } catch {
      // A cache write is never worth failing a render over.
    }
  },
};

export const cloudflare: Platform = {
  name: "cloudflare",

  env(): Env {
    const e = bindings();
    return {
      siteUrl: e.SITE_URL ?? "http://localhost:3000",
      stateUrl: e.STATE_URL,
    };
  },

  snapshot,
};
