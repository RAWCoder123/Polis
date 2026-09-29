import type { Fetcher } from "./geo.ts";
import type { PilotCommunity } from "./communities.ts";
import { localeOf } from "./communities.ts";
import { parseIndex, parseRss, type NewsArticle, type NewsProfile } from "./local-news.ts";

// Where each community's news comes from. Student papers and town news sites
// publish RSS feeds; every community, anywhere, is also searched by name in
// GDELT, an open index of news coverage. Only headlines, links, dates and
// outlet names are stored; Polis links to the original for the story.

export type NewsFeed = { url: string; source: string; domain: string };

export const localFeeds: Record<string, NewsFeed[]> = {
  ithaca: [
    { url: "https://www.cornellsun.com/plugin/feeds/all.xml", source: "The Cornell Daily Sun", domain: "cornellsun.com" },
    { url: "https://ithacavoice.org/feed/", source: "The Ithaca Voice", domain: "ithacavoice.org" },
  ],
  uf: [{ url: "https://www.alligator.org/plugin/feeds/section/news.xml", source: "The Independent Florida Alligator", domain: "alligator.org" }],
};

export function newsProfileFor(community: PilotCommunity | null | undefined): NewsProfile | null {
  const locale = localeOf(community);
  if (!locale) return null;
  const strong = locale.university ? [locale.university, locale.shortName] : [];
  return {
    strong: strong.filter((name, i) => name && strong.indexOf(name) === i),
    town: [locale.city],
    region: locale.region ? [locale.region] : [],
    localDomains: (localFeeds[community!.id] ?? []).map((f) => f.domain),
  };
}

// Campus names are distinctive; town names often are not (there are many
// Burlingtons), so a town must appear with its state or region.
export function indexQuery(profile: NewsProfile) {
  const quote = (s: string) => '"' + s.replace(/"/g, "") + '"';
  const names = [...profile.strong, ...profile.town].filter((n) => n.length > 2);
  const about = profile.strong.length
    ? "(" + names.map(quote).join(" OR ") + ")"
    : quote(profile.town[0]) + (profile.region[0] ? " " + quote(profile.region[0]) : "");
  return about + " sourcelang:english";
}

const headers = (contact: string) => ({ "User-Agent": "Polis civic community pilot (" + contact + ")", Accept: "application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.5" });

// Each source is independent: one outlet being down, or the index asking
// callers to slow down, never stops the others.
export async function fetchCommunityNews(community: PilotCommunity, fetcher: Fetcher, contact: string) {
  const profile = newsProfileFor(community);
  if (!profile) return { articles: [] as NewsArticle[], sources: 0 };
  const feeds = localFeeds[community.id] ?? [];
  const index =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({ query: indexQuery(profile), mode: "artlist", format: "json", maxrecords: "100", timespan: "7d", sort: "datedesc" });
  const results = await Promise.all([
    ...feeds.map(async (feed) => {
      try {
        const r = await fetcher(feed.url, { headers: headers(contact), signal: AbortSignal.timeout(12000) });
        return r.ok ? parseRss(await r.text(), feed.source) : null;
      } catch {
        return null;
      }
    }),
    (async () => {
      try {
        const r = await fetcher(index, { headers: headers(contact), signal: AbortSignal.timeout(15000) });
        const text = r.ok ? await r.text() : "";
        return text.trimStart().startsWith("{") ? parseIndex(JSON.parse(text)) : null;
      } catch {
        return null;
      }
    })(),
  ]);
  return { articles: results.flatMap((r) => r ?? []), sources: results.filter((r) => r !== null).length };
}
