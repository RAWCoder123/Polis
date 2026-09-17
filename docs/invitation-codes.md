# Reusable invitation codes

Implementation is saved for the next deployment. It is not present in the live version 2 pilot yet.

## Owner and tester flow

Open **Community tools → Invite with a code**. Choose 1, 25 or 100 people and an expiration of 1, 7 or 30 days, then **Generate invitation code**. The default is 25 people for seven days. Copy the code and send it with the public Polis site link. No email list is required. The generated code is displayed only after creation; copy it before navigating away.

Testers sign in with ChatGPT and enter the code when creating their profile. Matching ignores case, spaces and hyphens. Each successful new profile consumes one use. Existing email-specific invitations still work and retain their email restriction.

The owner sees each code's creation date, expiration, use count and status. **Revoke code** stops future joins without removing existing members. Shared codes grant normal community membership, not owner permissions or access to Friends/private activity. Anyone who receives a valid code can redeem it until its limit or expiration.

## Persistence and migration

Additive migration `0004_odd_lord_hawal.sql` creates `invitation_codes`; it does not edit or reset existing tables. Deploy all migrations with the Sites artifact. The table stores a SHA-256 code digest; plaintext is returned on creation and retained in the existing owner-only command receipt for idempotent retries. Admin listings omit both the plaintext and digest.

Codes contain 12 random base32 characters (60 bits) plus the `POLIS` prefix. Membership creation, count increment and the idempotency receipt share one transactional batch. Transaction guards check remaining capacity, revocation and expiration before creation, including concurrent redemption of the last use. Owner authority is checked again in the mutation transaction.

## Verification

- 42 unit/service tests pass, including separate-email redemption, normalization, duplicate retries, capacity exhaustion, invalid/expired/revoked codes, owner-only management, and races between redemption and the last use or revocation.
- Existing migration-upgrade coverage preserves profiles and saved activity while applying the additive history; all migrations also apply successfully to a fresh local D1 database.
- Local HTTP boundary and three-session social checks pass. Added HTTP checks verify owner-only code generation/revocation, retry deduplication, private metadata and persisted revocation.
- Lint passes with eight inherited warnings; typecheck and production build pass.
- Chrome blocked the local UI with `ERR_BLOCKED_BY_CLIENT`. Desktop/mobile visual verification and hosted code redemption remain pending. No browser security settings were changed.
- Sites publishing tools became unavailable again during this work. No production invitation code was generated, and no tester messages were sent.
