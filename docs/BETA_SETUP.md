# Social beta setup

Use Node 24.14.0 and npm 11.9.0. The application retains its existing Sites Worker, D1 database, routes and private hosting access. GitHub validation does not deploy it.

## Release state

The deliverable is a reproducible local social-beta candidate saved on `codex/functional-social-beta` for review against GitHub `main`. A complete local candidate includes the source and migration, passing checks, the isolated three-user HTTP scenario, and inspected desktop/mobile journeys. Synthetic identities prove the local service flow; they do not establish that production authentication or deployment works.

The hosted prototype still serves the earlier MVP. Hosted release acceptance requires the exact reviewed revision on Sites, applied production migrations, and the real-identity checks in [the verification record](VERIFICATION.md#hosted-pilot-acceptance-gate--not-yet-exercised). Private Sites access must stay unchanged. Curated, dated local sources are also needed before the sample catalog can be presented as real civic activity.

## Local development

```sh
npm ci
cp .env.example .dev.vars
npm run db:migrate:local
npm run dev
```

Use the local URL printed by the server. Existing local databases must receive migration `0002_majestic_trish_tilby.sql` before running this version. It adds `issue_priorities` and `profiles.onboardingComplete`; it preserves existing profiles, conversations, rankings and saves. Do not reset a user database or edit applied migrations. The upgrade from migrations 0000/0001 is covered by a regression test with an existing profile and saved item.

## Isolated synthetic multi-user verification

Use a separate checkout and its local `.wrangler/state`. This test creates clearly labeled synthetic profiles and activity; never run it against a database containing real participants. These records are separate from `/demo`, whose fictional browser state stays in localStorage.

```sh
POLIS_TEST_ACCOUNTS=1 npm run dev -- --port 5175
# In another terminal, using the actual printed URL:
POLIS_TEST_ORIGIN=http://localhost:5175 npm run test:http
POLIS_TEST_ORIGIN=http://localhost:5175 npm run test:social-http
```

The explicit development flag enables two additional fixed synthetic identities in the loopback-only sign-in shim. The test uses three independent cookie jars, email-bound invitations, and the actual Worker HTTP route and local D1 storage. Caller-provided identity headers are stripped. The extra identities are unavailable without the flag; the entire sign-in shim runs only in Vite development middleware and is absent from the built Worker/client artifacts. This is not ChatGPT authentication verification.

The HTTP scenario covers friendship request retries and acceptance, Friends feed eligibility, C's direct-link denial, unauthorized edits, reaction replacement/removal, comments and shallow replies, exact notification links, read/unread state, private saves, muting, blocking and deletion. It leaves a clearly labeled example conversation for browser review. Repeated runs may leave additional synthetic review conversations.

The boundary smoke test separately rejects unknown, prototype-property and duplicate authentication cookies, as well as caller-supplied identity headers. This verifies only the local development shim.

## Product behavior

- The coherent request-and-accept friendship model is retained. Home's Following view contains accepted friends and the viewer's posts; a secondary filter shows eligible followed-issue conversations. Community means invited Ithaca members.
- Issue priorities are private, separately ordered issues with optional explanations. Sharing publishes selected items in their current order. Explanations are excluded unless explicitly selected; future private changes do not alter the published snapshot.
- Structured opinions and article/event shares can include HTTPS source links. Text edits retain sources unless explicitly changed. Conversation audiences remain fixed.
- Friend requests and replies appear in the persistent in-app inbox. A reply can notify both the post author and the parent-comment author, with deduplication and existing access, block and mute checks.
- Events can be saved privately, included in private or deliberately shared plans, and shared with commentary. The map and list expose the same saved/plan state. Sample `.ics` downloads contain the catalog's start/end times and explicit fictional labels; they do not register anyone or add an alarm.
- Optional setup suggestions can be skipped permanently. Changing the profile's location never changes membership.

## Verification and hosted dependencies

Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. See [the verification record](VERIFICATION.md) for browser journeys and observed limitations.

Before a hosted pilot, publish the exact reviewed source through the existing Sites workflow, with the configured owner runtime setting and managed `DB`. Sites must apply the migration history, including 0002. Preserve the current private site audience. Three isolated real ChatGPT identities need both authorized Sites access and Polis invitations before hosted acceptance can be exercised. Do not substitute a directly exposed Worker origin for trusted Sites authentication.

All catalog issues, news, officials and events remain illustrative. Event registration sources, costs and real local content need owner curation. Native calendar-client import, real-device pinch gestures, production migration/restore drills and a full assistive-technology audit remain unverified.
