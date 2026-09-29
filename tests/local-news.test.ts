import test from "node:test";
import assert from "node:assert/strict";
import {
  articleId,
  categorize,
  groupStories,
  isOpinion,
  localityOf,
  parseIndex,
  parseRss,
  rankStories,
  sensitivity,
  type NewsArticle,
  type NewsProfile,
} from "../lib/social/local-news.ts";
import { indexQuery, newsProfileFor } from "../lib/social/news-sources.ts";
import { communityFor, communityFromRow } from "../lib/social/communities.ts";
import type { Fetcher } from "../lib/social/geo.ts";
import { denied, fixture } from "./fixture.ts";

const cornell: NewsProfile = { strong: ["Cornell University", "Cornell"], town: ["Ithaca"], region: ["New York"], localDomains: ["cornellsun.com"] };
const now = new Date("2026-09-29T14:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
const article = (title: string, domain: string, h: number, extra: Partial<NewsArticle> = {}): NewsArticle => {
  const url = "https://" + domain + "/" + encodeURIComponent(title).slice(0, 40) + h;
  return { id: articleId(url), url, title, source: domain, domain, publishedAt: hoursAgo(h), imageUrl: null, summary: null, origin: "index", ...extra };
};

test("local feeds and the news index parse into clean articles", () => {
  const rss = `<rss><channel>
    <item><title><![CDATA['Cornell 7': District attorney to reopen investigation]]></title>
      <link>https://www.cornellsun.com/article/2026/09/cornell-7</link>
      <category><![CDATA[news]]></category><category>campus</category>
      <pubDate>Mon, 28 Sep 2026 21:00:00 -0400</pubDate>
      <description>&lt;p&gt;The district attorney&#8217;s office said&hellip;&lt;/p&gt;</description>
      <media:content url="https://snworksceo.imgix.net/cds/photo.jpg" medium="image"/></item>
    <item><title>No date, dropped</title><link>https://www.cornellsun.com/x</link></item>
    <item><title>Not a web link</title><link>javascript:alert(1)</link><pubDate>Mon, 28 Sep 2026 21:00:00 -0400</pubDate></item>
  </channel></rss>`;
  const [a, ...rest] = parseRss(rss, "The Cornell Daily Sun");
  assert.equal(rest.length, 0);
  assert.equal(a.title, "'Cornell 7': District attorney to reopen investigation");
  assert.equal(a.summary, "The district attorney’s office said…");
  assert.deepEqual(a.sections, ["news", "campus"]);
  assert.equal(a.imageUrl, "https://snworksceo.imgix.net/cds/photo.jpg");
  assert.equal(a.publishedAt, "2026-09-29T01:00:00.000Z");
  assert.equal(a.domain, "cornellsun.com");

  const index = parseIndex({
    articles: [
      { url: "https://www.wunc.org/cornell", title: "Prosecutors are reopening a Cornell fraternity rape case . Here what we know", seendate: "20260929T030000Z", domain: "wunc.org", language: "English" },
      { url: "https://n.yam.com/x", title: "康乃爾大學代表團", seendate: "20260923T060000Z", domain: "n.yam.com", language: "Chinese" },
      { url: "https://example.com/y", title: "Malformed date", seendate: "yesterday", domain: "example.com", language: "English" },
    ],
  });
  assert.deepEqual(index.map((x) => x.title), ["Prosecutors are reopening a Cornell fraternity rape case. Here what we know"]);
});

test("locality: the university or town by name, local outlets, never a passing mention elsewhere", () => {
  assert.equal(localityOf(article("Cornell fraternity alleged gang rape investigation reopened", "ktvu.com", 1), cornell), 1);
  assert.equal(localityOf(article("Ithaca council approves budget", "wbng.com", 1), cornell), 0.9);
  assert.equal(localityOf(article("Weather: Temps rebound by Tuesday", "cornellsun.com", 1, { origin: "local" }), cornell), 0.75);
  assert.equal(localityOf(article("Young Dem Socialists chant at events", "wach.com", 1), cornell), 0);
  // "Cornerstone" is not "Cornell"; names match whole words only.
  assert.equal(localityOf(article("Cornerstone bakery opens downtown", "example.com", 1), cornell), 0);
});

test("articles about one event group into a story; different Cornell stories stay apart", () => {
  const stories = groupStories(
    [
      article("Prosecutors are reopening a Cornell fraternity rape case. Here what we know", "wunc.org", 10),
      article("Prosecutor reopens probe into Cornell gang rape allegations after accuser files lawsuit", "morningjournal.com", 9),
      article("DA Reopens Cornell University Rape Investigation", "oxygen.com", 8),
      article("'Cornell 7': District attorney to reopen investigation in fraternity rape allegations", "cornellsun.com", 7, { origin: "local" }),
      article("Cornell University students protest tuition increase", "example.com", 5),
      article("Cornell University students win national debate award", "example.org", 4),
      article("Young Dem Socialists chant at events", "wach.com", 3),
    ],
    cornell,
  );
  const rape = stories.find((s) => s.sensitive === "sexual-violence")!;
  assert.equal(rape.outlets, 4);
  // The student paper's headline represents the story; the id stays the first report's.
  assert.equal(rape.source, "cornellsun.com");
  assert.equal(rape.id, rape.articles.find((a) => a.domain === "wunc.org")!.id);
  assert.equal(stories.length, 3, "the protest and the award are separate stories; the unrelated chant is dropped");
});

test("categories, sensitive topics and opinion are recognised from headlines", () => {
  assert.equal(categorize("Students face rent increases as landlords raise leases")[0], "housing");
  assert.equal(categorize("The Kennedy Center: A Bastion of American Expression Under Fire")[0] === "safety", false);
  assert.equal(categorize("Big Red win season opener", "", ["Sports"])[0], "culture");
  assert.equal(sensitivity("Prosecutor reopens probe into Cornell gang rape allegations"), "sexual-violence");
  assert.equal(sensitivity("Two killed in Route 13 crash"), null);
  assert.equal(isOpinion("EDITORIAL | Cornell Won't, We Will"), true);
  assert.equal(isOpinion("Ithaca council approves budget", ["news"]), false);
});

test("ranking: local, student-impact news first; discussion on Polis lifts a story; one event never floods the list", () => {
  const stories = groupStories(
    [
      article("Cornell fraternity rape case reopened by district attorney", "cornellsun.com", 20, { origin: "local" }),
      article("Cornell rugby acknowledges players named in fraternity lawsuit", "cornellsun.com", 6, { origin: "local" }),
      article("Cornell graduate students strike over wages", "cornellsun.com", 12, { origin: "local" }),
      article("Ithaca Apple Fest photos celebrate autumn", "ithacavoice.org", 2, { origin: "local" }),
      article("EDITORIAL | Cornell must publish misconduct data", "cornellsun.com", 3, { origin: "local" }),
      article("Cornell hockey season preview", "cornellsun.com", 60 * 24, { origin: "local" }),
    ],
    cornell,
  );
  const ranked = rankStories(stories, {}, now, "Cornell");
  assert.equal(ranked.length, 5, "stories older than three weeks drop out");
  assert.match(ranked[0].title, /rugby|rape case/);
  // A different kind of news breaks up two stories about the same event.
  assert.notEqual(ranked[1].sensitive, "sexual-violence");
  assert.ok(ranked.findIndex((s) => s.opinion) > ranked.findIndex((s) => /strike/.test(s.title)), "reports before opinion");
  assert.deepEqual(ranked.find((s) => /strike/.test(s.title))!.reasons, ["About Cornell", "Money & jobs"]);

  // Students talking about Apple Fest on Polis lifts it, and says why.
  const fest = stories.find((s) => /Apple Fest/.test(s.title))!;
  const before = ranked.findIndex((s) => s.id === fest.id);
  const lifted = rankStories(stories, { [fest.id]: { participants: 9, replies: 20, reactions: 0 } }, now, "Cornell");
  assert.ok(lifted.findIndex((s) => s.id === fest.id) < before);
  assert.ok(lifted.find((s) => s.id === fest.id)!.reasons.includes("9 people discussing on Polis"));
});

test("every located community gets a news profile; ambiguous towns must match their state", () => {
  const ithaca = newsProfileFor(communityFor("ithaca"))!;
  assert.deepEqual(ithaca.strong, ["Cornell University", "Cornell"]);
  assert.match(indexQuery(ithaca), /^\("Cornell University" OR "Cornell" OR "Ithaca"\) sourcelang:english$/);
  const burlington = newsProfileFor(
    communityFromRow({ id: "c-burlington-fx", kind: "city", name: "Burlington, Vermont", locationLabel: "Burlington, Vermont, US", city: "Burlington", region: "Vermont", country: "US", latitude: 44.47, longitude: -73.21, timezone: "America/New_York", domain: null, university: null }),
  )!;
  assert.equal(indexQuery(burlington), '"Burlington" "Vermont" sourcelang:english');
  assert.equal(newsProfileFor(communityFor("polis")), null);
});

test("news imports refresh at most every three hours, survive failing sources and become discussable stories", async () => {
  const rfc = (h: number) => new Date(Date.now() - h * 3600000).toUTCString();
  const iso = (h: number) => new Date(Date.now() - h * 3600000).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const calls: string[] = [];
  let indexUp = true;
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    if (url.includes("cornellsun.com"))
      return new Response(`<rss><channel>
        <item><title>'Cornell 7': District attorney to reopen investigation in fraternity rape allegations</title><link>https://www.cornellsun.com/article/cornell-7</link><pubDate>${rfc(5)}</pubDate><category>news</category></item>
        <item><title>Cornell graduate students vote to strike over wages</title><link>https://www.cornellsun.com/article/strike</link><pubDate>${rfc(8)}</pubDate></item>
      </channel></rss>`);
    if (url.includes("ithacavoice.org")) return new Response("down", { status: 503 });
    if (!indexUp) return new Response("Please limit requests to one every 5 seconds");
    return Response.json({
      articles: [
        { url: "https://www.wunc.org/cornell-case", title: "Prosecutors are reopening a Cornell fraternity rape case", seendate: iso(3), domain: "wunc.org", language: "English" },
        { url: "https://www.ktvu.com/cornell", title: "Cornell fraternity alleged gang rape investigation reopened", seendate: iso(2), domain: "ktvu.com", language: "English" },
        { url: "https://wach.com/unrelated", title: "Young Dem Socialists chant at events", seendate: iso(1), domain: "wach.com", language: "English" },
      ],
    });
  };
  const f = fixture({}, { fetch: fetcher, contact: "https://polis.example" });
  await f.setup();
  assert.equal((await f.act("a", { action: "news.import" })).imported, 5);
  let s = await f.snap("a");
  assert.equal(s.news!.length, 2, "the unrelated national story is not local news");
  const top = s.news![0];
  assert.equal(top.sensitive, "sexual-violence");
  assert.equal(top.outlets, 3);
  assert.deepEqual(top.reasons, ["About Cornell", "Safety", "Covered by 3 outlets"]);
  assert.ok(s.newsUpdatedAt);

  // A forum on any article of the story counts toward it; private posts do not.
  const alias = top.articles.find((x) => x.domain === "ktvu.com")!.id;
  await f.act("b", { action: "post", kind: "question", subjectId: alias, title: "How should Cornell respond?", text: "", audience: "community" });
  await f.act("c", { action: "post", kind: "question", subjectId: top.id, title: "Private note", text: "", audience: "only_me" });
  s = await f.snap("a");
  assert.equal(s.news![0].discussing, 1);
  assert.ok(s.news![0].reasons.includes("1 person discussing on Polis"));

  // Within three hours a refresh is skipped; the index asking to slow down never breaks one.
  assert.equal((await f.act("a", { action: "news.import" })).recent, true);
  assert.equal(calls.length, 3);
  f.raw.exec("UPDATE community_news_imports SET importedAt='2026-01-01T00:00:00.000Z'");
  indexUp = false;
  assert.equal((await f.act("a", { action: "news.import" })).imported, 2);
  // With no source reachable at all, the refresh reports it.
  f.raw.exec("UPDATE community_news_imports SET importedAt='2026-01-01T00:00:00.000Z'");
  const offline = fixture({}, { fetch: async () => new Response("down", { status: 503 }) });
  await offline.setup();
  await denied(offline.act("a", { action: "news.import" }), 503);
});
