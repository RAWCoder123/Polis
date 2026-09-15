# Roadmap

## Implemented in the imported source

- Original visual system, desktop sidebar/supporting rail, mobile navigation, assets, and isolated `/demo` MVP.
- Social API with durable profiles, invited membership, friendship requests, posts/questions/article shares, reactions, shallow replies, editing/deletion, saves, and in-app notifications.
- Audience/ownership checks, blocking/muting, owner moderation, idempotent writes, cursor pagination, and transactional guards.
- Private rankings with pairwise/manual ordering, separate support scores, published snapshots, profile lists, and comparisons of overlapping shared items.
- Issue follows, connected issue/item pages, update preferences, owner-managed daily questions and private/deliberately shared responses.
- Event map/list discovery, filtering, pan/zoom, details and reflections, and Interested/Planning to attend plans with explicit audiences.
- Minimal first-party events without private text, scores, political positions, or precise locations.

These are local implementation claims. The hosted site still runs the original MVP; real hosted multi-user acceptance remains pending. See [verification](VERIFICATION.md).

## Functional social beta additions

- Optional HTTPS sources on issue-linked opinions, article shares and event commentary; issue-level positions; retained drafts after rejected submissions.
- Following and Community home views, with a secondary followed-issues filter and clearer loading/failure messages.
- Friend-request notifications, notification read/unread controls, dual-recipient reply notifications and unavailable-comment feedback.
- Private issue priorities, explanations, reordering, explicit selected snapshots and a full own-profile list. Scored civic ratings and their existing comparisons remain separate.
- Skippable setup suggestions, friendship controls on profiles, private event saves from map/list discovery, a saved-events filter and clearly labeled sample calendar downloads.
- Three-session local Worker HTTP verification and an additive D1 upgrade. See [beta setup](BETA_SETUP.md).

## Known gaps

- Civic records, news, officials, dates, map positions, and initial prompts are fictional or illustrative. Reference links do not establish those records as real local facts.
- Three isolated ChatGPT identities, invited site access, and production D1/authentication have not been exercised together.
- GitHub does not deploy production. Sites source synchronization and saved-version deployment are separate; a prior network restriction prevented the last publication.
- GitHub Actions is not active: the available integrations lack permission to write workflow files. The reviewed workflow remains in `docs/ci.yml`; local checks are the current verification evidence.
- The map is schematic. Real-device pinch gestures, a full accessibility audit, load testing, and production migration/restore drills remain.
- No automated metric dashboard or retention/deletion scheduler exists. Agree operational retention before a live pilot.
- Seven inherited lint warnings remain in original MVP components; address them in focused maintenance work.

## Next three milestones

1. **Verify the hosted social flow.** Resolve Sites source access, prepare the exact validated revision, deploy through an explicitly scoped task, and exercise A/B friendship/conversation with C denied private content. Record identity, persistence, revocation, blocking, and retry evidence.
2. **Replace samples with sourced local content.** Curate Ithaca/Cornell issues, sources, events, registration requirements, and timelines; agree owner review responsibilities and freshness before inviting participants.
3. **Finish pilot usability and operations.** Activate the reviewed GitHub workflow after workflow permission is granted, validate map gestures and assistive-technology journeys on target devices, and establish retention, moderation, and minimal activation/reciprocity/return reporting.

External notifications, contact uploads, inferred political labels, continuous location tracking, and public registration remain outside this release. Propose and review broader social features before implementation.
