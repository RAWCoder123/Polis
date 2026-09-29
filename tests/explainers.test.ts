import test from "node:test";
import assert from "node:assert/strict";
import { civicEntities } from "../lib/social/civic/index.ts";
import { explainers, explainedToday } from "../lib/social/civic/explainers.ts";
import { genericCatalog } from "../lib/social/civic/generic.ts";
import { communityFromRow } from "../lib/social/communities.ts";
import type { CivicEntity } from "../lib/social/types.ts";

const town = (country = "US") =>
  communityFromRow({
    id: "c-burlington-fx", kind: "city", name: "Burlington, Vermont", locationLabel: "Burlington, Vermont, US",
    city: "Burlington", region: "Vermont", country, latitude: 44.4759, longitude: -73.2121,
    timezone: "America/New_York", domain: null, university: null,
  });

test("every explainer is attached to a real catalog entry and keeps its promises to readers", () => {
  for (const id of Object.keys(explainers)) assert.ok(civicEntities.some((e) => e.id === id), "no catalog entry for " + id);
  const all = [...civicEntities, ...genericCatalog(town())].filter((e) => e.explainer);
  assert.ok(all.length >= 9);
  for (const e of all) {
    const x = e.explainer!;
    assert.ok(x.inShort.length > 40 && x.inShort.length <= 320, e.id + ": short summary length");
    assert.ok(x.changes.length > 0 && x.affects.length > 0 && x.stage, e.id + ": missing sections");
    assert.match(x.checkedAt, /^\d{4}-\d{2}-\d{2}$/, e.id);
    for (const s of x.sources) assert.match(s.url, /^https:\/\//, e.id);
    if (x.next?.url) assert.match(x.next.url, /^https:\/\//, e.id);
    // Real explanations cite what they explain; samples say they are illustrations.
    if (!e.sample) assert.ok(x.sources.length > 0, e.id + ": real explainers need a source");
    else assert.match(x.inShort + x.stage, /Sample|illustration/i, e.id + ": samples must say so");
  }
  // Sample explanations never land on a real item, nor real ones on a sample.
  for (const [id, x] of Object.entries(explainers)) {
    const entity = civicEntities.find((e) => e.id === id)!;
    assert.equal(/^Sample:/.test(x.inShort), entity.sample, id);
  }
});

test("the data-center bill explainer is shared by both campuses and reports where the bill stands", () => {
  for (const id of ["news-data-center-costs-ithaca", "news-data-center-costs-uf"]) {
    const x = civicEntities.find((e) => e.id === id)!.explainer!;
    assert.match(x.stage, /Passed the U\.S\. House 417–3 on September 16, 2026/);
    assert.ok(x.sources.some((s) => s.publisher === "Utility Dive"));
  }
});

test("every town gets a guide to how local decisions are made", () => {
  const guide = genericCatalog(town()).find((e) => e.id.endsWith(".how-decisions-work"))!;
  assert.equal(guide.name, "How a local decision gets made in Burlington");
  assert.equal(guide.explainer!.sources[0].publisher, "USA.gov");
  // Outside the U.S. the guide stays general and links nothing U.S.-specific.
  const abroad = genericCatalog(town("FR")).find((e) => e.id.endsWith(".how-decisions-work"))!;
  assert.deepEqual(abroad.explainer!.sources, []);
  assert.equal(abroad.explainer!.next!.url, undefined);
});

test("one explainer is featured a day, real ones before any sample", () => {
  const ithaca = civicEntities.filter((e) => e.communityId === "ithaca");
  const day = (n: number) => new Date(Date.UTC(2026, 8, 28 + n, 12));
  const picks = [0, 1, 2, 3].map((n) => explainedToday(ithaca, day(n))!);
  assert.equal(explainedToday(ithaca, new Date(Date.UTC(2026, 8, 28, 23)))!.id, picks[0].id, "stable within a day");
  assert.ok(new Set(picks.map((p) => p.id)).size > 1, "changes from day to day");
  for (const p of picks) assert.equal(p.sample, false);
  // A community with only samples still gets something to read.
  const onlySamples = ithaca.filter((e) => e.sample);
  assert.equal(explainedToday(onlySamples, day(0))!.sample, true);
  assert.equal(explainedToday([] as CivicEntity[], day(0)), undefined);
});
