# Polis

**Politics starts close to home.** Polis is a social app for local civic life: find your town or campus, see its offices, public places and events on a map, and talk through local questions with neighbors — with room to agree, disagree, or say you're still learning.

**Pilot:** moving to Vercel, where anyone can sign up with an email code or Google. The public address will appear here after the first production deploy; see [deployment](docs/deployment.md).

![The Polis map around Cornell and Ithaca: a bright 3D map with places grouped into count bubbles, and a list of nearby offices and places.](docs/images/map.jpg)

| Street level with *Use my location* | On a phone |
| --- | --- |
| ![Street-level 3D view in Collegetown with the street name, nearby civic buildings and places sorted by distance.](docs/images/street.jpg) | ![Home and the map in Burlington, Vermont, on a phone.](docs/images/mobile.jpg) |

Screenshots use synthetic accounts on a local build. Map data © OpenStreetMap contributors, tiles by OpenFreeMap.

## What you can do

- **Find your community, anywhere.** Search any town or university (OpenStreetMap), or list communities near you. Start the first commons for a town; nearby duplicates are joined instead of created. Sign in with a university email to join, or start, your campus community; organizations use invitation codes.
- **See it on the map.** A bright, Snap-style 3D map of offices, public buildings, campus places, proposals and events. Nearby places group into count bubbles until you zoom in. *Use my location* glides to street level and names the street you're on — your location never leaves the device.
- **Local news that matters.** Stories from student papers, town outlets and an open news index, ranked by how local they are, how much they touch student life, how many people here are discussing them and how widely they are reported, with the reasons shown. Start a forum on any story; sensitive stories come with support resources.
- **Understand what is being decided.** Plain-language explainers turn laws, proposals and official documents into what changes, who it affects, where it stands and how to weigh in, with the originals linked. One is featured on Home each day.
- **Talk it through in the Commons.** Local and national questions, debates and sourced updates about real places and decisions. Replies can carry a perspective; reactions are *Agree*, *Thought-provoking* and *Want to understand more*. Polis never assigns anyone a political identity.
- **Show up.** Discover events, save them privately, mark Interested or Going with an audience you choose, and see friends' shared plans (never anyone's live location).
- **Keep your own priorities.** Order the issues you care about and rate proposals privately; share a snapshot only when you choose.
- **Stay in control.** Posts default to Friends. Mute, block and report are always available. Private notes, saves and plans stay private.

## Status

| | |
| --- | --- |
| Hosting | Next.js on Vercel, a Turso database and Clerk sign-in ([deployment](docs/deployment.md)). The earlier OpenAI Sites pilot is retired; its data is not carried over. |
| Verified locally | 108 unit and service tests on real migrations (on `node:sqlite` and on libSQL); 8 real-browser suites (social cycle, signup, invitations, Commons, civic, anywhere, milestone, motion) and 3 HTTP-boundary suites against `next dev`, at desktop and phone widths. |
| Not yet verified | The production Clerk and Turso setup, hosted acceptance with three real accounts, real-device gestures and a screen-reader pass, and production capacity of the public OpenStreetMap services. |

Sample civic records are labeled *Sample*. See the [roadmap](docs/roadmap.md) for what is next.

## Run locally

Requires Node **24.14.0** (`.nvmrc`) and npm **11.9.0**. No cloud account, API key or production database is needed.

```sh
git clone https://github.com/RAWCoder123/Polis.git
cd Polis
nvm install && nvm use
npm ci
npm run dev
```

Open **http://localhost:5173/**. `npm run dev` applies migrations to a local database file (`.data/polis-local.db`) and signs you in as a visibly synthetic local owner, Seedy. Set `POLIS_TEST_ACCOUNTS=1` to sign in as other synthetic accounts with `/sign-in?test_account=beta_b` or a run-scoped `qa_<suite>_<run>_<role>` name; unknown names are refused. This sign-in answers only on this computer and is switched off in production builds. To try Clerk locally, put its development keys in `.env.local` (see `.env.example`). `.env.local` and `.data/` stay out of Git.

## Validate

```sh
npm run lint        # 0 errors; 7 inherited warnings in the original demo
npm run typecheck
npm test            # 108 tests
npm run build
```

With `npm run dev` running (set `POLIS_TEST_ORIGIN` if not on port 5173), `npm run test:http`, `test:social-http` and `test:events-http` check the HTTP boundary, and `npm run test:browser` plus the other `test:*-browser` suites drive real Chromium sessions. Browser suites need `POLIS_TEST_ACCOUNTS=1` on the dev server and a fresh local database.

GitHub Actions is prepared in [docs/ci.yml](docs/ci.yml) but not active until the repository grants workflow permission. Vercel builds every pull request as a preview.

## How it's built

React 19 on Next.js 16, TypeScript and Tailwind, deployed on Vercel with Turso (libSQL) and Clerk. Every social read and write goes through one API route and a server-side service that enforces membership, audience, ownership, blocking and muting; Drizzle defines the schema and versioned migrations, applied before each build. Maps use MapLibre GL with OpenFreeMap vector tiles and a custom Polis style.

## Documentation

| Topic | Read |
| --- | --- |
| How the code fits together | [Architecture](docs/architecture.md) · [Design system](DESIGN.md) · [Motion](docs/motion.md) · [Map](docs/map.md) · [Explainers](docs/explainers.md) · [Local news](docs/local-news.md) |
| Working on Polis | [Contributing](CONTRIBUTING.md) · [Agent guidance](AGENTS.md) · [Roadmap](docs/roadmap.md) |
| Features | [Communities anywhere](docs/anywhere.md) · [Campus Commons and civic map](docs/campus-civic-map.md) · [Commons pilot](docs/commons-pilot.md) · [Events](docs/event-pilot.md) · [Event sources](docs/event-sources.md) · [Invitation codes](docs/invitation-codes.md) · [Open signup](docs/open-signup.md) |
| Hosting and pilot | [Deployment](docs/deployment.md) · [Pilot setup](docs/PILOT_SETUP.md) · [Authentication](docs/authentication-path.md) · [Privacy notice](app/privacy/page.tsx) · [Earlier hosted verification](docs/hosted-pilot-verification.md) |
| Verification records | [Verification](docs/VERIFICATION.md) · [Social cycle](docs/social-cycle-verification.md) · [Events](docs/event-verification.md) · [Civic milestone review](docs/claude-review-and-milestone.md) |

## License

No project-wide open-source license has been chosen; public source does not by itself grant one. Third-party notices in `vendor/` are preserved, and the bundled map outlines in `public/maps` are ODbL (see their README).
