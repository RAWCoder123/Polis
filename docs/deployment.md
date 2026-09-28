# Source provenance and deployment

## Current release handoff — September 27, 2026

GitHub is the development source; Sites remains the existing host. PR #10
(`codex/civic-milestone-review`) contains the consolidated PR #8 foundation and
the reviewed campus civic milestone. PR #9 (`codex/polis-anywhere`) and Claude's
motion work are separate candidates, not automatically included in that release.
Merging the anywhere candidate must preserve the review's explicit verified-campus-email
boundary rather than restore admission from an email string.

Sites management and fresh repository credentials are available in Codex. The
remaining publication blocker is the network: on September 27, the system resolver
returned `128.253.129.105` for `git.chatgpt-team.site`, consistent with the Cornell
blocking destination reported in Claude's audit, and an HTTPS connection timed
out after eight seconds. An earlier authenticated Git read with a fresh scoped
credential also timed out. No DNS override, security-warning bypass, alternate
hosting origin, or tunnel was used.

Minimum action: retry on a network that can reach the Sites source host, or have
the network operator resolve the block. No plugin reinstall is indicated. Then
synchronize the exact reviewed GitHub release to the existing Sites repository,
package/save/deploy it, and verify the published revision and real accounts.
GitHub pushes alone do not update the website, and no automatic integration has
been configured. Sites still reports public version 2, updated September 17.
The audience, database and runtime settings remain unchanged.

## Verified relationship at import

The source was recovered from the existing Sites project, not reconstructed from a scraped page. The original application commit is `a414d45386b64f8ba99d88cb7dd0133f983a34e4`. Sites metadata inspected on 2026-09-13 reports version 1 at that commit and the existing URL:

https://polis-community.raymondaw2006.chatgpt.site

The site is active, with only its owner in the custom access policy. No access, runtime, or production setting was changed for this import. The local social pilot and map improvements are later work; they are not yet the hosted version.

GitHub `RAWCoder123/Polis` was public and empty at the first inspection. On resuming setup, it already contained the imported source at `19fdb676080ab149793a6abe4c82a7a7fe7d8f98` on `codex/polis-social-pilot`. That published history is preserved. `main` starts at the same commit; the remaining setup is submitted through a pull request. The recovered checkout originally had no configured remotes, so explicit `github` and `sites` remotes were added. A fresh GitHub clone normally calls GitHub `origin` instead.

| Remote | Purpose |
| --- | --- |
| `github` (or `origin` in a fresh clone) | `https://github.com/RAWCoder123/Polis.git`; development and validation |
| `sites` | Existing hosting-managed source repository; separate authenticated synchronization |

The project identity and logical `DB` binding remain in `.openai/hosting.json`. The hosting source endpoint is a Git repository, not the deployed website. Obtain current source credentials through Sites when publication is authorized; never store them in remote URLs or Git configuration.

## History and public-data review

The original MVP and subsequent published commits are preserved. An initial local preparation normalized machine-generated email metadata, but the repository was populated with the original history before setup resumed. The setup therefore uses that existing public history without rewriting it. New setup commits use the owner's GitHub no-reply identity. Older commits still contain machine-generated author email metadata; removing that from published history would require a separately coordinated history/privacy cleanup. No credential was found in tracked source, and no credential rotation is claimed. No GitHub history was overwritten or force-pushed.

The import includes source, assets, lockfile, schema/migrations, and synthetic tests. It excludes private environment files, credentials, invite links, local activity, logs, and user exports. Existing third-party licenses remain unchanged. No application license was added.

## Publication is separate from GitHub

There is **no automatic GitHub-to-Sites deployment**. The prepared GitHub Actions definition only validates source and contains no production credentials or deployment steps; activation currently awaits workflow-write permission. Public source does not make the deployed site public.

When a later task explicitly authorizes publication:

1. Verify the intended GitHub revision, source diff, tests/build, and pending migrations. Preserve the existing Sites project and audience.
2. Obtain a fresh, scoped Sites source write credential and synchronize that exact source to the hosting repository. Reconcile its history first; public metadata normalization may require a deliberate source merge. Do not force-push.
3. Build/package that exact source with the Sites workflow, including assets, Worker, manifest, and migrations. Save a version and deploy through the operation matching the existing audience.
4. Verify deployment, trusted sign-in, migrations, and three-identity acceptance before claiming pilot readiness.

The import originally encountered a network restriction reaching the Sites Git server, recorded in [VERIFICATION.md](VERIFICATION.md). The current retry is recorded above. GitHub development works independently.

Production needs server-only `POLIS_OWNER_EMAIL`, Sites authentication/access, and managed `DB`. No real runtime value belongs in `.env.example` or GitHub Actions. Hosting access and Polis invitations are separate gates; see [PILOT_SETUP.md](PILOT_SETUP.md).
