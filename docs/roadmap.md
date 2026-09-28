# Roadmap

## Implemented in the imported source

- Original visual system, desktop sidebar/supporting rail, mobile navigation, assets, and isolated `/demo` MVP.
- Social API with durable profiles, invited membership, friendship requests, posts/questions/article shares, reactions, shallow replies, editing/deletion, saves, and in-app notifications.
- Audience/ownership checks, blocking/muting, owner moderation, idempotent writes, cursor pagination, and transactional guards.
- Private rankings with pairwise/manual ordering, separate support scores, published snapshots, profile lists, and comparisons of overlapping shared items.
- Issue follows, connected issue/item pages, update preferences, owner-managed daily questions and private/deliberately shared responses.
- Event map/list discovery, filtering, pan/zoom, details and reflections, and Interested/Planning to attend plans with explicit audiences.
- Minimal first-party events without private text, scores, political positions, or precise locations.

These describe the source implementation. Sites reports public version 2; later invitation changes remain local until published. Real hosted multi-user acceptance remains pending. See [hosted verification](hosted-pilot-verification.md) and [invitation codes](invitation-codes.md).

## Functional social beta additions

- Optional HTTPS sources on issue-linked opinions, article shares and event commentary; issue-level positions; retained drafts after rejected submissions.
- Following and Community home views, with a secondary followed-issues filter and clearer loading/failure messages.
- Friend-request notifications, notification read/unread controls, dual-recipient reply notifications and unavailable-comment feedback.
- Private issue priorities, explanations, reordering, explicit selected snapshots and a full own-profile list. Scored civic ratings and their existing comparisons remain separate.
- Skippable setup suggestions, friendship controls on profiles, private event saves from map/list discovery, a saved-events filter and clearly labeled sample calendar downloads.
- Three-session local Worker HTTP verification and an additive D1 upgrade. See [beta setup](BETA_SETUP.md).

## Community-event pilot additions

- Persistent dated event occurrences, private saves/RSVPs, chosen interests, explainable discovery and event discussions.
- Events/Issues Explore, geographic venue pins with list parity, filters, local times, private collections and calendar downloads.
- Curator listing lifecycle, member suggestion queue, existing owner reports, additive import of 17 organizer-verified occurrences.
- Privacy, date/filter, duplicate, transactional cancellation and three-session HTTP regression checks. See [event pilot setup](event-pilot.md) and [source record](event-sources.md).

## Reviewed community-platform candidate (September 27)

- Retains Claude's Home dashboard, reusable civic cards, entity pages, search, structured questions and additive Commons migration.
- Compact title-led Local / National discussions with New, Recently active and Following; private campus threads and explicit Across Polis discussions remain separate.
- Campus/town event associations, organizer-sourced photography, six additional dated campus/town listings, four real official portraits with new IDs, and one attributed national source note.
- Bundled OSM outlines replace external tiles. Venue icons show only server-permitted friends' plans and distinguish dated occurrences. Home pins open in place; browser Back restores discovery filters and scroll.
- Campus admission requires a code until an approved provider supplies verified university-email claims. An email string or editable location alone cannot grant membership.

See [Claude review and milestone evidence](claude-review-and-milestone.md) for assessment, changes, setup and the exact release gate. The source passes local synthetic-account verification; it is not yet published.

## Polis anywhere additions

- Find your community: search any town, city or university, or list communities near you. Start the first commons for a town, or found a campus community with a plain institutional email domain; later students with that domain are associated automatically.
- Every located community without a curated catalog gets a civic scaffold: local issues, offices described by role with official lookup links, Sample starter questions, and up to 60 civic places from OpenStreetMap.
- Server rules: duplicate towns within 25 miles are joined instead of created, a limit of three new communities a day, open town membership, campus domains taken only from the trusted sign-in email, and weekly place imports. See [Polis anywhere](anywhere.md).

## Known gaps

Sites management remains available, but its source host timed out on September 27. Version 2 remains live. The exact reviewed source and pending migrations must reach Sites before three real hosted identities can verify invitations, privacy, replies and plan persistence. Cornell release is gated on that acceptance; UF follows afterward.

The September 27 motion candidate is locally verified only. View Transitions need Chrome/Edge 111+, Safari 18+ or Firefox 144+; other browsers change views instantly. Real-device swipe-back, a screen-reader pass on transitions, and hosted performance remain untested. See [motion](motion.md).

The September 27 anywhere candidate is locally verified only:

- Production reachability and fair-use capacity of the public Nominatim and Overpass services from the Sites Worker are unconfirmed.
- Founder-created communities have no community-level moderators, rename, merge or archive UI; reports go to the pilot owner.
- Non-US civic structure is generic.
- Town membership does not verify residence.
- Campus founding and email-domain association require a verified-email assertion that Sites does not supply yet, so campuses are joined with invitation codes.

Apart from four reviewed officials with official portraits, the civic catalog names offices rather than officeholders; a checked source is required before adding more. Campus sample proposals, briefs, questions and event listings are labeled Sample. UF has no checked event bundle.

Both cohorts now have at least two checked campus and two checked town occurrences as of September 27. Coverage is date-sensitive and needs curator refresh before invitations. Some listings have no public coordinates and remain list-only. Existing civic sample proposals, briefs and starter questions stay labeled Sample. The four real officials have source credits; no image licensing guarantee is implied. University SSO/email verification and a broad automated news/content pipeline remain outside this milestone.

The open-signup candidate separates normal profile creation in Polis commons from optional university/organization codes. It preserves existing private-community memberships and the trusted Sites identity boundary. Direct Google-only sessions and email/password authentication owned by Polis remain unimplemented; email/Google use OpenAI's existing login. Source and local verification are documented in [open signup](open-signup.md); hosted acceptance remains pending.

The September 25 public showcase candidate adds a community-focused landing page and isolated interactive product examples. It awaits Sites publication; the source server remains unreachable from this network. Direct Google-only authentication is not implemented or confirmed as a supported Sites integration. The existing hosted OpenAI login does visibly offer Continue with Google; see [authentication path](authentication-path.md).

Community-specific invitation codes, optional usage limits, expiration, revocation, and login handoff are implemented and verified locally with two isolated browser accounts. They still await deployment because the current network cannot reach the Sites source server. See [invitation codes](invitation-codes.md).

Cornell/Ithaca and Emory are configured invitation destinations. Memberships, conversations, moderation and active-community preferences are separated on the server. Emory has no sourced event/issue/official catalog yet; it displays honest empty states. The broader location-resolution, officials, curator community-configuration, source-integration and campus-coverage brief remains future work. Selecting or joining a community does not verify enrollment or electoral residence.

The local social-cycle browser journey now passes with independent synthetic sessions, including mobile/desktop overflow, lost-response retry/reload recovery, notifications and attendance privacy. See [current browser verification](social-cycle-verification.md). Sites version 2 is now public, and hosted owner profile creation, event import and private save after reload pass. Hosted multi-user acceptance remains pending; see [hosted verification](hosted-pilot-verification.md).

- Legacy civic records, news, officials, demo map positions, and initial prompts remain fictional or illustrative. The new event catalog is separately sourced. Reference links do not establish those records as real local facts.
- Three isolated ChatGPT identities, invited site access, and production D1/authentication have not been exercised together.
- GitHub does not deploy production. Sites source synchronization and saved-version deployment are separate. A network restriction blocked the first publication attempt; Sites version 2 (source `0c42b64`) deployed on 2026-09-17, and every later revision in this repository remains undeployed until a new authorized Sites publication.
- GitHub Actions is not active: the available integrations lack permission to write workflow files. The reviewed workflow remains in `docs/ci.yml`; local checks are the current verification evidence.
- The original demo map remains schematic. The new social map uses supplied venue coordinates and locally bundled attributed outlines with a list alternative. Real-device pinch gestures, a full assistive-technology audit, load testing and production migration/restore drills remain.
- No automated metric dashboard or retention/deletion scheduler exists. Agree operational retention before a live pilot.
- Seven inherited lint warnings remain in original MVP components; address them in focused maintenance work. Organizer images intentionally use a native element with an explicit lint exemption.

## Next three milestones

1. **Verify the hosted social flow.** Use the deployed pilot to exercise A/B friendship/conversation with C denied private content. Record identity, persistence, revocation, blocking, and retry evidence.
2. **Replace samples with sourced local content.** Maintain the sourced event seed and curate Ithaca/Cornell issues, sources, registration requirements, and timelines; agree owner review responsibilities and freshness before inviting participants.
3. **Finish pilot usability and operations.** Activate the reviewed GitHub workflow after workflow permission is granted, validate map gestures and assistive-technology journeys on target devices, and establish retention, moderation, and minimal activation/reciprocity/return reporting.

External notifications, contact uploads, inferred political labels and continuous location tracking remain outside this release. Normal account signup is in the open-signup candidate; campus communities remain invitation-only. Propose and review broader social features before implementation.
