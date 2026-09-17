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

In another terminal:

```sh
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:social-http
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:events-http
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:browser
```

The scripts reject hosted origins. HTTP fixtures establish synthetic memberships and import organizer listings through the authenticated API. Browser binaries and test artifacts are not committed. `POLIS_BROWSER_PACKAGE_ROOT` optionally selects a preinstalled Playwright package root; ordinary clones use the pinned development dependency.

## Remaining release gates

- Sites publishing tools are still absent, and normal connections to `git.chatgpt-team.site` timed out again. Restore the native Sites connection and source-host connectivity, then synchronize and privately deploy the exact verified source with migrations 0000–0003.
- Verify actual HTTPS sign-in, original event deep-link preservation, owner configuration, production persistence and invited multi-user access. Local synthetic identities cannot establish these results.
- Basemap imagery remained gray/loading. An empty blocked-response list from a short run does not prove tile availability. Pins, list selection and denied-location fallback passed; live tiles and physical-device gestures remain unverified.
- Recheck organizer dates before invitations; sample civic issues remain labeled, and `/demo` remains separate. Confirm curator/moderation responsibilities and retention practices.
- Observe reciprocal conversations and return visits with real participants. The current relationship model uses accepted friendships; background refresh is periodic or triggered on focus, so the pilot does not promise instant delivery.

Deployment remains blocked. See [pilot setup](event-pilot.md) for the eventual tester-access and curator flow.
