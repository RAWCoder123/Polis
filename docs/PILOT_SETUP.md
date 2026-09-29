# Pilot setup and operation

## Hosting and authentication

Polis is hosted on Vercel with a Turso database and Clerk sign-in; [deployment](deployment.md) has the one-time setup. Set `POLIS_OWNER_EMAIL` in Vercel to the organizer's exact sign-in email before the first deploy. The local example email must never be used in production. That verified account creates the owner profile and can moderate, generate invitation codes and manage communities. Once created, membership roles are durable database records; editing a profile or sending a `role` field cannot grant access.

Anyone can create an account with a confirmed email or Google and join the Polis commons for their town. Campus communities admit people whose confirmed email belongs to that university's domain, or who redeem an invitation code. Organizations need a code. Invitation codes are generated in **Profile → Community tools** and shared personally; creating one sends nothing. Never put codes or links in logs or this repository.

`/sign-in` and `/sign-out` belong to Clerk. The development sign-in works only under `next dev` on this computer; production builds switch it off.

## Migrations

`drizzle/` holds the versioned migrations (`0000` creates the domain tables, `0001` adds the transactional write-guard table, and later files add features without replacing existing activity). `npm run build` applies pending migrations to production Turso before building, and `npm run dev` applies them to the local file `.data/polis-local.db`. Both are safe to rerun and neither seeds people. There is no request-time schema creation or reset endpoint.

For schema changes, update `db/schema.ts`, run `npm run db:generate`, inspect the SQL, and test it from an empty database and from the previous schema (`npm test` applies every migration). Never rewrite an applied migration. Copy the database before a migration that rebuilds a table; rolling back a Vercel deployment does not undo a migration.

## Content and daily operation

The civic catalog, dates, officials, events, map placements, and initial question are labeled samples. General municipal references do not verify those fictional records. Replace catalog records with sourced local content before a real participation campaign. No registration or attendance is confirmed for sample events.

Owners can create, edit, schedule, and withdraw daily questions, publish significant issue updates with a source URL, generate invitations, and resolve reports in Community tools. Editing answer options is prohibited once responses exist. Withdrawal stops new responses transactionally. Existing deliberately shared answer posts remain under their original audiences. Report evidence is restricted to the owner; resolving with removal clears the targeted public-facing content.

Interested and Planning to attend are different plan statuses. Their default audience is Only me. Sharing or changing a shared plan synchronizes the feed, profile, event detail, and map/list views. Changing to private withdraws earlier plan activity. The map is illustrative and has an equivalent event list.

## Minimal first-party metrics

The `metrics` table records only an opaque user ID, event name, object ID, and timestamp. Events are `joined`, `friend_accepted` (both participants), `post_created` (shared posts, including selected lists/daily answers/event activity), `reply_created` (shared conversations), and `active_day` (at most once per UTC day). Private text, notes, political positions, scores, and precise location are excluded. Browser activity is recorded on entering the signed-in experience and on later visible interaction, focus, or return to the tab; idle open tabs do not generate periodic visits.

Definitions for an owner-only analysis:

- Activation: a user has both `friend_accepted` and a first shared contribution (`post_created` or `reply_created`). Count each user once; activation time is the later of the two first events.
- Reciprocal conversation: at least two distinct contributors have a post/reply event for the same discussion. Post `objectId` is the post ID; reply `objectId` is the containing post ID. Exclude Only me work.
- Return: a user has `active_day` in a UTC week after their first active week. This measures activity, not an inferred political preference.

No metrics are exposed through the community API. No retention/deletion scheduler or automated reporting dashboard is configured; agree an operational retention period before inviting real members.
