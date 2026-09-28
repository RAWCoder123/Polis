# Commons candidate: Cornell / Ithaca and UF / Gainesville

Verification date: September 26, 2026. Branch: `codex/cornell-uf-commons`.

This is a locally verified candidate, not a deployed two-campus pilot. The existing public Sites project still reports version 2. Its access policy was not changed. No real invitation codes, test people, runtime owner values or local database files are committed.

## Source reconciliation

| Source inspected | Revision | Meaning |
| --- | --- | --- |
| GitHub `main` | `19fdb67` | Imported MVP; not this release |
| GitHub `codex/community-events-pilot` | `03c0898` | Event candidate plus early reusable codes |
| Existing Sites version 2 | `0c42b64c2b70f5eebb7499db9da13864f1575b45` | Previously deployed social/event source; migration package through 0003 |
| This branch's parent | `f6f980b` | Showcase, scoped invitation codes, normal signup and optional invitations |

The PR targets `main` and therefore includes the earlier, still-unmerged candidates. This is not evidence that they are deployed. The original checkout's unrelated workflow files remain untouched.

## Implemented behavior

- One shared application and service, with explicitly selected campus scope. Cornell and UF feeds, sourced updates, organization membership, codes and reporting are isolated by the server. Displayed city or campus is not enrollment verification.
- Commons offers Question, Debate and sourced Update posts. Optional positions remain distinct from reactions and rankings. Replies, fixed audiences, edit/delete, save, report, block/mute and exact notification links reuse the existing social system.
- Follow a thread and reopen it from Followed threads or an opted-in reply notification. Cards show accessible reply counts and latest visible activity. New normal and code-based accounts start with notifications off; existing preferences, including legacy onboarding defaults, are preserved.
- Two locally researched topics per campus, source documents, checked dates, curator updates and links to related event places. Facts and member perspectives are separate. Missing local coverage is explicit.
- Each campus has one **independent Polis tester circle**, not a university-endorsed organization. Announcements, Discussion and Events / Plans are views over existing posts/replies. Only members can read private organization threads. Organizers can issue codes; only the campus owner appoints organizers. Codes grant ordinary member access.
- An organization code requires matching campus membership first. Capacity, expiration and revocation are transactionally checked. Retries do not consume another slot. Publishing a copy into Commons starts a separate conversation without private replies.
- Topic follows and notification links work from Home, profile and source details. Curators can associate new events with the sourced topics. Gainesville is an available city center; event pins continue to represent supplied venue coordinates. Cornell event import is offered only inside Cornell/Ithaca.
- Existing account IDs, posts, saved items, rankings, `/demo`, sign-in routes and public site audience are preserved. Normal account signup stays separate from restricted campus admission, as requested in the preceding signup work.

## Entry and operator flow after deployment

Use the deployed domain with **`/#join/ithaca`** for Cornell and **`/#join/uf`** for UF. These routes check that the code matches the selected campus. No production code was generated in this task.

1. The configured trusted owner opens **Community tools** (`/#admin`) and selects the campus under Pilot communities. This creates only the owner's matching management membership and tester-circle organizer role.
2. Generate a campus code with an expiration and optional limit. Share it with that campus's invited cohort. Revoke unused codes in the same screen.
3. A tester opens the matching entry route, checks the code, confirms the campus, completes the existing OpenAI sign-in, and creates their profile if needed. The HttpOnly handoff retains the invitation for up to one hour through login.
4. On Commons, explicitly enable in-app reply notifications, open a local topic, ask a question or start a debate, and choose Friends or the campus community audience. A second admitted member replies; the notification opens that exact reply.
5. Open the tester circle from Commons. The owner can appoint an organizer from existing campus members. That organizer generates a separate organization code. Already admitted campus members redeem it through the same campus entry route.
6. Organization announcements require an organizer. Discussion and plans accept ordinary members. Removing member access immediately removes their thread/saved-link access. Revoking a code stops future admissions; it does not remove already admitted members.

Reports for both Commons and organization content enter the **campus owner's Community tools moderation queue**. Event curation and suggestions use **Manage events** (`/#event-manager`). There is no new email invitation or external notification system.

## Authentication and student identity gate

The implemented method is the existing dispatch-owned **Sign in with ChatGPT/OpenAI**. Sites owns login, callback and sign-out; Polis accepts only its trusted identity headers. Google in the OpenAI account chooser is not direct Google authentication in Polis. A local test login is not hosted identity verification.

- Cornell's [Shibboleth service](https://it.cornell.edu/shibboleth) requires an approved service-provider integration and attribute release. [Student Google Workspace](https://it.cornell.edu/gsuite-student) also includes alumni. [Cornell email guidance](https://it.cornell.edu/email-cornell) allows differing email systems. Neither a Cornell address nor a Google login proves current student status.
- UF's [single-sign-on guidance](https://it.ufl.edu/iam/authentication-systems/single-sign-on/) prefers SAML2, describes OIDC as an alternative, and requires university registration/risk/IAM involvement. [GatorLink](https://it.ufl.edu/helpdesk/self-help/gatorlink-account-resources/) also serves faculty/staff and other affiliates. Do not assume Google Workspace or a student affiliation claim.
- The current Sites authentication guide does not supply an approved institutional SSO integration contract. No authorized campus-verification email sender is configured for this implementation. **Campus inbox verification and student-status verification are blocked, not simulated.** No Google/campus-specific button or student badge is displayed.

Institutional account linking must be a future explicit operation attached to the existing stable Polis ID; never merge accounts by matching email. Existing users retain their posts and saves. Sign-out uses `/signout-with-chatgpt`; another signed-in identity must redeem its own membership. Invitation handoff and codes expire independently. Revoking a code does not revoke the OpenAI account or existing campus membership. Alumni/affiliate access must be an explicit pilot policy; invitation admission currently asserts membership only. Wrong campus, revoked/expired/replayed codes and cross-account access are tested; email-domain/token verification tests are not applicable until an email/SSO integration exists.

## Content coverage

All four source pages were checked September 25, 2026. They are manually curated background, not a live news feed or fabricated participation.

| Campus | Topic and source | Date/coverage |
| --- | --- | --- |
| Cornell | [TCAT fall 2026 service announcement](https://tcatbus.com/tcats-2026-fall-service/) | Published August 7, 2026; current-service context, consult operator alerts |
| Cornell | [Climate Action Plan](https://sustainable.cornell.edu/climate-action/climate-action-plan) | Publication date not supplied; background, not a new decision |
| UF | [Fall 2026 transit updates](https://taps.ufl.edu/fall2026transit/) | Publication date not supplied; operator notice |
| UF | [History of climate action](https://sustainable.ufl.edu/campus-initiatives/uf-climate-action/history-of-climate-action-at-uf/) | Historical background, not evidence of new progress |

The existing Cornell organizer bundle has 17 dated records checked earlier; some may now be ended. This task does not claim 17 currently upcoming events. UF has **no newly verified upcoming event bundle**. Its listing/suggestion tools work, and the empty state is intentional. The browser script creates explicitly SYNTHETIC events only in a local test database to exercise links/map behavior.

Document icons and existing missing-image/category fallbacks remain. No new licensed building photographs, official headshots, authorized organization logos or reliable UF official roster were supplied. Richer civic-map subjects, official cards and images are follow-ons under the brief's core-loop release gate; no fake officials or coordinates purporting to identify real venues were added. Approximate city centers only orient the map. No universal civic graph, ingestion pipeline, videos or separate chat backend was introduced.

## Database and local setup

Use Node 24.14.0 / npm 11.9.0, `npm ci`, and `npm run db:migrate:local`. Do not reset an existing database. The new additive migrations are:

- **0007_outstanding_zarda.sql:** conversation follows; community scope for issue updates and minimal metrics.
- **0008_strange_nocturne.sql:** organization memberships, organization-scoped posts and invitation codes.

Earlier migration files are unchanged. A target on hosted version 2 also needs the pending 0004–0006 migrations in order. Sites must package/apply the entire ordered history. The upgrade regression verifies legacy profiles, memberships, private saves and code usage survive. New nullable organization fields keep old posts/codes in their original scope.

For isolated local browser QA, use a separate checkout/database, set only a **synthetic** owner matching the local sign-in shim in ignored `.dev.vars`, migrate, and start `POLIS_TEST_ACCOUNTS=1 npm run dev -- --host localhost --port 5182`. Then run `POLIS_TEST_ORIGIN=http://localhost:5182 node scripts/verify-commons-browser.mjs`. It uses three separate synthetic browser identities per campus, plus a curator, and leaves clearly labeled fixtures in that local database. Never run fixture writes against a deployed site. No production test-identity option is included in the Worker.

## Verification record

- `npm run lint`: passed with zero errors and the seven inherited MVP warnings (the organizer-image warning now carries an explicit exemption; this record originally counted eight).
- `npm run typecheck`, `npm test`: passed; **67 tests** at the candidate's final commit (56 when this record was first written). Includes organization capacity/retry/role restrictions, in-flight code revocation, private-copy separation, access removal, reporting, block/mute, campus switching and cross-campus isolation.
- `npm run build`: production Worker/client build passed.
- `POLIS_TEST_ORIGIN=http://localhost:5182 npm run test:http`: passed anonymous isolation, forged-header stripping, cookie/origin/auth rejection and no-store checks.
- Six isolated Playwright sessions completed campus entry → scoped question → reply → exact notification → follow → source/update → organization code → private announcement/reply → reload. Direct unrelated-account reads returned 404; explicit other-campus queries returned 403.
- Both campus topic/event links, map/list selection, missing images, blocked basemap tiles, denied location permission and correct city/timezone rendering passed using synthetic local events. 320, 390 and 1440 px views passed overflow checks; keyboard focus and reduced-motion behavior were exercised. No browser runtime errors.
- Early browser harness runs needed correct waits for asynchronous state and 404 expectations at the HTTP boundary. Screenshots were corrected to wait for ready content instead of recording loading states. The final complete run passed. No production acceptance is inferred from these fixtures.

Screenshots are local artifacts under `/tmp/polis-commons-qa/`, including each campus's mobile home, conversation, topic and map fallback, and desktop conversation/organization views. They show synthetic names/content only. A full screen-reader audit, real-device gestures and hosted callback/session tests remain.

## Publishing blocker and rollout

Native Sites metadata is available and confirms the existing public version 2. The official Site workflow could not complete its source operation. A fresh connection check to **`git.chatgpt-team.site:443` timed out after eight seconds** on September 26. The exact candidate therefore cannot yet be synchronized, packaged and deployed through the authorized workflow from this machine. No new version or deploy URL is claimed; GitHub is source backup only.

Minimum unblock: restore this machine's HTTPS connectivity to the Sites source server, or run the official workflow from an authorized environment that can reach it. Then obtain a fresh scoped source credential, reconcile the hosted source, rerun remaining checks against that exact source, package migrations with the official build helper, save a version and deploy while preserving the public site audience.

Start with Cornell only: generate a limited Cornell code and verify real hosted sign-in, exact reply links, persistence, private access, retry/revocation and moderation with three authorized identities. Only then issue UF campus codes and repeat the same acceptance. UF is configured but has not been opened to a real tester cohort in this task. Real hosted accounts are an additional acceptance dependency even after publishing succeeds.

Rollback: revoke unredeemed rollout codes and redeploy the previously reviewed source version using Sites. Do not roll back SQL by deleting tables or resetting D1. Additive tables/columns retain new activity until the candidate can be repaired/redeployed. Preserve existing configured community IDs and memberships when hiding a new entry point; a schema reset would destroy user data and is not a rollback method.

## Does Commons prove return use?

Not yet. The social loop works in local verification; it has no real retention evidence. The existing minimal metric store now records campus-scoped contribution/reply events, organization contributions, daily activity and a deduplicated daily return to a followed thread, without text, positions or device coordinates. Count first and second contributions per account/campus, organization participation, followed-thread return days, and activity in a later calendar week. Treat a reload on the first day as interaction evidence, not weekly retention. Historical metric rows default to Ithaca; use the eventual deployment cutover for two-campus comparisons rather than inferring old activity's campus. Aggregate reporting and retention policy remain operator work, not a new analytics dashboard.

Next priorities: unblock exact-source deployment and Cornell hosted acceptance; supply checked UF event/official coverage before its cohort; review a week's actual reciprocal conversations and return days before expanding scope.
