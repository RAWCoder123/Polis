# Claude review and civic milestone — September 27, 2026

## Assessment

Reviewed the fetched GitHub work, not the old local status files: Claude's civic work in PR #7 (`codex/commons-civic-map`, `8bf2bc3`) and the consolidated PR #8 (`codex/polis-main-stack`, `21a854fc8d7cc65594528f68532b31a00762c44d`). The review branch starts at PR #8. The original dirty Commons checkout is preserved.

Claude delivered a substantial reusable foundation: campus Home, Commons, typed civic map, entity pages, search, structured questions, reply perspectives and an additive D1 migration. Its baseline passed 67 tests, types and build; lint had no errors and seven inherited warnings. This was source implementation, not a deployment or hosted acceptance result.

Corrections made during this review:

1. **Campus admission:** the baseline admitted a campus from a Sites email string alone. There is no verified university-email assertion in the current hosting adapter, and the approved milestone explicitly defers that integration. Campus admission now requires invitations; only a future explicitly trusted server adapter can assert a verified campus email. No client flag can enable it. Existing memberships remain intact; ordinary signup creates an open Polis profile.
2. **Privacy and ordering:** the ranked feed used blocked/muted reaction and reply activity in scoring. Removed opaque ranking; use recency, visible recent activity and explicit following. Reply rows, participant counts, topic summaries and recent activity consistently exclude muted replies. Legacy feed URLs remain usable as chronological aliases.
3. **Interaction consistency:** Home map pins previously left Home. They now open an anchored preview in place; event/title actions open details. Back restores event filters and scroll position. Related civic routes retain their community.
4. **Wider discussions:** unjoined Across Polis no longer presents a campus composer as though it published into the wider scope. Joining the wider community remains explicit and leaves the selected campus unchanged.
5. **Mobile hierarchy:** the introduction displaced discussions. Local/National tabs and New/Recently active/Following controls now lead into title-first compact rows; optional topic/group guidance sits below conversations.
6. **Reply focus:** the first navigation frame could be canceled while a thread loaded and never retried. Restoration is now consumed only after it runs; the browser test verifies that Reply focuses the composer.
7. **Venue ambiguity:** several dated occurrences at one venue now have an occurrence selector. Friend plans are associated with their actual occurrence; a venue icon does not imply current location or attendance at every event there.

Retained useful architecture, ranking behavior, authentication, friendships, original routes, assets and migration history. Historical reaction data remains readable, while the visible set is Agree, Thought-provoking and Want to understand more. This is a focused review, not a claim of an exhaustive security audit.

## Integrated additions

- All / My campus / Town event filters, explicit campus/organizer associations, image attribution, detail banners and Home event photography.
- Six newly checked organizer listings: Cornell CSA Mid-Autumn, Cornell Dining food show; UF Soulfest and Gator Growl; Gainesville Loosey's Trivia and Free Fridays. Existing checked Ithaca town occurrences remain in the additive bundle. Two campus and two town occurrences per cohort pass the dated coverage check as of September 27; recheck before invitations because this coverage expires.
- Four new real-person records with official portraits and source/check dates: Ithaca and Gainesville mayors and the two pilot congressional representatives. No sample scores were transferred.
- A clearly attributed congressional source note for National, distinct from member opinions. It is an office press release, not independent verification or a claim that a bill became law. It is a small curated start, not a news feed integration.
- Locally bundled OSM outlines, accessible geographic pins, occurrence previews, pan/zoom/fit and list fallback. Public source IDs and ODbL attribution are included in `public/maps/README.md`.
- A server-projected `venuePlans` collection contains only permitted current friends' shared plans. Private, blocked, muted, canceled and ended plans do not enter map icons, names or counts. Own plan history remains available privately.

## Verification

Local synthetic identities only; production authentication is not simulated as a verified hosted result.

- 72 service/unit tests pass: three identities per campus, private attendance, organization membership, blocking/muting, duplicate retries, capacity/expiry guards, national scopes, campus isolation, date/time filtering and migration upgrades.
- Type check and production build pass. Lint: zero errors, seven inherited warnings in the original demo.
- Local HTTP boundary passes: anonymous isolation, forged-header stripping, invalid/duplicate cookie rejection, no-store, origin/content-type/auth enforcement.
- Commons browser journey: three independent sessions per campus; invite handoff, post/reply, exact notification, thread follow, organization announcement, cross-campus denial, sources, denied location, missing-map fallback and reload. Desktop plus 320/390px layouts; reduced motion and keyboard checks.
- Civic browser journeys A–E pass with invitation-based admission, optional location denial, map-to-discussion, perspective replies and reusable-code joining.
- Focused event milestone browser test covers interests → campus discovery → private save → private plan → Friends visibility → friend map icon → conversation → exact reply notification → reload, with unrelated identity denied. Also verifies Home pin behavior, occurrence selection, Back/filter/scroll restoration, failed publication with retained drafts, exact reply focus, broken-image fallback, canceled direct links and national scope switching.

Screenshots are local synthetic-account evidence. The scripts write them to `/tmp/polis-milestone-qa`, `/tmp/polis-commons-qa` and `/tmp/polis-civic-qa`. Run `npm run test:milestone-browser` against an isolated loopback server with `POLIS_TEST_ACCOUNTS=1`; never point fixture scripts at production.

## Setup and release gate

Use Node 24.14.0 and npm 11.9.0, `npm ci`, an ignored `.dev.vars` from `.env.example`, then apply local migrations with `npm run db:migrate:local`. The integrated source contains migrations 0000–0010. This review adds backward-compatible fields in existing JSON records and static catalogs, so it needs no additional SQL migration. Do not reset databases or edit applied migrations.

After exact-source deployment, a curator opens **Manage listings** (`#event-manager`) and imports the checked pilot bundle for the selected community. Imports use stable IDs and `createOnly`, preserving existing edits and user activity. Existing records are not silently rewritten to new metadata. Review them in the editor to add associations/credits where needed, and archive synthetic listings before invitations. User suggestions and reports are reviewed through the existing owner/curator screens.

Sites reports public version **2**, last updated September 17. The HTTPS homepage still renders the older application. On September 27, connecting to `git.chatgpt-team.site:443` timed out; an authenticated source read with a freshly issued credential also timed out. The Sites management connector is available; reinstalling a plugin is not the identified problem. No new source, migrations or release was published. The site's audience and environment were unchanged.

Minimum remaining publishing action: run the exact reviewed source synchronization and Sites publish workflow from a connection that reaches the existing Sites source host, then verify the saved/deployed revision and migrations. Preserve public hosting access and the separate invitation-based campus gate.

Before inviting Cornell: use three real hosted identities to verify sign-in return paths, invitations, private/friends boundaries, plan/reply persistence across devices, notification deep links, revocation and reporting. Only then admit the first Cornell cohort. UF requires the same hosted acceptance and freshly checked coverage before invitations.

Remaining limitations: real hosted account acceptance, real-device pinch/assistive-technology checks, broader imagery reuse review, operational retention/restore ownership, fresh recurring content, and university verification. Several civic proposals/questions/briefs remain explicitly labeled samples. Event sources with no public coordinates remain in the list rather than receiving invented pins.
