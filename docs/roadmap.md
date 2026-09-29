# Roadmap

## Implemented in the imported source

- Original visual system, desktop sidebar/supporting rail, mobile navigation, assets, and isolated `/demo` MVP.
- Social API with durable profiles, invited membership, friendship requests, posts/questions/article shares, reactions, shallow replies, editing/deletion, saves, and in-app notifications.
- Audience/ownership checks, blocking/muting, owner moderation, idempotent writes, cursor pagination, and transactional guards.
- Private rankings with pairwise/manual ordering, separate support scores, published snapshots, profile lists, and comparisons of overlapping shared items.
- Issue follows, connected issue/item pages, update preferences, owner-managed daily questions and private/deliberately shared responses.
- Event map/list discovery, filtering, pan/zoom, details and reflections, and Interested/Planning to attend plans with explicit audiences.
- Minimal first-party events without private text, scores, political positions, or precise locations.

These describe the source implementation. Hosted multi-user acceptance on Vercel remains pending; see [deployment](deployment.md) and [invitation codes](invitation-codes.md).

## Functional social beta additions

- Optional HTTPS sources on issue-linked opinions, article shares and event commentary; issue-level positions; retained drafts after rejected submissions.
- Following and Community home views, with a secondary followed-issues filter and clearer loading/failure messages.
- Friend-request notifications, notification read/unread controls, dual-recipient reply notifications and unavailable-comment feedback.
- Private issue priorities, explanations, reordering, explicit selected snapshots and a full own-profile list. Scored civic ratings and their existing comparisons remain separate.
- Skippable setup suggestions, friendship controls on profiles, private event saves from map/list discovery, a saved-events filter and clearly labeled sample calendar downloads.
- Three-session local Worker HTTP verification and an additive D1 upgrade. See [beta setup](BETA_SETUP.md).

## Community-event pilot additions

- Persistent dated event occurrences, private saves/RSVPs, chosen interests, explainable discovery and event discussions.
- Events/Issues Explore, geographic venue pins with list parity, filters, local times, private collections and calendar downloads.
- Curator listing lifecycle, member suggestion queue, existing owner reports, additive import of 17 organizer-verified occurrences.
- Privacy, date/filter, duplicate, transactional cancellation and three-session HTTP regression checks. See [event pilot setup](event-pilot.md) and [source record](event-sources.md).

## Reviewed community-platform candidate (September 27)

- Retains Claude's Home dashboard, reusable civic cards, entity pages, search, structured questions and additive Commons migration.
- Compact title-led Local / National discussions with New, Recently active and Following; private campus threads and explicit Across Polis discussions remain separate.
- Campus/town event associations, organizer-sourced photography, six additional dated campus/town listings, four real official portraits with new IDs, and one attributed national source note.
- Bundled OSM outlines replace external tiles. Venue icons show only server-permitted friends' plans and distinguish dated occurrences. Home pins open in place; browser Back restores discovery filters and scroll.
- Campus admission requires a code until an approved provider supplies verified university-email claims. An email string or editable location alone cannot grant membership.

See [Claude review and milestone evidence](claude-review-and-milestone.md) for assessment, changes, setup and the exact release gate. The source passes local synthetic-account verification; it is not yet published.

## Polis anywhere additions

- Find your community: search any town, city or university, or list communities near you. Start the first commons for a town. Found a campus commons with a verified university email; later students with the same domain join automatically.
- Every located community without a curated catalog gets a civic scaffold: local issues, offices described by role with official lookup links, Sample starter questions, and up to 60 civic places from OpenStreetMap.
- Server rules: duplicate towns within 25 miles are joined instead of created, a limit of three new communities a day, open town membership, campus domains taken only from the trusted sign-in email, and weekly place imports. See [Polis anywhere](anywhere.md).

## Map and consolidation (September 28)

- One branch, `codex/polis-public-mvp`, merges the reviewed civic milestone with the anywhere and motion line, and the independent local suites. Campus founding, joining and domain association now all require the verified-email assertion the milestone introduced.
- A Snap-style 3D map replaces Leaflet raster tiles on the civic and venue maps: simplified pastel basemap, hill shading, 3D buildings, count bubbles, street-level *Use my location* with the street name, tilt-aware framing, layer chips only for layers present, and an outline or list fallback. See [map](map.md).
- `#map` opens the Map tab; unknown local test accounts are refused instead of signing in as the owner; phones get a map-first Map tab and a single glance row on Home.
- Browser suites launch Chromium with software WebGL (`scripts/browser.mjs`) and follow the reviewed Commons.

## Local news and color (September 29)

- Local news for any community: student papers and town outlets' feeds plus the GDELT index, grouped into stories and ranked by locality, student impact, discussion on Polis and coverage, with reasons shown; a News tab in the Commons, Home tiles and a forum on every story. Sensitive stories carry support resources and forum guidance. See [local news](local-news.md).
- Color that tells things apart: news by kind, places and offices by type, and officials by party from checked sources (the President and each campus state's U.S. senators added; representatives' parties recorded). Brighter map.
- Next: personal ranking from what each member follows, more pilot outlets, and an owner control to hide a story.

## Plain-language explainers (September 28)

- Laws, proposals, documents and local processes explained as: in short, what would change, who it affects, where it stands, what happens next and how to weigh in, words to know, sources. See [explainers](explainers.md).
- Real explainers for the Ratepayer Protection Act (H.R. 9340) and UF's fall 2026 bus changes; Sample explainers for the illustrative housing and bus proposals; a "How a local decision gets made" guide for every community.
- Home features one explainer a day. Next: curators need an in-app way to write explainers for their town, and TCAT's notice needs a checkable source.

## Usability review (September 28)

A first-time walkthrough (sign up, find a town, Home, Map, Commons, ask a question, events, profile) at desktop and 390 px passes without errors or overflow. What still feels convoluted or crowded, most important first:

1. **Too many ways to express a view.** Reactions, reply perspectives, issue positions, private priorities, scored rankings and daily questions are separate concepts. Each is defensible; together they are a lot to learn. Recommendation: keep reactions and perspectives in the Commons, and fold Rankings into the profile's Priorities (it is already hidden from the phone tab bar). Decide before inviting the Cornell cohort.
2. **Community types.** Polis commons, towns, invite-only campuses, private organizations and Across Polis all appear in one switcher. Searching "Ithaca" returns an invite-only campus next to separate "Town of" and "City of" results. Recommendation: group the switcher (Your places / Campus / Groups) and merge same-name municipalities in search.
3. **Two event maps.** The Map tab's Events layer and the Events explorer's map both show venues. They now share one engine; next, make the explorer's map mode open the Map tab's Events layer so there is one map.
4. **Placeholder civic content.** New towns show offices by role ("Mayor or local executive") with lookup links and Sample questions. Honest, but thin; the first curated sources for a town matter more than new features.
5. **Demo inside the member app.** The member sidebar links to the original browser-only demo, which confuses real members. Recommendation: keep `/demo` for the public landing page only.
6. **Large files.** `lib/social/service.ts` (about 2,700 lines), `social-app.tsx` and `social-views.tsx` carry most of the product. Split by domain (communities, Commons, events) in focused maintenance, with the existing tests as the safety net.

## Known gaps

Polis moved to Vercel with a Turso database and Clerk sign-in on September 29, 2026 ([deployment](deployment.md)). The Vercel pilot starts with an empty database; activity from the earlier Sites pilot at polis-community.raymondaw2006.chatgpt.site is not migrated. Three real hosted accounts must still verify sign-in, invitations, privacy, replies and plan persistence before the Cornell release; UF follows.

The September 27 motion candidate is locally verified only. View Transitions need Chrome/Edge 111+, Safari 18+ or Firefox 144+; other browsers change views instantly. Real-device swipe-back, a screen-reader pass on transitions, and hosted performance remain untested. See [motion](motion.md).

The September 27 anywhere candidate is locally verified only:

- Production reachability and fair-use capacity of the public Nominatim and Overpass services from Vercel functions are unconfirmed.
- Founder-created communities have no community-level moderators, rename, merge or archive UI; reports go to the pilot owner.
- Non-US civic structure is generic.
- Town membership does not verify residence.
- Campus founding and association by email domain rely on Clerk's email verification. They grant community membership, not proof of enrollment.

Apart from four reviewed officials with official portraits, the civic catalog names offices rather than officeholders; a checked source is required before adding more. Campus sample proposals, briefs, questions and event listings are labeled Sample. UF has no checked event bundle.

Both cohorts now have at least two checked campus and two checked town occurrences as of September 27. Coverage is date-sensitive and needs curator refresh before invitations. Some listings have no public coordinates and remain list-only. Existing civic sample proposals, briefs and starter questions stay labeled Sample. The four real officials have source credits; no image licensing guarantee is implied. University SSO/email verification and a broad automated news/content pipeline remain outside this milestone.

The open-signup candidate separates normal profile creation in Polis commons from optional university/organization codes. It preserves existing private-community memberships. Sign-in now uses Clerk (an email code or Google); Polis stores no passwords. Source and local verification are documented in [open signup](open-signup.md); hosted acceptance remains pending.

The September 25 public showcase candidate adds a community-focused landing page and isolated interactive product examples. It ships with the Vercel release.

Community-specific invitation codes, optional usage limits, expiration, revocation, and login handoff are implemented and verified locally with two isolated browser accounts. They ship with the Vercel release. See [invitation codes](invitation-codes.md).

Cornell/Ithaca and Emory are configured invitation destinations. Memberships, conversations, moderation and active-community preferences are separated on the server. Emory has no sourced event/issue/official catalog yet; it displays honest empty states. The broader location-resolution, officials, curator community-configuration, source-integration and campus-coverage brief remains future work. Selecting or joining a community does not verify enrollment or electoral residence.

The local social-cycle browser journey now passes with independent synthetic sessions, including mobile/desktop overflow, lost-response retry/reload recovery, notifications and attendance privacy. See [current browser verification](social-cycle-verification.md). On the earlier Sites host, owner profile creation, event import and private save after reload passed ([hosted verification](hosted-pilot-verification.md)); hosted multi-user acceptance on Vercel remains pending.

- Legacy civic records, news, officials, demo map positions, and initial prompts remain fictional or illustrative. The new event catalog is separately sourced. Reference links do not establish those records as real local facts.
- Three real accounts on the Vercel deployment, with production Turso and Clerk, have not been exercised together.
- Merging to `main` deploys production on Vercel and applies pending migrations; pull requests get previews that never migrate production. Rolling back a deployment does not undo a migration.
- GitHub Actions is not active: the available integrations lack permission to write workflow files. The reviewed workflow remains in `docs/ci.yml`; local checks are the current verification evidence.
- The original demo map remains schematic. The social maps depend on OpenFreeMap and the public AWS terrain tiles in the browser, with bundled outlines for Ithaca and Gainesville and the list as fallbacks. Real-device pinch and tilt gestures, performance on older phones, a full assistive-technology audit, load testing and production migration/restore drills remain.
- No automated metric dashboard or retention/deletion scheduler exists. Account deletion and data download are handled by hand on request (see `/privacy`); self-serve deletion is future work. Agree operational retention before a live pilot.
- Seven inherited lint warnings remain in original MVP components; address them in focused maintenance work. Organizer images intentionally use a native element with an explicit lint exemption.

## Next three milestones

1. **Verify the hosted social flow on Vercel.** With Turso and Clerk configured, exercise A/B friendship and conversation with C denied private content, campus joining by university email, invitation codes and news import. Record identity, persistence, revocation, blocking and retry evidence.
2. **Replace samples with sourced local content.** Maintain the sourced event seed and curate Ithaca/Cornell issues, sources, registration requirements, and timelines; agree owner review responsibilities and freshness before inviting participants.
3. **Finish pilot usability and operations.** Activate the reviewed GitHub workflow after workflow permission is granted, validate map gestures and assistive-technology journeys on target devices, and establish retention, moderation, and minimal activation/reciprocity/return reporting.

External notifications, contact uploads, inferred political labels and continuous location tracking remain outside this release. Anyone can sign up; campus communities admit verified university emails or invitation codes. Propose and review broader social features before implementation.
