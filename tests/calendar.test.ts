import test from "node:test";
import assert from "node:assert/strict";
import { itemById } from "../lib/polis-data.ts";
import { sampleEventCalendar } from "../lib/social/calendar.ts";
test("sample calendar keeps absolute event time, labels fiction and cannot inject calendar properties", () => {
  const event = {
    ...itemById["library-forum"],
    title: "Libraries, parks; and learning\nATTENDEE:bad",
    summary: "Café ".repeat(50),
  };
  const ics = sampleEventCalendar(event, new Date("2026-09-14T00:00:00Z"));
  assert.match(ics, /DTSTART:20260915T213000Z/);
  assert.match(ics, /DTEND:20260915T230000Z/);
  assert.match(
    ics,
    /SUMMARY:SAMPLE — Libraries\\, parks\\; and learning\\nATTENDEE:bad/,
  );
  assert.equal(ics.includes("\r\nATTENDEE:"), false);
  assert.match(ics.replace(/\r\n /g, ""), /not a real event or registration/);
  assert.equal(ics.includes("BEGIN:VALARM"), false);
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(ics.endsWith("END:VCALENDAR\r\n"), true);
});
