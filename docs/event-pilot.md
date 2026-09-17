# Community-event pilot

This release extends the existing Vinext/React, Sites authentication and D1 social service. It preserves the blue visual identity, issues, rankings, accepted friendships, profiles and discussions. `/demo` remains fictional browser-local activity. Real organizer listings enter the shared database only through an authorized curator import.

## Current delivery boundary

Sites version 2 is deployed at https://polis-community.raymondaw2006.chatgpt.site with public site access explicitly selected by the owner. Hosted owner profile creation, curator import, event deep link and private save after reload passed. Invited multi-user acceptance remains outstanding; see the [hosted verification record](hosted-pilot-verification.md).

Changing to an authorized working network resolved the source-host timeout and allowed deployment. Sites tools became unavailable again afterward, so subsequent wording corrections are saved but not deployed. No alternate Worker or temporary tunnel was substituted.

See [verification record](event-verification.md) for actual results and unexercised cases.

## Local setup and checks

Use Node 24.14.0 and npm 11.9.0. From an isolated checkout:

```sh
npm ci
cp .env.example .dev.vars
npm run db:migrate:local
POLIS_TEST_ACCOUNTS=1 npm run dev -- --hostname 127.0.0.1 --port 5176
```

In a second terminal:

```sh
npm run lint
npm run typecheck
npm test
npm run build
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:http
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:social-http
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:events-http
npx playwright install chromium
POLIS_TEST_ORIGIN=http://127.0.0.1:5176 npm run test:browser
```

The social/event HTTP scripts create synthetic A/B/C identities and local test activity; run them before the browser script. All three reject hosted origins. They must never run against production. The event script imports through the authenticated API, not directly into D1. `.dev.vars`, D1 state, screenshots and test activity stay outside Git. The test shim is development-only. See the [social-cycle record](social-cycle-verification.md) for browser evidence and its limits.

## Deployment and migrations

Keep `.openai/hosting.json`, its source remote and current private audience. Migration `0003_gorgeous_wong.sql` adds series, dated occurrences, preferences and suggestion review. Ship all generated migration history in the Sites artifact; do not edit applied migrations or reset the database. Existing plan and save records are retained.

Build with the installed Sites build workflow; commit and push that exact source to the Sites-provided branch using the native connector credential; package and save that same commit, then deploy with the site's existing audience. Verify HTTPS in fresh authorized sessions before handing it to testers. `POLIS_OWNER_EMAIL` is a server-side Sites runtime secret; use the existing configured owner, never the example local identity. Authentication returns to the original hash route through the existing relative `return_to` flow.

## Listings and feedback

The owner opens **Community tools → Manage event listings & suggestions** (`#event-manager`). Members with a server-assigned `curator` role can use **Manage events**. Owners are curators by default; assigning additional curators currently requires the operator to update the invited membership role through the trusted database administration path.

- Add an occurrence, record its organizer source, enter local date/time with an explicit UTC offset and IANA timezone, then publish. Reuse a series ID for recurring dates; each date has its own immutable ID, saved records and attendance.
- **Import 17 checked pilot listings** creates missing IDs only. Repeating it preserves edits, cancellation, archives, saves and discussions. This is a dated seed, not an automatic feed. Review sources and refresh the catalog before importing it in a later season.
- Cancel removes an occurrence from upcoming discovery while retaining its explanatory direct page and private saved history. Archive also removes it from upcoming discovery. Draft withdrawal hides its related conversations and notification previews.
- Suggestions enter the curator queue. Preparing a listing does not publish automatically. Reported listings/posts/comments enter the existing owner-only **Community tools → Reports** queue; resolving a listing removal archives it.

## Tester journey once the hosted release is verified

The site has public access. A tester still needs an email-bound Polis community invitation from the owner. Changing the profile city cannot grant membership. Sign in with the invited ChatGPT account; open the shared `#event/<occurrence-id>` link; optionally choose interests; save; choose Interested or Going; set Private, Friends, or Community visibility deliberately; start a conversation and respond from a second accepted friend's account. Reload and verify persistence. Community means invited community members, not the anonymous internet. Save is always private and RSVP is intention only; organizer registration is separate.

## Data and privacy

The API derives identity from trusted Sites authentication and checks membership on every social operation. Curator commands verify membership role again inside the transaction. Save and RSVP keys prevent duplicate rows; request receipts handle duplicate retries; transactional guards reject an RSVP if the event was canceled or rescheduled before commit. A series/date uniqueness index prevents duplicate occurrences under another ID.

Private preferences, saves and plans are returned only to their owner. Friends plans require an accepted friendship; community plans require membership. Blocking removes mutual social visibility; muting suppresses the other person's feed/notification/attendance display. Names and counts derive only from permitted plans. Changing the audience retires the prior event-plan post and starts a new conversation rather than carrying replies into a wider audience.

Event metrics use aggregate actor markers, no event object ID, and day-level timestamps: opens, link sharing, saves, RSVP changes and interest completion. They contain no precise location, political text, discussion text or private attendee identity. Existing social activation/return-session metrics remain unchanged. No attendee identities are used to explain recommendations.

## Location and map limitations

Date/category/free/city filters and the list work without a map provider. Distance uses the selected Ithaca center by default, or a location requested only by **Use my location**. Device coordinates remain in component memory and never enter a request, URL or storage. No geocoder is integrated: another city shows matching curator listings; distance needs supplied coordinates or an explicit location request.

The Leaflet basemap uses standard OpenStreetMap tiles and attribution. Current local provider access returned an `x-blocked` response during testing; do not claim the basemap is verified until tiles render in the deployed domain under the provider's usage policy. Pins and list selection use supplied venue coordinates, grouped by venue. Unmapped events remain in the list and are excluded by an active distance cutoff. Known locations currently cover the market and Cornell welcome center; downtown festival/civic/volunteer locations have descriptive addresses but no invented coordinates.
