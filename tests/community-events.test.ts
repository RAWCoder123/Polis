import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverEvents,
  eventDay,
  eventExpired,
  eventRecord,
} from "../lib/social/events.ts";
import { officialEvents } from "../lib/social/official-events.ts";
import { communityEventCalendar } from "../lib/social/calendar.ts";
const prefs = { city: "Ithaca", interests: [], complete: true };
const now = new Date("2026-09-16T14:00:00Z");
test("checked organizer bundle has unique dated occurrences, supported categories and valid source metadata", () => {
  assert.equal(officialEvents.length, 17);
  assert.equal(new Set(officialEvents.map((e) => e.id)).size, 17);
  assert.equal(
    new Set(officialEvents.map((e) => e.seriesId + e.startsAt)).size,
    17,
  );
  assert.equal(new Set(officialEvents.map((e) => e.category)).size, 6);
  for (const e of officialEvents) {
    assert.equal(eventRecord.safeParse(e).success, true, e.id);
    assert.equal(e.sample, false);
    assert.ok(e.endsAt! > e.startsAt);
  }
});
test("local today, weekend, date range, free and proximity filters share the same eligible results", () => {
  assert.equal(
    discoverEvents(officialEvents, prefs, { period: "today" }, now).length,
    1,
  );
  const weekend = discoverEvents(
    officialEvents,
    prefs,
    { period: "weekend" },
    now,
  );
  assert.deepEqual(
    new Set(weekend.map((r) => eventDay(r.event.startsAt))),
    new Set(["2026-09-19", "2026-09-20"]),
  );
  assert.equal(
    discoverEvents(
      officialEvents,
      prefs,
      { period: "range", from: "2026-09-25", to: "2026-09-25" },
      now,
    ).length,
    3,
  );
  assert.equal(
    discoverEvents(
      officialEvents,
      prefs,
      { period: "", from: "2020-01-01", to: "2020-01-02" },
      now,
    ).length,
    17,
  );
  assert.ok(
    discoverEvents(officialEvents, prefs, { free: true }, now).every(
      (r) => r.event.cost === "free",
    ),
  );
  assert.ok(
    discoverEvents(
      officialEvents,
      prefs,
      { origin: [42.449335, -76.472658], miles: 1 },
      now,
    ).every((r) => r.event.category === "outdoors"),
  );
  const hidden = officialEvents.map((e) => ({
    ...e,
    status: "canceled" as const,
  }));
  assert.equal(discoverEvents(hidden, prefs, {}, now).length, 0);
});
test("chosen interests are explainable, retain variety and never override explicit date sorting", () => {
  const p = { ...prefs, interests: ["food_markets" as const] };
  const found = discoverEvents(officialEvents, p, {}, now);
  assert.equal(found[0].event.category, "food_markets");
  assert.equal(found[3].match, false);
  assert.deepEqual(
    discoverEvents(officialEvents, p, { sort: "date" }, now).map(
      (r) => r.event.id,
    ),
    discoverEvents(officialEvents, prefs, { sort: "date" }, now).map(
      (r) => r.event.id,
    ),
  );
});
test("unknown end times remain through their local day and calendars preserve DST instants without injection", () => {
  const e = {
    ...officialEvents[0],
    startsAt: "2026-11-01T05:30:00.000Z",
    endsAt: null,
    title: "A\r\nATTENDEE:fake",
  };
  assert.equal(eventDay("2026-09-17T01:00:00Z"), "2026-09-16");
  assert.equal(eventExpired(e, new Date("2026-11-02T04:59:00Z")), false);
  assert.equal(eventExpired(e, new Date("2026-11-02T05:01:00Z")), true);
  const ics = communityEventCalendar({ ...e, status: "canceled" }, now);
  assert.ok(ics.includes("DTSTART:20261101T053000Z"));
  assert.ok(ics.includes("STATUS:CANCELLED"));
  assert.ok(!ics.includes("\r\nATTENDEE:"));
  assert.ok(!ics.includes("DTEND:"));
});

test("organizer links reject control characters and old stored URLs cannot inject calendar properties", () => {
  const sourceUrl = "https://example.test/\r\nX-POLIS-INJECTED:yes";
  assert.equal(
    eventRecord.safeParse({ ...officialEvents[0], sourceUrl }).success,
    false,
  );
  assert.equal(
    eventRecord.safeParse({
      ...officialEvents[0],
      imageUrl: "https://example.test/a\u0000b",
    }).success,
    false,
  );
  const ics = communityEventCalendar({ ...officialEvents[0], sourceUrl }, now);
  assert.ok(!ics.includes("\r\nX-POLIS-INJECTED:"));
  assert.ok(ics.includes("%0D%0A"));
});
