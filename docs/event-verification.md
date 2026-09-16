# Event release verification — September 16, 2026

Update: the later [social-cycle browser verification](social-cycle-verification.md) passes at desktop and mobile widths, with 39 unit/service tests after retry fixes. It supersedes the earlier inability to capture mobile evidence below. Hosted deployment/authentication and basemap imagery remain unverified.

## Verified locally

- Node 24.14.0 / npm 11.9.0; `npm ci` completed (680 packages). Only Leaflet and its types were added; existing locked package records were preserved.
- `npm run lint`: no errors. Eight warnings remain: seven inherited demo warnings and one native organizer-image warning.
- `npm run typecheck`: passed.
- `npm test`: 37 tests pass, including real migration/service tests, private attendance and saves, repeated submissions, suggestions/curation, canceled/ended privacy changes, cancellation and role-revocation races, occurrence uniqueness, filters/timezones, and calendar injection protection.
- `npm run build` and the Sites build helper completed. The final build includes the new migration in `dist/.openai/drizzle`.
- Local D1 applied migrations 0000–0003 successfully. The SQLite upgrade test preserves pre-existing profile/save data; no user database was reset.
- `test:http`: forged identities, invalid sessions, same-origin/content-type checks and anonymous isolation passed.
- `test:social-http`: three synthetic identities exercised invitation/friendship, private-content denial, reactions, replies, exact notifications, edits, deletion, blocking and muting against the actual local Worker and D1.
- `test:events-http`: 17 official occurrence imports repeated without duplicates; independent synthetic sessions exercised persistent interests/saves, private and friends plans, replies/notifications, ownership denial, member suggestions and owner moderation.

The HTTP fixtures are synthetic and isolated from the hosted site. They prove the local Worker boundary and shared local D1 behavior, not real ChatGPT authentication or production access.

## Browser evidence and remaining QA

Safari desktop: exercised interest selection and save; inspected recommendations and explicit map/list selection; opened a dated market page; saved privately; selected Going with its default Private audience; reloaded and confirmed both; changed to Friends through an explicit Save new visibility action. A desktop screenshot is saved locally in ignored `outputs/event-desktop.png` (synthetic profile only).

A second Safari cookie origin (`localhost`, separate from `127.0.0.1`) rendered the event in a 390 × 844 CSS-pixel iframe as another authorized synthetic account. The accessibility tree showed its own unselected Save/RSVP controls, the permitted friend's Going plan and the existing discussion/reply entry point. Full mobile gesture/layout/overflow verification and a reliable mobile screenshot were not completed: browser connector discovery returned `unsupported Codex auth method: apikey`, and native browser control became unstable (missing window/frame and mismatched active-window captures). No unrelated browser screenshot was saved as product evidence. Temporary QA pages were removed before final packaging.

Map pins group dated occurrences at two supplied venue positions, and selecting a pin updates the matching list selection. The basemap remained unrendered during inspection; a provider request returned an `x-blocked` access response. A loading/error explanation and the equivalent event list remain available. Hosted tile rendering, real-device pinch, denied-geolocation UI, complete keyboard navigation, screen-reader flow, and reduced-motion behavior remain unverified.

Read-only engineering review found and corrected three issues: inactive-event privacy changes were rejected; draft previews offered unsupported actions; source-link controls could inject calendar properties. Service and calendar regressions pass after those fixes. Visual checks after the last select-size/focus correction remain pending.

## Deployment status

No event-pilot version was saved or deployed. The earlier owner-private HTTPS site continues to serve the old prototype. Two normal requests to `https://git.chatgpt-team.site/` timed out at 12 seconds; no alternate DNS, tunnel or untrusted Worker origin was used. Sites connector tools then became unavailable in the current task, preventing the required native source-credential/save/deploy steps.

Minimum completion path: restore Sites connector access in this task and approved connectivity to the source host; deploy the exact reviewed commit with migration 0003 and existing server-only owner configuration; retain the site's private audience; authorize two or three tester identities through site access and email-bound Polis invitations; exercise login → event deep link → save/RSVP/reply → reload on HTTPS. Recheck the dated organizer catalog before sending invitations.
