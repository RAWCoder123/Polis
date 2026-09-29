# Local news

Polis shows each community the local news that matters most to its students, and lets them start a forum on any story. It works for any town or university: pilot campuses also read their student papers and town news sites directly.

## Where stories come from

| Source | Used for | Notes |
| --- | --- | --- |
| Local outlets' RSS feeds (`lib/social/news-sources.ts`) | Pilot campuses: The Cornell Daily Sun and The Ithaca Voice; The Independent Florida Alligator (news section) | Local by definition. Add a feed per community id. |
| [GDELT](https://www.gdeltproject.org/) DOC 2.0 index | Every located community, searched by name | Open and free. Campus names are searched as-is; town names must appear with their state, because many towns share a name. It asks callers to wait five seconds between requests and answers with plain text when they do not; an import then continues with the local feeds. |

Polis stores headlines, links, outlet names, dates, images the outlet supplies and a short teaser (180 characters at most), never article text, and always links to the original. Headlines older than 30 days are deleted.

Any member can trigger a refresh; the server allows one every three hours per community (`news.import`). The app refreshes in the background when a member opens Polis and the news is stale.

## How stories are ranked (`lib/social/local-news.ts`)

1. **Group articles into stories.** Headlines about one event share at least two distinctive words and half of the shorter headline, after community names and generic campus words are removed and words are cut to five letters (so "reopens" matches "reopening"). A story's id is its first article's id, so it stays stable as more outlets report it; conversations about any article in it count toward the story.
2. **Score each story:**

| Signal | Weight | Meaning |
| --- | --- | --- |
| Locality | 0.30 | The university or town named in the headline (1 or 0.9), a local outlet (0.75), a mention in the teaser (0.55), the region (0.45). Stories below 0.5 are not shown. |
| Student impact | 0.30 | By category, from headline and teaser words (headline words count double) and the outlet's own section: safety 1, housing 0.85, money and jobs 0.8, rights and speech 0.8, health 0.8, campus 0.7, getting around 0.65, government 0.6, weather 0.6, culture and sports 0.35. |
| Acknowledgement | 0.25 | Distinct people discussing the story on Polis in the last two weeks, plus their replies, counting only conversations the viewer can see (never private posts). |
| Coverage | 0.15 | How many outlets report it. |

   The total is multiplied by recency (half-life 36 hours; nothing older than three weeks), and by 0.65 for opinion columns and editorials.
3. **Keep the list varied.** Each further story on the same thread (same category and sensitive topic) weighs 15% less, so one event informs the list without taking it over.
4. **Explain it.** Every story says why it is shown: "About Cornell · Safety · 3 people discussing on Polis · Covered by 4 outlets".

## Sensitive stories

Stories about sexual violence, suicide or violence are labeled Sensitive. Their pages show a content note, free and confidential support (RAINN, 800-656-4673, or 988), and forum guidance: don't name or speculate about the people involved, and report posts that do.

## Where it appears

- **Home:** "Local news that matters", the top three stories.
- **Commons → News:** the full ranked list, with a color filter for each kind of news.
- **A story's page:** colored banner, why it is here, coverage from each outlet, and its forum.

## Limits

- Categories come from keywords, so some stories land in a neighbouring category; the outlet's section and headline weighting reduce this. Only English sources are used.
- GDELT's request limit is per IP address. Many communities refreshing from one hosting network at once can be told to wait; local feeds are unaffected.
- Feeds can change address (the Alligator's all-stories feed returned an empty body on September 29, so Polis uses its news section).
- Ranking is the same for everyone in a community; it does not yet learn from what each person follows.
