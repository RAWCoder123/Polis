// Local news that matters to students, for any town or campus.
//
// Articles come from local outlets (student papers, town news sites) and an
// open news index searched by the community's names. The ranking asks four
// questions of every story, in plain terms:
//   1. Is it about here?            locality: the university, town or a local outlet
//   2. Does it touch student life?  impact: safety, housing, money, rights, health…
//   3. Are students talking about it on Polis?  acknowledgement: distinct people
//   4. Is it big?                   coverage: how many outlets report it
// and weighs them by how recent the story is. Articles about the same event
// are grouped into one story. Every ranked story carries the reasons it is
// shown, so the ranking is explainable, never a black box.
// Pure functions only: fetching and storage live in the service.

export type NewsCategory =
  | "safety"
  | "housing"
  | "money"
  | "rights"
  | "health"
  | "campus"
  | "transit"
  | "government"
  | "weather"
  | "culture"
  | "other";

export type NewsArticle = {
  id: string;
  url: string;
  title: string;
  source: string; // outlet name, or the domain when unknown
  domain: string;
  publishedAt: string; // ISO
  imageUrl: string | null;
  summary: string | null;
  // "local": a community outlet's own feed. "index": the open news index.
  origin: "local" | "index";
  // The outlet's own sections (news, sports, opinion…), when it lists them.
  sections?: string[];
};

export type NewsProfile = {
  // Names that make a story about this community: the university, its short
  // name, the town. Matched as whole words, case-insensitively.
  strong: string[];
  town: string[];
  // Nearby places that make a story regional rather than local.
  region: string[];
  // Outlets whose feeds are local by definition.
  localDomains: string[];
};

export type NewsStory = {
  // The earliest article's id; stable as more outlets report the story.
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl: string | null;
  summary: string | null;
  category: NewsCategory;
  categories: NewsCategory[];
  sensitive: SensitiveTopic | null;
  // Columns and editorials: perspectives on the news rather than reports.
  opinion: boolean;
  locality: number;
  // Every article in the story, representative first.
  articles: Pick<NewsArticle, "id" | "url" | "title" | "source" | "domain" | "publishedAt">[];
  outlets: number;
};

export type SensitiveTopic = "sexual-violence" | "suicide" | "violence";

export type StoryEngagement = { participants: number; replies: number; reactions: number };

export type RankedStory = NewsStory & {
  score: number;
  discussing: number;
  reasons: string[];
};

export const newsCategories: Record<NewsCategory, { label: string; impact: number; words: string[] }> = {
  safety: {
    label: "Safety",
    impact: 1,
    words: [
      "assault", "assaulted", "rape", "raped", "sexual", "harassment", "misconduct", "shooting", "shot", "stabbing",
      "stabbed", "police", "arrest", "arrested", "charged", "missing", "killed", "death", "dead", "died", "crash",
      "blaze", "arson", "firefighters", "emergency", "alert", "threat", "threats", "lockdown", "investigation", "prosecutor", "prosecutors",
      "lawsuit", "hazing", "overdose", "robbery", "burglary", "gun", "weapon", "safety", "fraternity",
    ],
  },
  housing: {
    label: "Housing",
    impact: 0.85,
    words: ["housing", "rent", "rents", "lease", "leases", "landlord", "landlords", "dorm", "dorms", "apartment", "apartments", "eviction", "tenant", "tenants", "homeless", "zoning"],
  },
  money: {
    label: "Money & jobs",
    impact: 0.8,
    words: ["tuition", "financial", "aid", "fees", "fee", "pay", "salary", "salaries", "cost", "costs", "budget", "funding", "cuts", "jobs", "wages", "wage", "strike", "union", "layoffs", "scholarship", "grants", "prices"],
  },
  rights: {
    label: "Rights & speech",
    impact: 0.8,
    words: ["protest", "protests", "protesters", "speech", "rally", "visa", "visas", "immigration", "deportation", "deported", "ice", "international", "discrimination", "ix", "civil", "rights", "encampment", "suspension", "suspended", "expelled"],
  },
  health: {
    label: "Health",
    impact: 0.8,
    words: ["health", "covid", "flu", "outbreak", "mental", "hospital", "measles", "vaccine", "vaccines", "clinic", "illness", "counseling"],
  },
  campus: {
    label: "Campus",
    impact: 0.7,
    words: ["university", "college", "students", "student", "faculty", "president", "provost", "sorority", "greek", "admissions", "graduate", "undergraduate", "trustees", "campus", "professor", "professors", "dean"],
  },
  transit: {
    label: "Getting around",
    impact: 0.65,
    words: ["bus", "buses", "tcat", "rts", "parking", "traffic", "road", "roads", "transit", "bike", "bikes", "sidewalk", "crossing", "pedestrian"],
  },
  government: {
    label: "Government",
    impact: 0.6,
    words: ["council", "mayor", "election", "elections", "vote", "voting", "ballot", "law", "bill", "legislation", "policy", "ordinance", "commission", "congress", "governor", "court", "judge", "county", "legislature", "senate", "assembly"],
  },
  weather: {
    label: "Weather",
    impact: 0.6,
    words: ["storm", "snow", "flood", "flooding", "noreaster", "weather", "heat", "hurricane", "tornado", "power", "outage", "outages"],
  },
  culture: {
    label: "Culture & sports",
    impact: 0.35,
    words: ["concert", "festival", "game", "athletics", "football", "basketball", "hockey", "theater", "art", "arts", "music", "exhibit", "season", "win", "wins"],
  },
  other: { label: "News", impact: 0.3, words: [] },
};

const sensitivePatterns: [SensitiveTopic, RegExp][] = [
  ["sexual-violence", /\b(rape[sd]?|raping|sexual(ly)? (assault(ed)?|violence|misconduct|abuse)|gang rape|sex crimes?)\b/i],
  ["suicide", /\b(suicide|suicidal|self-harm)\b/i],
  ["violence", /\b(shooting|shot dead|stabbing|stabbed|homicide|murder(ed)?)\b/i],
];

// Support shown with sensitive stories. National, free and confidential.
export const sensitiveSupport: Record<SensitiveTopic, { note: string; support: string; url: string }> = {
  "sexual-violence": {
    note: "This story involves sexual violence.",
    support: "Support is free and confidential: RAINN National Sexual Assault Hotline, 800-656-4673, or your campus's confidential advocates.",
    url: "https://rainn.org/",
  },
  suicide: {
    note: "This story involves suicide or self-harm.",
    support: "If you or someone you know is struggling, call or text 988 (Suicide & Crisis Lifeline).",
    url: "https://988lifeline.org/",
  },
  violence: {
    note: "This story involves violence.",
    support: "If you are affected, your campus counseling service can help. In an emergency, call 911.",
    url: "https://988lifeline.org/",
  },
};

const stop = new Set(
  "a an the and or of to in on at for from by with as is are was were be been it its this that after before over into about amid says said new here what we know how why who will not no more than up out his her their they he she you your our".split(" "),
);
const words = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
const mentions = (text: string, terms: string[]) => {
  const t = " " + words(text).join(" ") + " ";
  return terms.some((term) => {
    const w = words(term).join(" ");
    return !!w && t.includes(" " + w + " ");
  });
};

// Headline words count double; an outlet's own section (sports, arts) decides
// culture outright.
export function categorize(title: string, summary = "", sections: string[] = []): NewsCategory[] {
  const head = words(title);
  const body = words(summary);
  const section = sections.map((x) => x.toLowerCase());
  const hits = (Object.keys(newsCategories) as NewsCategory[])
    .filter((c) => c !== "other")
    .map((c) => {
      const list = new Set(newsCategories[c].words);
      let n = head.filter((w) => list.has(w)).length * 2 + body.filter((w) => list.has(w)).length;
      if (c === "culture" && section.some((x) => /sport|athletic|arts?\b|entertainment|music|culture/.test(x))) n += 4;
      return { c, n };
    })
    .filter((x) => x.n > 0)
    // Most weight first; ties go to what matters more to students.
    .sort((a, b) => b.n - a.n || newsCategories[b.c].impact - newsCategories[a.c].impact);
  return hits.length ? hits.map((x) => x.c) : ["other"];
}
// "EDITORIAL | …", "GUEST ROOM | …" or an opinion section.
export const isOpinion = (title: string, sections: string[] = []) =>
  /^[A-Z][A-Z0-9 .'’&-]{1,30} \| /.test(title) || sections.some((x) => /opinion|editorial|column|letters?\b/i.test(x));

export function sensitivity(text: string): SensitiveTopic | null {
  for (const [topic, pattern] of sensitivePatterns) if (pattern.test(text)) return topic;
  return null;
}

// 1 for the university or town by name, less for the region; local outlets
// count as local even when a headline omits the town.
export function localityOf(article: Pick<NewsArticle, "title" | "summary" | "domain" | "origin">, profile: NewsProfile) {
  const text = article.title + " " + (article.summary ?? "");
  const local = article.origin === "local" || profile.localDomains.includes(article.domain);
  if (mentions(article.title, profile.strong)) return 1;
  if (mentions(article.title, profile.town)) return 0.9;
  if (local) return mentions(text, [...profile.strong, ...profile.town]) ? 0.9 : 0.75;
  if (mentions(text, profile.strong) || mentions(text, profile.town)) return 0.55;
  if (mentions(article.title, profile.region)) return 0.45;
  return 0;
}

// Words that say which story it is. Community names and generic campus words
// are left out (every local headline shares them), and words are cut to five
// letters so "reopens", "reopening" and "reopened" match.
const generic = new Set("university college students student campus city county local news report reports says week today year".split(" "));
function significant(title: string, profile: NewsProfile) {
  const names = new Set([...profile.strong, ...profile.town].flatMap(words));
  return new Set(
    words(title)
      .filter((w) => w.length > 2 && !stop.has(w) && !generic.has(w) && !names.has(w))
      .map((w) => w.slice(0, 5)),
  );
}
function sameStory(a: Set<string>, b: Set<string>) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.5;
}

// Group articles about the same event. Headlines about one story share most
// of their distinctive words: at least two, and half of the shorter headline.
export function groupStories(articles: NewsArticle[], profile: NewsProfile, minLocality = 0.5): NewsStory[] {
  const seen = new Set<string>();
  const unique = articles
    .filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)))
    .map((a) => ({ a, locality: localityOf(a, profile), tokens: significant(a.title, profile) }))
    .filter((x) => x.locality >= minLocality && x.tokens.size >= 2)
    .sort((x, y) => x.a.publishedAt.localeCompare(y.a.publishedAt) || x.a.id.localeCompare(y.a.id));
  const groups: (typeof unique)[] = [];
  for (const item of unique) {
    const home = groups.find((g) => g.some((o) => sameStory(o.tokens, item.tokens)));
    if (home) home.push(item);
    else groups.push([item]);
  }
  return groups.map((g) => {
    // A local outlet's headline represents the story when there is one.
    const rep = [...g].sort((x, y) => Number(y.a.origin === "local") - Number(x.a.origin === "local") || y.a.publishedAt.localeCompare(x.a.publishedAt))[0];
    const text = g.map((x) => x.a.title + " " + (x.a.summary ?? "")).join(" ");
    const categories = categorize(
      g.map((x) => x.a.title).join(" "),
      g.map((x) => x.a.summary ?? "").join(" "),
      g.flatMap((x) => x.a.sections ?? []),
    );
    return {
      id: g[0].a.id,
      title: rep.a.title,
      url: rep.a.url,
      source: rep.a.source,
      publishedAt: g.map((x) => x.a.publishedAt).sort().at(-1)!,
      imageUrl: rep.a.imageUrl ?? g.find((x) => x.a.imageUrl)?.a.imageUrl ?? null,
      summary: rep.a.summary,
      category: categories[0],
      categories,
      sensitive: sensitivity(text),
      opinion: g.every((x) => isOpinion(x.a.title, x.a.sections)),
      locality: Math.max(...g.map((x) => x.locality)),
      articles: [rep, ...g.filter((x) => x !== rep)].map(({ a }) => ({ id: a.id, url: a.url, title: a.title, source: a.source, domain: a.domain, publishedAt: a.publishedAt })),
      outlets: new Set(g.map((x) => x.a.domain)).size,
    };
  });
}

export const weights = { locality: 0.3, impact: 0.3, acknowledgement: 0.25, coverage: 0.15 };
const HALF_LIFE_HOURS = 36;

// Opinion pieces weigh less than reports; each further story on the same
// thread (same kind of news, same sensitive topic) weighs a little less, so
// one event informs the list without taking it over.
const OPINION = 0.65;
const SAME_THREAD = 0.85;

export function rankStories(
  stories: NewsStory[],
  engagement: Record<string, StoryEngagement>,
  now: Date,
  place: string,
  maxAgeDays = 21,
): RankedStory[] {
  const scored = stories
    .map((s) => {
      const ageHours = Math.max(0, (now.getTime() - Date.parse(s.publishedAt)) / 3600000);
      const e = s.articles.reduce(
        (sum, a) => {
          const x = engagement[a.id];
          return x ? { participants: sum.participants + x.participants, replies: sum.replies + x.replies, reactions: sum.reactions + x.reactions } : sum;
        },
        { participants: 0, replies: 0, reactions: 0 },
      );
      const acknowledgement = Math.min(1, Math.log1p(e.participants * 3 + e.replies + e.reactions) / Math.log1p(60));
      const coverage = Math.min(1, Math.log2(1 + s.outlets) / Math.log2(1 + 12));
      const impact = newsCategories[s.category].impact;
      const recency = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
      const score =
        recency *
        (s.opinion ? OPINION : 1) *
        (weights.locality * s.locality + weights.impact * impact + weights.acknowledgement * acknowledgement + weights.coverage * coverage);
      const reasons = [
        s.locality >= 0.9 ? "About " + place : "Near " + place,
        s.opinion ? "Opinion" : newsCategories[s.category].label,
        ...(e.participants ? [e.participants + (e.participants === 1 ? " person" : " people") + " discussing on Polis"] : []),
        ...(s.outlets > 1 ? ["Covered by " + s.outlets + " outlets"] : []),
      ];
      return { ...s, score, discussing: e.participants, reasons, ageHours };
    })
    .filter((s) => s.ageHours <= maxAgeDays * 24)
    .sort((a, b) => b.score - a.score);
  // Re-rank with the thread penalty, greedily.
  const ranked: typeof scored = [];
  const threads = new Map<string, number>();
  const pool = [...scored];
  while (pool.length) {
    let best = 0;
    let bestScore = -1;
    pool.forEach((s, i) => {
      const adjusted = s.score * Math.pow(SAME_THREAD, threads.get(s.category + ":" + (s.sensitive ?? "")) ?? 0);
      if (adjusted > bestScore) {
        best = i;
        bestScore = adjusted;
      }
    });
    const [s] = pool.splice(best, 1);
    const thread = s.category + ":" + (s.sensitive ?? "");
    threads.set(thread, (threads.get(thread) ?? 0) + 1);
    ranked.push({ ...s, score: bestScore });
  }
  return ranked.map((s) => {
    const { ageHours, ...story } = s;
    void ageHours;
    return story;
  });
}

// --- Parsing the sources ---------------------------------------------------

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", hellip: "…" };
const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => entities[n.toLowerCase()] ?? m)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const tag = (block: string, name: string) => {
  const m = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? decode(m[1]) : "";
};
export const articleId = (url: string) => {
  let h = 0x811c9dc5;
  for (const ch of url) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return "news-" + h.toString(36);
};
const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url.replace(/^http:/i, "https:") : "");

// RSS 2.0 items (WordPress, SNworks and most local news sites).
export function parseRss(xml: string, source: string): NewsArticle[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item) => {
    const url = safeUrl(tag(item, "link") || tag(item, "guid"));
    const title = tag(item, "title");
    const date = Date.parse(tag(item, "pubDate") || tag(item, "dc:date"));
    if (!url || !title || !Number.isFinite(date)) return [];
    const image =
      item.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i)?.[1] ?? item.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i)?.[1] ?? null;
    // A short teaser only; the story itself stays with the outlet.
    const teaser = tag(item, "description");
    const summary = teaser ? (teaser.length > 180 ? teaser.slice(0, 177).replace(/\s+\S*$/, "") + "…" : teaser) : null;
    const sections = [...item.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map((m) => decode(m[1])).filter(Boolean).slice(0, 8);
    return [{ id: articleId(url), url, title: title.slice(0, 240), source, domain: domainOf(url), publishedAt: new Date(date).toISOString(), imageUrl: image ? safeUrl(decode(image)) || null : null, summary, origin: "local" as const, sections }];
  });
}

// GDELT DOC 2.0 article lists (https://api.gdeltproject.org).
export function parseIndex(json: unknown): NewsArticle[] {
  const list = (json as { articles?: { url?: string; title?: string; seendate?: string; domain?: string; socialimage?: string; language?: string }[] })?.articles ?? [];
  return list.flatMap((a) => {
    const url = safeUrl(a.url ?? "");
    const m = (a.seendate ?? "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!url || !a.title || !m || (a.language && a.language !== "English")) return [];
    // The index spaces out punctuation ("rape case . Here what"); tidy it.
    const title = a.title.replace(/\s+([.,:;!?%])/g, "$1").replace(/\s{2,}/g, " ").trim();
    return [{
      id: articleId(url),
      url,
      title: title.slice(0, 240),
      source: a.domain ?? domainOf(url),
      domain: (a.domain ?? domainOf(url)).replace(/^www\./, ""),
      publishedAt: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`,
      imageUrl: a.socialimage ? safeUrl(a.socialimage) || null : null,
      summary: null,
      origin: "index" as const,
    }];
  });
}
