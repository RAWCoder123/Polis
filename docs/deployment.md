# Source provenance and deployment

## Verified relationship at import

The source was recovered from the existing Sites project, not reconstructed from a scraped page. The original application commit is `a414d45386b64f8ba99d88cb7dd0133f983a34e4`. Sites metadata inspected on 2026-09-13 reports version 1 at that commit and the existing URL:

https://polis-community.raymondaw2006.chatgpt.site

The site is active, with only its owner in the custom access policy. No access, runtime, or production setting was changed for this import. The local social pilot and map improvements are later work; they are not yet the hosted version.

GitHub `RAWCoder123/Polis` was public and completely empty at inspection. The import initializes `main`; subsequent development uses pull requests. The recovered checkout initially had no configured remotes, so an explicit `github` destination and the existing hosting repository as `sites` were added. A new GitHub clone normally calls GitHub `origin` instead.

| Remote | Purpose |
| --- | --- |
| `github` (or `origin` in a fresh clone) | `https://github.com/RAWCoder123/Polis.git`; development and validation |
| `sites` | Existing hosting-managed source repository; separate authenticated synchronization |

The project identity and logical `DB` binding remain in `.openai/hosting.json`. The hosting source endpoint is a Git repository, not the deployed website. Obtain current source credentials through Sites when publication is authorized; never store them in remote URLs or Git configuration.

## History and public-data review

The original MVP commit is preserved. Later local commits retain their file trees, messages, ordering, and dates in public history; machine-generated email metadata was replaced with the owner's GitHub no-reply identity. Original commits and the original dirty checkout remain locally. Hashes change when metadata changes; no GitHub history was overwritten or force-pushed.

The import includes source, assets, lockfile, schema/migrations, and synthetic tests. It excludes private environment files, credentials, invite links, local activity, logs, and user exports. Existing third-party licenses remain unchanged. No application license was added.

## Publication is separate from GitHub

There is **no automatic GitHub-to-Sites deployment**. GitHub Actions only validates source and has no production credentials or deployment steps. Public source does not make the deployed site public.

When a later task explicitly authorizes publication:

1. Verify the intended GitHub revision, source diff, tests/build, and pending migrations. Preserve the existing Sites project and audience.
2. Obtain a fresh, scoped Sites source write credential and synchronize that exact source to the hosting repository. Reconcile its history first; public metadata normalization may require a deliberate source merge. Do not force-push.
3. Build/package that exact source with the Sites workflow, including assets, Worker, manifest, and migrations. Save a version and deploy through the operation matching the existing audience.
4. Verify deployment, trusted sign-in, migrations, and three-identity acceptance before claiming pilot readiness.

The prior publication attempt encountered a network restriction reaching the Sites Git server, recorded in [VERIFICATION.md](VERIFICATION.md). This import does not retry or bypass it. GitHub development works independently.

Production needs server-only `POLIS_OWNER_EMAIL`, Sites authentication/access, and managed `DB`. No real runtime value belongs in `.env.example` or GitHub Actions. Hosting access and Polis invitations are separate gates; see [PILOT_SETUP.md](PILOT_SETUP.md).
