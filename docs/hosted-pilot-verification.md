# Hosted pilot — September 17, 2026

Sites successfully deployed version 2 at https://polis-community.raymondaw2006.chatgpt.site on September 17, 2026, at 04:22 UTC. The deployed source is `0c42b64c2b70f5eebb7499db9da13864f1575b45`; the runtime uses environment revision 1 and the packaged migrations 0000–0003. The user explicitly selected public site access. Public site visibility does not grant community membership or change Friends/private audiences.

## Verified on HTTPS

- The Sites service reported the production deployment as succeeded.
- A new Chrome tab loaded the new social application on HTTPS. An existing ChatGPT-authenticated browser session reached profile creation, and owner profile creation completed through the production API.
- The owner imported all 17 organizer-sourced occurrences using the curator interface. No synthetic accounts, attendance or conversations were imported. One occurrence had already ended; its direct page remains available while upcoming discovery excludes ended occurrences.
- The market occurrence opened at `#event/market-saturday-2026-09-19` with its organizer link, date, timezone, privacy controls and separate registration explanation.
- Save privately completed, and the same event route still showed “Saved · Undo” after a full reload. This one private saved market entry remains in the owner's account. No attendance intention, political opinion or discussion was created during this hosted verification.
- A separate unauthenticated HTTP request to `/api/polis` returned 403. This confirms rejection of that request, not every production authorization case.

## Tester and curator flow

The owner opens **Community tools**, enters a tester's ChatGPT email, creates an invitation link, and shares it personally. No invitations have been sent by the agent. Testers sign in with that same email and redeem the invitation to create their Polis profile. Public site access means a separate Sites viewer allowlist is currently unnecessary.

Use **Community tools → Manage event listings & suggestions** for listing management and suggestions. Use **Community tools → Reports** for reported content. Event details retain their organizer sources; the selection is manually maintained rather than a live ingestion feed.

## Remaining checks and corrections

- Complete fresh sign-in and invitation redemption with a second authorized ChatGPT identity, then test friendship, reciprocal replies, notifications, private attendance and revocation on the hosted domain. Local three-account results remain separate in `social-cycle-verification.md`.
- Live basemap rendering, mobile gestures, screen-reader journeys and attendance changes were not verified in this hosted pass.
- Version 2 contains two owner invitation messages that still refer to a private site. A wording correction is saved with this record but is not part of the deployed version. Sites tools and the installed hosting helper became unavailable again after deployment; the already successful version 2 remains live.
- Sample civic issues and daily question content remain labeled. Organizer listings were sourced September 16; the market Sunday schedule and festival page were rechecked September 17. The Cornell page could not be refreshed in that later check, so its prior checked date is retained. Recheck all details before event attendance or organizer registration.

The previous network and missing-plugin deployment blockers in older documents are historical: the network change allowed the source push and deployment recorded above. End-to-end hosted multi-user acceptance is still pending.
