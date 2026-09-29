# Deployment

Polis runs on **Vercel** (Next.js), stores its data in **Turso** (hosted libSQL, a SQLite database) and signs people in with **Clerk** (email codes and Google). GitHub `RAWCoder123/Polis` is the source: every push to `main` deploys production, and every pull request gets a preview.

## One-time setup

The organizer does these steps. Keys and tokens go straight from each provider into Vercel and are never pasted into chat, code or this repository.

1. **Vercel project.** Import `RAWCoder123/Polis` in Vercel (framework: Next.js; build command and output are detected from `package.json`). Set the Node.js version to 24.x.
2. **Turso database.** Vercel → the project → *Storage* → add **Turso** from the Marketplace, pick the region closest to the pilot (for Ithaca and Gainesville, `aws-us-east-1`) and connect it to the **Production** environment only. This adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. (Alternatively create a database with the Turso CLI and add both variables by hand.)
3. **Clerk sign-in.** Add **Clerk** from the Vercel Marketplace (or create an application at clerk.com), then in the Clerk dashboard:
   - *User & authentication* → enable **Email** with **email verification code**, and **Google**. Leave other social providers off; Polis trusts only addresses Clerk has confirmed.
   - For production, create the production instance, add the Vercel domain, and give Google its own OAuth credentials (Clerk's shared development credentials are for testing only).
   - Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into Vercel if the Marketplace did not.
4. **Polis settings** in Vercel → *Settings* → *Environment Variables* (Production):

   | Variable | Value |
   | --- | --- |
   | `POLIS_OWNER_EMAIL` | The organizer's email, exactly as they will sign in. That verified account can moderate and manage communities. |
   | `NEXT_PUBLIC_POLIS_CONTACT_EMAIL` | Where people send privacy and data requests; shown on `/privacy`. |

5. **Function region.** `vercel.json` pins functions to `iad1` (Washington, D.C.) next to a Turso database in `aws-us-east-1`. If the database lives elsewhere, change the region to match; every page load makes several database round trips.
6. Redeploy production (or merge to `main`). The build log shows `migrate: 13 applied (13 total, Turso)` on the first deploy.

## How a deploy works

`npm run build` runs `scripts/migrate.mjs`, then `next build`.

- The migrator applies each pending `drizzle/*.sql` file in order, together with its record in `d1_migrations`, in one transaction. A failed migration leaves the database unchanged and fails the build, so the previous deployment keeps serving.
- A production build without `TURSO_DATABASE_URL` fails on purpose rather than publishing a site without its data.
- **Preview deployments skip migrations**, so an unmerged branch can never change the production schema. With no database connected to previews, a preview shows the public pages and reports that the community database is not configured. To exercise a full preview, connect a separate Turso database to the Preview environment and set `POLIS_MIGRATE_PREVIEW=1` there.
- Migrations only ever add. Never edit an applied migration; generate new ones with `npm run db:generate` and review the SQL. Before a migration that rewrites a table, make a copy of the database with Turso (`turso db create polis-backup --from-db polis`). Rolling back a deployment in Vercel does not undo a migration.

## Security notes

- Identity comes only from Clerk's verified session (`lib/auth/session.ts`). A person counts as signed in only when their primary email is confirmed; that address decides pilot ownership and campus membership.
- The development sign-in (`lib/auth/local.ts`) runs only under `next dev`, bound to `127.0.0.1`, and answers only loopback hosts. A production build compiles its switch (`lib/auth/mode.ts`) to `false`, so it can never run there.
- Links shared while Polis ran on OpenAI Sites (`/signin-with-chatgpt`, `/signout-with-chatgpt`) redirect to `/sign-in` and `/sign-out`.
- Nothing secret uses a `NEXT_PUBLIC_` name. Keys and tokens live only in Vercel's encrypted environment variables.

## Previous host: OpenAI Sites

From September 13 to September 29, 2026, Polis ran as a Cloudflare Worker with D1 on OpenAI Sites at https://polis-community.raymondaw2006.chatgpt.site (source recovered from Sites at `a414d45`). Publishing there stalled because the Sites source host was unreachable from the Cornell network, and sign-in required an OpenAI account. The move to Vercel replaced the Vinext/Wrangler build, the Sites identity headers and the D1 binding. Every query and migration is unchanged.

`.openai/hosting.json` still identifies that Sites project. Its data was not copied: the Vercel pilot starts with an empty database. The migrator keeps D1's `d1_migrations` bookkeeping, so an export of the Sites D1 database could be imported into Turso later and carry on from its applied migrations.

## History and public data

The original MVP and later commits are preserved without rewriting history. Some early commits carry machine-generated author metadata; new commits use the owner's GitHub no-reply identity. The repository holds no credentials, environment files, invitation links, user data or exports. No project-wide license has been chosen.
