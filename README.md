# Polis

Polis is an invite-only social app for politics and local civic life: discover an issue, express a view, hear from a friend, and follow what happens next. This repository is its development home.

The actual Sites application source is preserved, including the white/cobalt/navy design, sidebar, mobile navigation, assets, pairwise and manual rankings, and illustrative event map. The imported local social pilot goes beyond the currently deployed prototype. `/demo` retains the original fictional browser-only experience, separate from the persisted social app at `/`.

## Prerequisites

- Node **24.14.0** (`.nvmrc`) and npm **11.9.0** (`packageManager`). Tests use Node's built-in SQLite and TypeScript support.
- Git and a supported macOS or Linux environment. Network access to the public npm registry is required for installation. GitHub CI targets Ubuntu; Windows has not been verified.
- No cloud account, API key, or production database is needed for local development or CI.

## Run locally

```sh
git clone https://github.com/RAWCoder123/Polis.git
cd Polis
nvm install
nvm use
npm ci
cp .env.example .dev.vars
npm run db:migrate:local
npm run dev
```

If you do not use nvm, install the specified Node version with your preferred version manager. Verify `node --version` and `npm --version`; select npm 11.9.0 before `npm ci`. Keep `package-lock.json`; do not replace it with another package manager's lockfile.

Open **http://localhost:5173/**. Local sign-in uses the starter's explicitly labeled synthetic identity, Seedy. Create a local profile after sign-in. This exercises the local Worker and persistent local D1 storage; it is **not** real ChatGPT OAuth or hosted multi-user verification. Production uses trusted Sites authentication and its own D1 database.

`.dev.vars`, `.wrangler/state`, and `.sites-runtime` are ignored and must stay local. Rerunning migrations applies only pending files and does not seed social users. Use a separate checkout to start a fresh test database without deleting existing local activity.

## Configuration

| Setting | Where | Purpose |
| --- | --- | --- |
| `POLIS_OWNER_EMAIL` | `.dev.vars` locally; Sites runtime setting in production | Server-only owner bootstrap identity. The example is synthetic; keep the real value out of source and client bundles. |
| `DB` | Logical D1 binding in `.openai/hosting.json` and local Wrangler config | Managed database binding, not a password or connection URL. Production is provisioned by Sites. |
| `SITES_RUNTIME_ROOT`, Wrangler/Miniflare paths | Optional local tool environment | Nonsecret scratch paths; defaults are checkout-local. Normally leave unset. |

No `NEXT_PUBLIC_*` or `VITE_*` application variables are required. Such prefixes expose values to client code and must never contain secrets. No OpenAI API key is required. `.openai/hosting.json` contains the existing nonsecret project identity and logical bindings; preserve it.

## Validate

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

With the development server running in another terminal:

```sh
npm run test:http
```

Tests run the real service and migrations against isolated SQLite fixtures, including three-user access checks. The HTTP smoke test creates no user data and checks the local Worker's authentication boundary and rejected writes. Lint currently has seven warnings in preserved MVP components and no errors.

The [CI definition](docs/ci.yml) is prepared for pull requests and pushes to `main`: installation, lint, types, tests, build, and a local Worker smoke check, with read-only permissions and no production credentials or deployment steps. **Remote CI is not active yet:** both available GitHub integrations rejected writing `.github/workflows/ci.yml`. After the owner grants the CLI `workflow` scope or the GitHub app Workflows write permission, move `docs/ci.yml` to `.github/workflows/ci.yml`, push the setup branch, and verify its Actions result. See [setup verification](docs/VERIFICATION.md).

`npm start` runs the built Worker locally on port 8787. It is an artifact smoke command, not a replacement for the trusted Sites dispatcher or development sign-in. Use `npm run dev` for normal interactive development.

## Architecture and development

React 19, Next.js App Router conventions through Vinext/Vite, TypeScript, Tailwind/CSS, and existing shadcn/Radix components power the interface. A Cloudflare Worker and D1 back the social service; Drizzle defines the schema and versioned SQL migrations. This repository setup does not migrate frameworks or upgrade dependencies.

See [architecture](docs/architecture.md), [contributing](CONTRIBUTING.md), [agent guidance](AGENTS.md), [roadmap](docs/roadmap.md), and the [verification record](docs/VERIFICATION.md).

## Deployment relationship

The [existing prototype](https://polis-community.raymondaw2006.chatgpt.site) is hosted by Sites and remains owner-only. **Pushing to GitHub does not deploy it.** Sites currently serves the original MVP revision; this repository also contains later local pilot work. No production deployment or access change is part of this import.

GitHub is the development remote; Sites retains its separate source repository and saved-version deployment workflow. See [deployment and source provenance](docs/deployment.md) and [pilot configuration](docs/PILOT_SETUP.md). Hosted acceptance still requires three isolated ChatGPT identities with Sites viewing access and Polis invitations.

No project-wide open-source license has been selected. Existing third-party notices in `build/` and `vendor/` are preserved; public source visibility does not itself grant an application license.
