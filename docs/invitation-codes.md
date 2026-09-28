# Community invitation codes

Implemented and locally verified September 24, 2026. This update is not deployed: Sites still reports live version 2, while this computer's connection to the Sites source repository times out. GitHub source and local tests do not establish hosted acceptance.

## Admin flow

Open **Community tools → Invite with a code**. Select **Cornell / Ithaca** or **Emory University**, choose an expiration of 1, 7 or 30 days, and optionally set a maximum of 1–10,000 distinct people. Defaults are 25 people and seven days. Clear **Limit the number of people** for no usage limit. Select **Generate code**, then **Copy code**. Copy before leaving the page; plaintext is shown only at creation. If clipboard access fails, the read-only input can be selected and copied manually.

Share the code with the Polis URL in any channel you choose. Polis does not collect recipient emails for this flow or send invitation emails. The list shows the community, redemption count, expiration and status. **Revoke code** prevents new admission and preserves existing memberships. The configured pilot owner can manage codes for both communities; any community-specific owner can only manage their own community's codes.

## Tester flow

Open Polis → **Enter invite code** → enter the code → confirm the university/community → complete the existing ChatGPT signup/sign-in → create a profile if needed → **Join**. Case, spaces and hyphens are ignored. Account authentication and any required email verification remain owned by the existing sign-in system.

The code is retained for up to one hour in an HttpOnly, SameSite=Lax cookie, with Secure on HTTPS. It is not placed in the login URL, browser storage, analytics or ordinary snapshots. The confirmation survives reload and the authentication redirect. Availability is checked again when joining. A failed submission leaves the invitation and entered form values available to retry. A successful acknowledged join clears the handoff cookie.

Existing members can join another community without replacing their profile, earlier membership, saves or rankings. The header's community selector remembers their active community; **Enter invite code…** opens the same flow on desktop and mobile. The invitation grants ordinary membership only, never owner/curator status or verified university enrollment. Repeating a redemption, including with a new request ID or from another device, does not use another slot. A member who already joined can continue after a code expires, fills or is revoked; that is existing access, not a new admission.

Legacy issued email-bound links still redeem under their original restriction. The admin interface offers generated codes only.

## Data and security

- Server-generated codes contain 12 uniformly sampled base32 characters (60 bits) plus the POLIS prefix. The code table stores SHA-256 digests. Plaintext is returned at generation and retained in the creator's existing authenticated command receipt for idempotent retries; admin listings omit both plaintext and hashes.
- Unique code/user redemption records, membership insertion, use-count increments and request receipts share one D1 transaction. Guards recheck capacity, revocation, confirmed community, ownership and database-clock expiration at commit.
- Anonymous preview exposes only the matched community, expiration and whether the authenticated caller already belongs. It reserves no slot and grants no access. Reads/writes of social data still require authenticated membership; code preview is the explicit pre-sign-in exception.
- Community post/deep-link access, event writes, reports and suggestion queues are scoped on the server. One campus curator cannot overwrite another campus event, including through a competing write for the same event ID.

## Migrations and configuration

Deploy the complete generated migration history with Sites. Migration 0004 adds the original code table. Migration 0005 adds community/limit fields, the active community preference, a composite community-membership table, unique redemptions and a view combining new memberships with untouched legacy memberships. Migration 0006 scopes reports and event suggestions. No applied migration is edited and no user database is reset. Existing code counts and memberships retain Cornell/Ithaca as their destination.

Available destinations are declared in `lib/social/communities.ts`. Add a stable ID, display name, slug and location label there to configure another invitation destination. This release does not include an admin community editor or geographic boundaries. Emory is an invitation/conversation pilot configuration with no sourced catalog; it does not substitute Ithaca content. The broader location/officials roadmap remains in `docs/roadmap.md`.

## Verification

- 50 unit/service tests pass, covering anonymous preview, ordinary role grants, confirmation tampering, expiration/revocation/last-use races, concurrent same-person redemption, unlimited codes, profile-conflict rollback, second-community joins, cross-community direct-request denials and migration preservation.
- Local D1 migrations 0000–0006 apply successfully. Lint has zero errors and eight inherited warnings; typecheck and the Workers production build pass.
- Local HTTP boundary, three-account social-cycle checks and event integration checks pass. The event HTTP test now uses a separate future synthetic RSVP fixture, keeping the 17 dated organizer imports unchanged when they expire.
- Desktop (1440×1000) and mobile (390×844) Playwright flows pass using isolated synthetic accounts: generate/copy → anonymous validation → university confirmation → local sign-in redirect → profile completion → deliberately failed submission → retry → reload. A second account joins using the same code; duplicate admission preserves the count; revocation persists and denies an unrelated visitor. No browser runtime errors or horizontal overflow were found. Mobile community switching, keyboard focus and the invite entry action were checked after the final layout changes.
- Screenshots use synthetic accounts and mask generated codes. Production codes and tester messages were not created.
- Hosted OAuth, cookie behavior on the actual HTTPS domain, production migration and real multi-user acceptance remain unverified until publishing access is restored.

For a repeatable browser run, start from an isolated checkout with fresh local D1 data: `npm ci`, copy the synthetic `.env.example` to ignored `.dev.vars`, apply local migrations, and run `POLIS_TEST_ACCOUNTS=1 npm run dev -- --port 5180`. Then run `POLIS_TEST_ORIGIN=http://localhost:5180 npm run test:invitations-browser`. It redeems the code with new run-scoped synthetic accounts, so it can run before or after the other local suites (`test:http`, `test:social-http`, `test:events-http`, …) and repeat on the same database; see [Independent local suites](social-cycle-verification.md#independent-local-suites--september-27-2026). Do not reset an existing user database to run fixtures and never point these scripts at a hosted URL.
