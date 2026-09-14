# Contributing to Polis

Follow [README.md](README.md) for runtime, clean install, local environment, and migrations. Read [architecture](docs/architecture.md), [design](DESIGN.md), and [roadmap](docs/roadmap.md) before changing behavior.

## Branch and review workflow

Start from GitHub `main` and create a focused `codex/<change>` branch. In a normal clone GitHub is `origin`; the recovered checkout uses the explicit `github` remote and a separate `sites` remote. Inspect `git remote -v` before fetching or pushing. Preserve unrelated work and never force-push or merge another pull request as a side effect.

```sh
git switch main
git pull --ff-only origin main
git switch -c codex/describe-change
```

Commit related changes with a descriptive message, push the branch to GitHub, and open a pull request against `main`. The initial import may initialize `main` only because GitHub is empty. Subsequent work goes through review; repository protection settings are not automatically configured.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Run `npm run test:http` against a local dev server for Worker/authentication changes. Fix new warnings; the seven inherited MVP warnings are recorded, not hidden. Do not add `continue-on-error`, empty tests, or success fallbacks to CI.

For UI changes, exercise the affected journey at desktop and mobile widths, capture screenshots with fictional data, and check keyboard focus, errors, empty states, overflow, and map/list parity. For data changes, test the actual service and migrations, including authorization failures and idempotent retries. Verify persistence through a new read, not just optimistic UI state.

The PR should explain the problem, resulting behavior, verification evidence, and remaining dependencies. Distinguish local fixture tests from three-real-identity hosted acceptance. Keep changes reviewable and do not silently expand product scope or update dependencies.

## Data, migrations, and deployment

Never commit runtime values, tokens, invites, user exports, or local database files. Inspect staged files and new history before publishing. Use synthetic reserved-domain fixtures, label sample civic content, and retain license notices. A new project license requires the owner's explicit choice.

Add versioned SQL migrations rather than changing applied files. Deployment is a separate Sites operation; successful GitHub checks do not update production. Changes to hosting audience, runtime secrets, or real member access require explicit task scope. See [deployment](docs/deployment.md) and [pilot setup](docs/PILOT_SETUP.md).
