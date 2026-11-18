import assert from "node:assert/strict";
import test from "node:test";
import type { SnapshotStore, Stop } from "./state.ts";
import { activeStop, fetchSiteState, lastStop, loadState, parseState, today } from "./state.ts";

const stops: Array<Stop> = [
  { from: "2026-11-18", to: "2026-11-19", city: "Bengaluru", country: "India" },
  { from: "2026-11-19", to: "2026-11-27", city: "Chennai", country: "India" },
  { from: "2026-12-20", to: "2026-12-24", city: "Riyadh", country: "Saudi Arabia" },
];

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

function respondWith(handler: (url: string) => Response | Promise<Response>) {
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    urls.push(url);
    return handler(url);
  }) as typeof fetch;
  return urls;
}

function memoryStore() {
  let raw: string | null = null;
  return {
    get raw() {
      return raw;
    },
    store: {
      read: async () => raw,
      write: async (value: string) => {
        raw = value;
      },
    } satisfies SnapshotStore,
  };
}

test("today follows the Asia/Kolkata date, not UTC", () => {
  assert.equal(today(new Date("2026-11-18T18:29:00Z")), "2026-11-18");
  assert.equal(today(new Date("2026-11-18T18:30:00Z")), "2026-11-19");
});

test("activeStop covers both ends of a stop", () => {
  assert.equal(activeStop(stops, at("2026-12-20"))?.city, "Riyadh");
  assert.equal(activeStop(stops, at("2026-12-24"))?.city, "Riyadh");
  assert.equal(activeStop(stops, at("2026-12-25")), null);
});

test("activeStop gives an overlapping day to the latest start", () => {
  assert.equal(activeStop(stops, at("2026-11-19"))?.city, "Chennai");
});

test("activeStop returns null between stops and for an empty schedule", () => {
  assert.equal(activeStop(stops, at("2026-12-01")), null);
  assert.equal(activeStop([], at("2026-12-01")), null);
  assert.equal(activeStop(undefined, at("2026-12-01")), null);
});

test("activeStop does not depend on input order", () => {
  assert.equal(activeStop([...stops].reverse(), at("2026-11-25"))?.city, "Chennai");
});

test("lastStop picks the most recent stop that has ended", () => {
  assert.equal(lastStop(stops, at("2026-12-01"))?.city, "Chennai");
  assert.equal(lastStop(stops, at("2026-12-26"))?.city, "Riyadh");
  assert.equal(lastStop(stops, at("2026-11-18")), null);
});

test("parseState keeps a whole valid document and ignores unknown keys", () => {
  const state = parseState({ stops, building: { name: "devboy" }, reading: { title: "The Book Thief" } });

  assert.equal(state?.stops.length, 3);
  assert.deepEqual(state?.stops[0], stops[0]);
});

test("parseState rejects a document where any stop is malformed", () => {
  assert.equal(parseState({ stops: [...stops, { city: "Nowhere" }] }), null);
  assert.equal(
    parseState({ stops: [...stops, { from: "2026-13-01", to: "2026-13-02", city: "X", country: "Y" }] }),
    null,
  );
});

test("parseState rejects documents without a stops array", () => {
  assert.equal(parseState(null), null);
  assert.equal(parseState("state"), null);
  assert.equal(parseState({}), null);
  assert.equal(parseState({ stops: "none" }), null);
  assert.deepEqual(parseState({ stops: [] }), { stops: [] });
});

test("fetchSiteState asks for a fresh copy each minute", async () => {
  const original = globalThis.fetch;
  const urls = respondWith(() => Response.json({ stops }));

  try {
    const state = await fetchSiteState("https://example.com/state.json");
    assert.equal(state?.stops.length, 3);
    assert.match(urls[0] ?? "", /^https:\/\/example\.com\/state\.json\?v=\d+$/);
  } finally {
    globalThis.fetch = original;
  }
});

test("fetchSiteState returns null instead of a guess", async () => {
  const original = globalThis.fetch;

  try {
    respondWith(() => new Response("down", { status: 500 }));
    assert.equal(await fetchSiteState("https://example.com/state.json"), null);

    respondWith(() => new Response("{", { status: 200 }));
    assert.equal(await fetchSiteState("https://example.com/state.json"), null);

    respondWith(() => {
      throw new Error("offline");
    });
    assert.equal(await fetchSiteState("https://example.com/state.json"), null);
  } finally {
    globalThis.fetch = original;
  }
});

test("loadState keeps the last good document", async () => {
  const original = globalThis.fetch;
  const snapshot = memoryStore();

  try {
    respondWith(() => Response.json({ stops }));
    const reading = await loadState("https://example.com/state.json", snapshot.store);

    assert.equal(reading?.fromCache, false);
    assert.equal(reading?.state.stops.length, 3);
    assert.ok(snapshot.raw);
  } finally {
    globalThis.fetch = original;
  }
});

test("loadState serves the last good document when the source fails", async () => {
  const original = globalThis.fetch;
  const snapshot = memoryStore();
  const readAt = Date.now() - 5 * 60_000;

  try {
    respondWith(() => Response.json({ stops }));
    await loadState("https://example.com/state.json", snapshot.store);

    const raw = snapshot.raw;
    assert.ok(raw);
    await snapshot.store.write(JSON.stringify({ ...JSON.parse(raw), readAt }));

    respondWith(() => new Response("down", { status: 500 }));
    const reading = await loadState("https://example.com/state.json", snapshot.store);

    assert.equal(reading?.fromCache, true);
    assert.equal(reading?.state.stops.length, 3);
    assert.equal(reading?.readAt.getTime(), readAt);
  } finally {
    globalThis.fetch = original;
  }
});

test("loadState ignores a snapshot past its age limit", async () => {
  const original = globalThis.fetch;
  const snapshot = memoryStore();

  try {
    await snapshot.store.write(JSON.stringify({ readAt: Date.now() - 13 * 60 * 60_000, state: { stops } }));
    respondWith(() => new Response("down", { status: 500 }));

    assert.equal(await loadState("https://example.com/state.json", snapshot.store), null);
  } finally {
    globalThis.fetch = original;
  }
});

test("loadState ignores a malformed snapshot", async () => {
  const original = globalThis.fetch;
  const broken = [
    "{",
    "null",
    JSON.stringify({ readAt: Date.now() }),
    JSON.stringify({ readAt: Date.now(), state: { stops: [{}] } }),
  ];

  try {
    respondWith(() => new Response("down", { status: 500 }));

    for (const raw of broken) {
      const snapshot = memoryStore();
      await snapshot.store.write(raw);
      assert.equal(await loadState("https://example.com/state.json", snapshot.store), null);
    }
  } finally {
    globalThis.fetch = original;
  }
});
