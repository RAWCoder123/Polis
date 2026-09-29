# Account signup and optional communities

Candidate: `codex/open-signup`, September 25, 2026. Not deployed.

## Behavior

- `/welcome` and the signed-out home offer account creation at `/#signup`.
- Sign-in was Sites' OpenAI login when this was written; since September 29, 2026 it is Clerk (an email code or Google, no OpenAI account and no Polis passwords). See [authentication](authentication-path.md).
- After login, choose a display name and username. `account.create` atomically creates the profile and membership in `polis` (Polis commons). Ordinary users receive member permissions. Only the configured, trusted owner identity can receive owner permissions.
- Existing profiles, private data, active communities and memberships are not replaced by a signup retry. Username conflicts leave no partial profile; double taps and lost-response retries retain the existing idempotency mechanism.
- `/#join` remains an optional flow with community preview/confirmation and an HttpOnly login handoff. Codes do not become passwords, and signup neither redeems a code nor grants Cornell/Emory access.
- Existing community members can explicitly select the open commons from the community selector. Protected community selection still requires membership. Location text cannot grant access.
- Community posts in the commons are available to other registered commons members. Friends remains the default post audience. Private groups and existing audience, ownership, block and mute rules remain enforced by the server.
- Polis commons starts with an honest empty issue/event catalog; the Cornell catalog is not copied into it. Codes currently represent community access, not referral analytics or proof of enrollment.

## Setup

No new dependencies, secrets, hosting configuration or database migration are introduced. Apply the existing migrations through `0006`, preserve the server-only owner setting, then deploy this exact source using the established Sites workflow. Do not reset any database. GitHub publication does not deploy Sites.

For synthetic browser verification, use a migrated isolated checkout with a fresh local database:

```sh
POLIS_TEST_ACCOUNTS=1 npm run dev -- --host 127.0.0.1 --port 5181
node scripts/verify-signup-browser.mjs
```

The script uses only explicitly enabled local test identities and refuses a hosted URL. It creates two local profiles, exercises failed submission/retry, skips optional codes, checks refresh persistence and protected-community denial, and creates/deletes a synthetic conversation. Screenshots go to `/tmp/polis-signup-qa`. On a repeated run, existing test profiles are reused and initial profile creation/failure is skipped.

## Release boundary

Verified locally: all 54 automated tests pass; lint has no errors and eight existing warnings; typecheck, production build and HTTP authentication-boundary smoke pass. Two isolated synthetic browser sessions at 390px and 1440px pass signup, optional-code skip, failed submission with retained fields, reload persistence, private-community denial, profile navigation, shared reply/notification/deep-link persistence and horizontal-overflow checks. A repeat browser run also verifies existing-account login. Mobile account setup omits the app's fixed bottom navigation so it does not cover the form. No browser page errors were observed.

Unit/service tests exercise the actual migration SQL and social service using isolated SQLite fixtures. Local browser tests use the development authentication shim, not real Google or OpenAI OAuth. The live OpenAI provider choices were observed in the preceding authentication assessment, but no real Google round trip has been completed.

Hosted acceptance must still verify new-account creation, existing-account login, optional-code handoff, and protected-community isolation across real identities. The Sites source server was unreachable at the previous publishing attempt; the Sites workflow plugin is also unavailable in the current environment. Do not describe this candidate as published until the exact source has been deployed and those checks run.
