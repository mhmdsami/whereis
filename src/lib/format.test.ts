import assert from "node:assert/strict";
import test from "node:test";
import { formatDay, resolveLocale, since } from "./format.ts";

test("resolveLocale takes the first usable tag", () => {
  assert.equal(resolveLocale("en-GB,en;q=0.9"), "en-GB");
  assert.equal(resolveLocale("de"), "de");
  assert.equal(resolveLocale("*"), "en");
  assert.equal(resolveLocale("not a locale"), "en");
  assert.equal(resolveLocale(null), "en");
});

test("formatDay keeps the calendar day the document wrote", () => {
  for (const locale of ["en", "en-GB", "de", "ja", "en-IN"]) {
    assert.match(formatDay("2026-11-27", locale, false), /27/);
  }
});

test("formatDay adds the year only when asked", () => {
  assert.doesNotMatch(formatDay("2026-11-27", "en", false), /2026/);
  assert.match(formatDay("2026-11-27", "en", true), /2026/);
});

test("formatDay leaves unparseable values alone", () => {
  assert.equal(formatDay("2026-11-27T00:00:00Z", "en", false), "2026-11-27T00:00:00Z");
});

test("since reads in whole units", () => {
  const now = new Date("2026-11-18T12:00:00Z");

  assert.equal(since(new Date("2026-11-18T11:59:30Z"), now), "just now");
  assert.equal(since(new Date("2026-11-18T11:59:00Z"), now), "1 minute ago");
  assert.equal(since(new Date("2026-11-18T11:45:00Z"), now), "15 minutes ago");
  assert.equal(since(new Date("2026-11-18T09:00:00Z"), now), "3 hours ago");
  assert.equal(since(new Date("2026-11-16T12:00:00Z"), now), "2 days ago");
  assert.equal(since(new Date("2026-11-18T12:00:30Z"), now), "just now");
});
