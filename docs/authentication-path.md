# Authentication

Polis signs people in with [Clerk](https://clerk.com): a one-time code sent to their email, or Google. There is no Polis password.

## Flow

1. A sign-in link goes to `/sign-in?redirect_url=<path on Polis>` (`lib/auth/paths.ts` keeps the destination on this site).
2. `app/sign-in/[[...sign-in]]/page.tsx` shows Clerk's combined sign-in-or-sign-up form in Polis colors. New people create an account in the same place.
3. Clerk confirms the email address (by code, or because Google has confirmed it) and sets its session cookie.
4. `proxy.ts` runs Clerk's middleware on every request. `lib/auth/session.ts` asks Clerk who the session belongs to and returns an identity only when that person's **primary email is verified**. `app/api/polis/route.ts` passes the identity to the social service, which separately enforces membership, audience, ownership, blocking and muting.
5. `/sign-out` ends the Clerk session in the browser and returns home.

Links shared while Polis ran on OpenAI Sites (`/signin-with-chatgpt?return_to=…`) redirect to `/sign-in` and keep their destination.

## What a verified email decides

- **Pilot ownership.** The account whose verified email matches `POLIS_OWNER_EMAIL` becomes the owner.
- **Campus membership.** A verified address at a university domain (for example `@cornell.edu`) can join that campus's community without a code, or start it if none exists. Membership is community access, not proof of enrollment. Anyone else joins a campus with an invitation code.
- Nothing a browser submits (a form field, a header, the profile's city) can change either.

Enable only Email (verification code) and Google in Clerk. Other providers may supply addresses that the provider itself has not confirmed.

## Invitations across sign-in

An invitation code entered before signing in is held in an HttpOnly, same-site cookie for an hour (`lib/social/invitation-handoff.ts`), survives the round trip through Clerk, and is checked against the database when redeemed.

## Development sign-in

Under `npm run dev` without Clerk keys, `/sign-in` signs you in as **Seedy**, a visibly synthetic local owner (`seedy@sites.test`). With `POLIS_TEST_ACCOUNTS=1`, `/sign-in?test_account=beta_b` and run-scoped `qa_<suite>_<run>_<role>` names give the browser suites independent accounts; unknown names are refused. This path (`lib/auth/local.ts`) answers only on a loopback host, the dev server binds to `127.0.0.1`, and a production build compiles its switch to `false`. To try Clerk locally instead, put development keys in `.env.local`.

## Not yet verified

A real Clerk production instance with Google OAuth, and the three-account acceptance on the hosted site, remain to be exercised after the organizer sets up the keys ([deployment](deployment.md)).
