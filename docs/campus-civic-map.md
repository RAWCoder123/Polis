# Campus Commons, civic map and entity cards

Verification date: September 26, 2026. Branch: `codex/commons-civic-map`, continuing Codex's unpublished `codex/cornell-uf-commons` (see [commons pilot](commons-pilot.md)). Locally verified candidate; **not deployed**.

## Source reconciliation

| Commit | Meaning |
| --- | --- |
| `02547cd` | Codex: scoped Cornell/UF Commons, sourced topics, thread follows, tester circles (unpublished checkout) |
| `a8bbcd8` | Codex's uncommitted forum work carried forward and finished: titles, local/national coverage (0009), recently-active order, unread markers, Across Polis |
| `48d5317` | Campus configuration, civic catalog, Commons ranking and summaries, reply perspectives, invitation-code options (0010) |
| `5fa5ab9`, `8af908d` | Home dashboard, dedicated Commons, live civic map, entity cards/pages, search, guidelines; fixes found in verification |

The PR targets `main` and therefore also contains the earlier unmerged candidates (#1–#6). Codex's checkout at `~/Documents/ChatGPT/Polis-commons` was read, not modified.

## What changed for members

- **Home** is a curated dashboard, not an endless feed: campus header; a pulse row (unread replies, what you follow, members here); **Happening near you** (live map preview); **The Commons** (most active discussions plus starter questions); **Today and this week** (meetings, source notes, sample briefs); **Upcoming** events; **People & institutions**.
- **The Commons** (`#commons/<tab>`) keeps Codex's forum — Question / Debate / Update formats, New / Recently active order, thread follows, unread markers, tester circle link and notification opt-in — with tabs **For You · Campus · Local · National · Trending · Following**.
  - *For You* ranks recent visible posts by recency, distinct people taking part, followed subjects/threads and friends. It is a curated first page, not infinite scroll.
  - *Trending* counts distinct people replying or reacting in seven days; a post needs someone other than its author. Reactions never outweigh participation, and disagreement is not scored separately.
  - *Campus* vs *Local* follow the subject: campus buildings, offices, student government and general campus posts vs city offices, housing, transit, places and events.
  - *National* keeps Codex's "My campus / Across Polis" scope.
  - *Following* = followed threads (including your own), followed topics/places/offices, and accepted friends.
- **Posts** show a title when given, an **About** row of entity chips, four reactions (**Agree · Disagree · Interesting · Needs context** — stored kinds are unchanged), reply and participant counts. Replies may carry an optional **perspective** (Support … Still learning); conversations show a neutral perspective bar and a filter.
- **Starter questions** (e.g. "Should Cornell expand late-night bus service to North Campus?") render as structured debates: context, reasons people support it, concerns, questions to weigh, documents, connected entities, and student responses filtered by perspective. Open-ended questions collect ideas without stances.
- **Map** (`#explore`) shows typed markers — offices (seal monograms), government buildings and voting, campus buildings, places, organizations, proposals/projects and events — with layer filters. Markers that share a spot fan out. Selecting one opens a compact card: what it is, why it matters (linked issues), recent Commons activity, upcoming events there, related brief, **Discuss in The Commons**, details and follow. The list beside the map mirrors every marker for keyboard and screen-reader parity. Event list/map (`#explore/events`) is unchanged.
- **Entity pages** (`#entity/<id>`; Codex's `#topic/<id>` still works) adapt to offices, institutions, buildings, proposals (status, responsible body, steps, documents), briefs, meetings, voting and sourced topics (Codex's sourced background, curator developments, notify-me, related events).
- **Search** (`#search?q=`) groups issues, discussions, people & offices, policies, places, organizations, briefs, events and conversations. **Community guidelines** live at `#guidelines` and are linked from the Commons and composer.
- **Location** is optional: one-time browser permission, coordinates rounded to ~100 m, kept in the tab only and never sent to Polis. Declined or unavailable location falls back to the campus center with an explicit message.

## Campuses and sign-in

Campuses are configuration in `lib/social/communities.ts` (university, short name, email domains, city/state, center, zoom, timezone, accent, monogram; an unused `sso` slot for a future approved SAML/OIDC integration). Pages never branch on a specific school.

**Email-domain association.** The trusted sign-in email from the existing Sites/OpenAI identity is matched **exactly** against campus domains (`cornell.edu`, `ufl.edu`). A match adds campus membership at signup and makes the campus the active community; an existing profile sees a **Join** banner (`community.join`). Nothing the client submits can choose a campus. Emory has no domains and remains invitation-only.

This deliberately differs from Codex's more conservative stance ([commons pilot](commons-pilot.md) marks campus verification as blocked). The brief asked for domain association, and the hosting identity's email is the one the member authenticated with. It is **community association, not verification of student status**: alumni who keep a campus address, staff and affiliates can match; subdomains such as `alumni.cornell.edu` do not. The UI says so at signup and on the join banner, and no student badge is shown. Remove a domain from configuration to return a campus to codes only. Hosted confirmation that Sites forwards only verified emails is still pending.

**Invitation codes** keep Codex's campus and organization codes and add: an optional memorable code (6–32 letters/digits, e.g. `CORNELL26`, `POLIS-UF`; listed for admins because it is meant to be shared), 90-day and no-expiry options, and reactivation of a revoked code. Memorable codes are guessable by design and rely on limits, expiration and deactivation. Generated codes remain secret and are never listed back.

## Content and provenance

The civic catalog is code in `lib/social/civic/` (Cornell/Ithaca 45 entities, UF/Gainesville 42; 25 mapped each). Codex's four checked topics are first-class issues with their sourced background.

- **Offices, bodies, buildings, places and organizations** state only what they are, with official links. **No officeholder names, photos or party labels** are included; the model supports them when supplied from a checked source (`office.officeholder`, `office.party`, `imageUrl`). Offices render as seal monograms, not fake headshots.
- **Proposals, projects, briefs and starter questions** are marked **Sample** everywhere they appear and describe illustrative ideas, not pending decisions or reporting. Perspectives summarize arguments people make, not institutional positions.
- **Map positions are approximate** and labeled so; the polling entry points to the official voter lookup rather than asserting a polling place.
- **Events**: Codex's 17 organizer-checked Ithaca occurrences stay a separate import. Curators can additionally import clearly labeled **sample listings** (Cornell 5, UF 11) for testing; archive them before a real cohort. UF still has no checked event bundle.
- The original fictional Ithaca catalog (rankings, `/demo`) is unchanged and grouped as "Fictional sample catalog" in the composer.

## Data and migrations

Additive only; earlier migrations are unchanged. **0010_foamy_blockbuster.sql** adds `comments.position` (nullable) and `invitation_codes.label` (nullable). Codex's 0007–0009 carry conversation follows, organizations, metric/update scope, and `posts.title`/`coverage`. A local database at 0006 upgraded through 0010 without data loss; the migration regression tests still pass.

Service additions go through `app/api/polis/route.ts` and `lib/social/service.ts`: `community.join`, `invite.reactivate`, optional `code` and `expiresDays: 90 | null` on `invite.code`, `position` on replies, `disagree` reactions, feed filters `for_you`, `trending`, `campus`, `city`, `followed`, the `subject` parameter and a `commons=1` summary (recent topics by distinct people; each person's latest perspective per starter question). Follows, priorities, saves and issue updates are scoped to entities in the active community.

## Verification record

- `npm run lint` (0 errors, the 8 inherited warnings), `npm run typecheck`, `npm run build`: pass.
- `npm test`: **67** pass — Codex's 56 plus campus association and isolation, cross-campus subject rejection, structured-question perspective counting, Commons tabs and ranking, per-campus priorities, memorable/no-expiry/reactivated codes, catalog integrity (references, campus distance, sample labeling, no unchecked officeholders) and the login-handoff cookie.
- On a **fresh isolated worktree database** (port 5181): `test:invitations-browser`, `test:http`, `test:social-http`, `test:events-http`, `verify-signup-browser.mjs`, Codex's `verify-commons-browser.mjs` (both campuses, isolation, zero runtime errors), `verify-social-browser.mjs`, and the new `npm run test:civic-browser` all **pass**.
- `test:civic-browser` covers the brief's journeys: **A** Cornell-domain student → Cornell → Commons → joins a starter debate with a perspective → related issue on the map; **B** UF-domain student → UF / Gainesville with no Cornell content; **C** map marker → compact card → Discuss in The Commons → published discussion tied to the office; **D** location permission denied → campus-center fallback; **E** memorable reusable code through `#join/ithaca`.
- Desktop 1440 px and mobile 390 px pages were inspected for layout and overflow (none).
- Verification found and fixed: memorable codes rejected by the handoff cookie; Following dropping your own followed threads; a crash after a denied deep link (rail assumed a community); hidden format descriptions removing accessible names on mobile.

Older scripts were updated where Codex's WIP changed the UI they targeted (`?community=` on post links, notifications off by default, forum moved to `#commons`).

## Not verified / next

- Hosted Sites deployment, real OpenAI/Google sign-in emails for `cornell.edu`/`ufl.edu`, and multi-identity hosted acceptance (publishing remains blocked as recorded in the commons pilot).
- Real officeholder names, headshots, building photos and logos need a checked, licensed source before use. UF needs a checked event bundle.
- Screen-reader audit of the map, real-device pinch/zoom, and basemap availability on campus networks.
- Retention evidence: the Commons loop works locally; no real return data exists yet.
