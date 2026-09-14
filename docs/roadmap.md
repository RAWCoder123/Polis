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

## Known gaps

- Civic records, news, officials, dates, map positions, and initial prompts are fictional or illustrative. Reference links do not establish those records as real local facts.
- Three isolated ChatGPT identities, invited site access, and production D1/authentication have not been exercised together.
- GitHub does not deploy production. Sites source synchronization and saved-version deployment are separate; a prior network restriction prevented the last publication.
- The map is schematic. Real-device pinch gestures, a full accessibility audit, load testing, and production migration/restore drills remain.
- No automated metric dashboard or retention/deletion scheduler exists. Agree operational retention before a live pilot.
- Seven inherited lint warnings remain in original MVP components; address them in focused maintenance work.

## Next three milestones

1. **Verify the hosted social flow.** Resolve Sites source access, prepare the exact validated revision, deploy through an explicitly scoped task, and exercise A/B friendship/conversation with C denied private content. Record identity, persistence, revocation, blocking, and retry evidence.
2. **Replace samples with sourced local content.** Curate Ithaca/Cornell issues, sources, events, registration requirements, and timelines; agree owner review responsibilities and freshness before inviting participants.
3. **Finish pilot usability and operations.** Validate map gestures, keyboard and mobile journeys on target devices; test failed submissions and inaccessible links; establish retention, moderation, and minimal activation/reciprocity/return reporting.

External notifications, contact uploads, inferred political labels, continuous location tracking, and public registration remain outside this release. Propose and review broader social features before implementation.
