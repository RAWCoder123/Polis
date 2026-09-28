# Social-cycle verification — September 16, 2026

The complete local browser cycle passes against the real local Worker and persistent local D1. Three synthetic accounts use separate cookie/storage contexts in Chromium 151.0.7922.34: desktop 1440 × 1000 and mobile/touch emulation 390 × 844 with reduced motion. This is not hosted ChatGPT authentication. No tester invitations or changes to the site's private audience were made.

## Verified browser journey

1. A finds B, sends a request, and B opens its notification directly in Requests and accepts. Arrow-key navigation retains focus between the people tabs.
2. B publishes an issue-linked opinion with the default Friends audience. The test lets the server commit and drops its response. B retains the draft, performs another action, reloads, and retries. Both attempts use the same ID; only one post exists.
3. A returns to Home, finds B's post, adds, changes and removes a reaction. The selected reaction persists through reload; the final server count is zero.
4. A comments. B opens the notification at that exact comment and replies one level below it. A returns through the exact reply notification and reloads. Conversation and read state persist.
5. C receives 404 through a direct API request and an unavailable browser state; private conversation text is absent.
6. B selects interests, reloads, declines location, filters events, and selects a venue pin. The matching list card is selected.
7. B opens the occurrence, saves privately, records Going privately, reloads, and deliberately changes visibility to Friends. A sees the shared plan; C cannot. Neither retrieves B's private plan.
8. Removing friendship revokes A's conversation deep link, shared attendance and related notifications. The test then restores the synthetic friendship.
9. With sessionStorage disabled, two intentionally identical successful replies create two distinct records; a stale in-memory retry token does not swallow the second reply.

The final run has no page JavaScript errors. The tested composer, conversation, map/list and event detail have no horizontal document overflow. Screenshots and JSON results are in ignored `outputs/social-cycle/`. Physical-device and complete assistive-technology testing remain outstanding.

Final project checks also pass: `npm ci`, lint (zero errors, eight warnings), typecheck, 39 tests, HTTP boundary/social/event checks, and the production build through the Sites build workflow. The artifact retains the existing hosting configuration and complete migration history. A successful build does not establish deployment or hosted authentication.

## Fixes found during verification

- Draft-owned pending identities now survive other commands and reload. Only per-user command digests and UUIDs are stored, never an additional copy of political text. Draft cleanup precedes token cleanup. When storage is inaccessible, only same-mounted-form retry recovery is available.
- Friend-request notifications open `#friends/requests`. People tabs retain their route and keyboard focus. Friendship and reply controls wait for foreground writes.
- Change-of-view drafts retain their original post ID so the command can be reconstructed. That broader browser journey was not separately exercised.
- Event-open analytics use best-effort authenticated requests to the existing API, without occupying the foreground mutation lock or delaying Save/Going.
- Instant map positioning/zoom avoids a Leaflet callback after map removal. Pins and list synchronization remain interactive; the final run has no teardown errors.
- The global error button says “Reload page data”; form buttons retry retained drafts.

Test development also exposed selector/loading assumptions, which were corrected, and one local D1 internal 500 during development reloads. Clean final runs passed; these results do not establish production reliability.

## Reproduce locally

Use Node 24.14.0/npm 11.9.0, `npm ci`, `.env.example`'s synthetic owner in ignored `.dev.vars`, and local migrations. Start an isolated local server:

```sh
npx playwright install chromium
POLIS_TEST_ACCOUNTS=1 npm run dev -- --hostname 127.0.0.1 --port 5176
```

In another terminal, run any of the suites, in any order and as often as you like, against the same database:

```sh
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:browser
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:social-http
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:events-http
```

The scripts reject hosted origins. Each one creates the synthetic members and imports the organizer listings it needs through the authenticated API, so `test:browser` no longer depends on the HTTP fixtures (see [Independent local suites](#independent-local-suites--september-27-2026)). Browser binaries and test artifacts are not committed. `POLIS_BROWSER_PACKAGE_ROOT` optionally selects a preinstalled Playwright package root; ordinary clones use the pinned development dependency.

## Independent local suites — September 27, 2026

Every local suite now establishes the state it needs. All nine pass back to back on one fresh, migrated local D1 in any order, and each can repeat on the same database. Before this change they shared synthetic accounts and leftover data and needed two databases in fixed orders. For example, `test:invitations-browser` failed after `test:social-http` because its tester was already an Ithaca member, and failed its own second run because the tester had already joined Emory. Branch `codex/independent-local-suites`; local synthetic results only.

How the suites stay independent:

- **Run-scoped synthetic accounts.** With `POLIS_TEST_ACCOUNTS=1`, the loopback-only development sign-in shim in `build/sites-vite-plugin.ts` also accepts `test_account=qa_<suite>_<run>_<role>` (for example `qa_signup_mg2k3x9a_b`) and signs in a synthetic `…@sites.test` identity for it.
  - Suites that follow a new person use new accounts on every run: signup, invitation redemption, the event RSVP fixture, the social cycle, civic journey E, and the anywhere founder and neighbor. Every run therefore exercises the first-time path, and no run sees another run's relationships, notifications or memberships.
  - Without `POLIS_TEST_ACCOUNTS=1`, off loopback, or for any other name, sign-in falls back to the example owner and the cookie is ignored (`tests/local-sign-in.test.ts`). The shim is never installed in a production build, and the built output contains no test-account code.
- **Fixed identities belong to one suite each:**
  - `beta_b`/`beta_c`: `test:social-http`;
  - `ithaca_*`/`uf_*`: the commons suite;
  - `campus_cu`/`campus_uf`: the civic suite;
  - `campus_new`: the anywhere suite.
- **The pilot owner `1` is necessarily shared**, because owner access comes from `POLIS_OWNER_EMAIL`. Each suite that uses the owner creates its profile if it is missing, then calls `community.manage` for the community it needs instead of assuming where another suite left it. No suite depends on the owner's name or username.
- **Setup goes through the public API:**
  - owner-issued single-use codes (`join` with `invite` and `confirmedCommunityId`);
  - explicit notification opt-in, since new accounts start with notifications off;
  - friend request and accept;
  - idempotent `createOnly` imports of the checked Ithaca listings.

  `test:browser` also saves a clearly labeled synthetic occurrence in 2099 at the market venue. Its map and RSVP steps therefore no longer run out when the last checked market date (October 3, 2026) passes. With the browser clock set to October 10, 2026, the journey fails without that occurrence ("No upcoming events match yet.") and passes with it.

| Suite | Identities | State it establishes |
| --- | --- | --- |
| `test:http` | none | Read-only; rejected writes only |
| `test:social-http` | owner, `beta_b`, `beta_c` | Owner profile, owner in Ithaca; B and C join with codes; block, mute and friendship reset |
| `test:events-http` | owner, run-scoped B and C | Owner in Ithaca; B and C join; B opts in and becomes the owner's friend; listings imported |
| `test:browser` | owner (setup only), run-scoped A, B, C | Listings and the 2099 occurrence; A, B, C join Ithaca as Beta Alex, Blair and Casey and opt in |
| `test:invitations-browser` | owner, run-scoped tester and second member | Owner in Ithaca; two new people redeem the Emory code |
| `verify-signup-browser.mjs` | run-scoped B and C | Two new accounts; the suite now asserts they are new |
| `verify-commons-browser.mjs` | owner, `ithaca_*`, `uf_*` | Owner manages each campus; members join with codes (later runs continue as members) |
| `test:civic-browser` | owner, `campus_cu`, `campus_uf`, run-scoped journey E member | Owner manages both campuses and imports curated listings when a campus has none |
| `test:anywhere-browser` | run-scoped founder and neighbor, `campus_new` | The first run on a database founds Burlington and Example University; later runs join them |

Test-script problems found and fixed during verification (application code unchanged):

- The commons suite clicked **Enable in-app reply notifications** and published at once. For a new member, the app correctly rejected the post with "Please wait for your previous change." The suite now waits for the saved preference to hide the opt-in.
- On a cold dev server, the app shell writes its starting URL into history up to about a second after the load event, just before it requests its first snapshot. An in-page route change made in that window was overwritten; the commons owner stayed on `#admin`. The commons, civic and anywhere sign-ins now wait for that first `/api/polis` request.
- `test:browser` now finds B in Discover people by B's exact username.

Verification record:

- Node 24.14.0/npm 11.9.0 and Chromium from the pinned Playwright 1.62.1. The database was fresh and migrated (`npm run db:migrate:local`: migrations 0000–0011, no profiles, events or communities). The server was a cold `POLIS_TEST_ACCOUNTS=1` dev server on port 5191, with the synthetic owner from `.env.example`.
- Three passes over all nine suites against the same database and server, with no reset in between:
  1. `test:browser` (on the empty database), commons, anywhere, civic, events HTTP, social HTTP, local HTTP, invitations, signup;
  2. signup, invitations, local HTTP, social HTTP, events HTTP, commons, `test:browser`, civic, anywhere;
  3. a random order: invitations, social HTTP, civic, events HTTP, local HTTP, signup, commons, `test:browser`, anywhere.
- **27 of 27 runs passed.** The anywhere suite used live OpenStreetMap services:
  - pass 1 founded Burlington, and its background import added 60 public places without the map fallback;
  - passes 2 and 3 joined the same Burlington, so the database holds one Burlington community.
  - The owner profile was first created by `test:browser`.
- `npm run lint`: 0 errors, the 7 inherited warnings. `npm run typecheck` passes. `npm test`: 79 tests, including 2 for the sign-in shim. `npm run build` passes.

To run every suite against one server, use this loop. `verify-signup-browser.mjs` and `verify-commons-browser.mjs` have no npm aliases.

```sh
for suite in local-http social-http events-http social-browser invitations-browser signup-browser commons-browser civic-browser anywhere-browser; do
  POLIS_TEST_ORIGIN=http://127.0.0.1:5176 node scripts/verify-$suite.mjs || break
done
```

These are local synthetic results. They do not verify hosted ChatGPT sign-in, production persistence or multi-user acceptance.

## Remaining release gates

- Sites publishing tools are still absent, and normal connections to `git.chatgpt-team.site` timed out again. Restore the native Sites connection and source-host connectivity, then synchronize and privately deploy the exact verified source with migrations 0000–0003.
- Verify actual HTTPS sign-in, original event deep-link preservation, owner configuration, production persistence and invited multi-user access. Local synthetic identities cannot establish these results.
- Basemap imagery remained gray/loading. An empty blocked-response list from a short run does not prove tile availability. Pins, list selection and denied-location fallback passed; live tiles and physical-device gestures remain unverified.
- Recheck organizer dates before invitations; sample civic issues remain labeled, and `/demo` remains separate. Confirm curator/moderation responsibilities and retention practices.
- Observe reciprocal conversations and return visits with real participants. The current relationship model uses accepted friendships; background refresh is periodic or triggered on focus, so the pilot does not promise instant delivery.

Deployment remains blocked. See [pilot setup](event-pilot.md) for the eventual tester-access and curator flow.
