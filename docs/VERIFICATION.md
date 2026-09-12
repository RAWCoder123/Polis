# Verification record

Updated 2026-09-12. This record separates tested local behavior from the hosted identity acceptance gate.

## Delivery status

The implementation and verified local preview are complete. Hosted publication is blocked before source upload: this network resolves `git.chatgpt-team.site` to Cornell's security warning service (`Phish Attempt Warning`), and HTTPS connections time out. No security settings, DNS overrides, site audience, or network protections were changed. No new hosted version or deployment was created. The existing live site therefore still runs the earlier MVP.

The owner bootstrap runtime setting was saved in Sites as a secret, revision 1; it applies when the new version is deployed. The local database and test activity are excluded from the prepared deployment output. Resume publishing once approved access to the Sites source server is restored, using fresh short-lived source credentials, the current validated source, and the existing owner-private Sites project. Do not bypass the network filter or publish an older source revision with the new artifact.

## Automated service verification

`npm test`: 14 passing tests using the actual service and both migration files. A D1 transport adapter executes transactional SQL in Node SQLite; identities are isolated fixtures, not real ChatGPT accounts.

Covered: owner bootstrap and email-bound one-use invitations; A/B friendship and conversation; C denied Friends posts through direct IDs, feed, search, profiles, lists, saves, comments and writes; fixed audiences and ownership; one active reaction; grouped notification reads; duplicate retries and mismatched request fingerprints; saved/edit/deleted persistence; unfriend/block/mute behavior; owner-only report evidence and removal; private rankings/notes and immutable selected snapshots; follows and optional update notifications; private/shared/withdrawn event plans; daily answers, private counts and skipping; feed/reply pagination beyond 200 replies and exact deep links; rollback when a block or question withdrawal races a submission; concurrent invitation consumption; minimal metrics for both friends and shared contributions only.

The suite does not model every Cloudflare limit. A real local D1 browser write exposed its shorter SQL LIKE-pattern limit; write-guard cleanup now uses explicit IDs, and search uses `instr`. Those paths were subsequently exercised against local D1.

## Local browser and Worker verification

The local browser uses the Sites starter's development identity. It verified profile creation; Friends-default post publication; replies, Thoughtful reaction, save and reload persistence; a private Still learning daily response; private ranking scores/notes, manual/pairwise ordering, and a two-item shared snapshot; a private Planning to attend event plan synchronized to profile; event map and equivalent list; mobile profile and Home navigation.

Desktop and mobile layouts preserve the original palette and typography. Mobile uses five bottom destinations and retains notifications, post creation, sign-out, and owner tools. The daily card collapses after a saved response. Sample content is visibly identified, and unrelated-person feeds start empty rather than fabricating friends.

`npm run typecheck` passes. `npm run lint` passes with seven warnings in preserved MVP components (unused imports and existing image elements), and no errors. `scripts/verify-local-http.mjs` separately checks anonymous isolation, spoofed identity-header stripping by the local dispatcher shim, no-store responses, and rejection of cross-origin, wrong-format, and unauthenticated writes. The production build passes. Final browser checks measured no horizontal overflow at 390px and 1440px. Keyboard Tab shows a 3px cobalt focus outline; Skip to content focuses the main region without changing routes; Escape closes the composer and restores focus to its Post opener. Muted small text was darkened for contrast, and the stylesheet honors reduced motion. A local D1 conversation with 103 replies retained all loaded replies in chronological order after a reaction and new reply; the synthetic thread was then removed. Deleted direct links show an unavailable message while preserving signed-in navigation. These are focused checks, not a full assistive-technology certification.

## Hosted pilot acceptance gate — not yet exercised

Three isolated ChatGPT identities with explicitly granted Sites access and Polis invitations are required. Local fixture tests and the development identity do not satisfy this gate.

1. Sign in as A, B, and C in three isolated browser profiles. Verify unique durable profiles after sign-out/sign-in and after deployment restart.
2. A requests B, B accepts, A publishes to Friends, B replies/reacts. C must receive no private text/counts through the interface or direct `/api/polis` queries for IDs, searches, authors, lists, comments, or saved items. Test mutation attempts as C too.
3. Verify edits/deletions and reaction replacement across A/B clients; retry the same request key; disconnect during a submission and confirm draft retention and one result after retry.
4. Unfriend, then block, and revisit saved items, notifications, old links, profiles and search as each account. Check C again. Mute must suppress feed/notices while direct permitted content remains accessible.
5. Publish selected ranking items, change private scores/notes, and confirm the published snapshot is unchanged. Test actual overlapping published items in profile comparisons.
6. Follow an issue, publish a sourced owner update, and check notification preferences. Save and deliberately share a daily response; withdraw the question and reject new answers. Test owner-only administration/report access from B/C.
7. Change event plan status/audience across map, list, profile and feed. Verify registration wording against a real event source when real content replaces samples.
8. Verify keyboard-only journeys and screen-reader announcements on actual target devices; check focus, reduced motion, contrast, horizontal overflow and map alternatives. The implementation has not undergone a formal accessibility audit or load test.

The production database must begin without local test profiles or fictional social activity. General reference links and illustrative catalog items remain samples until sourced. Public registration, external messages, location tracking and contact uploads are outside this release.
