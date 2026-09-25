# Current Polis authentication path

Verified September 25, 2026. This is a configuration and browser assessment, not a new authentication implementation.

## Confirmed current flow

1. Polis starts a top-level navigation to `/signin-with-chatgpt?return_to=...`.
2. Sites redirects to OpenAI authorization. The observed request uses authorization code flow with PKCE (`S256`), `openid profile email`, state and nonce, and the Polis domain's `/callback`.
3. The hosted account chooser identifies Polis and says it is signing in with ChatGPT. Selecting **Log in to another account** displays **Continue with Google**, alongside the other OpenAI login methods.
4. Sites owns `/callback` and `/signout-with-chatgpt`, and forwards the authenticated identity through its trusted `oai-authenticated-user-*` headers.
5. `app/chatgpt-auth.ts` reads that identity. `app/api/polis/route.ts` supplies it to the social service, which separately enforces community membership and ownership.

No account was selected or created during this read-only check. The Google provider button was observed, but a Google authentication round trip and invitation redemption were not exercised.

## What Google means here

Google is available **through OpenAI sign-in**. It does not eliminate the OpenAI account, create a direct Google session in Polis, or grant community membership. The UI must continue to identify the sign-in as ChatGPT/OpenAI; do not label the existing Polis link as a direct Google login.

The invitation cookie is independent of the identity provider and retains the pending code through login. Existing server-side admission checks remain required after authentication.

## Direct Google-only sign-in: not confirmed

The installed Sites authentication guide documents dispatch-owned ChatGPT sign-in and explicitly requires confirming the platform path before adding external OAuth. The available Sites tools expose no Google-provider configuration. Neither is evidence of a supported direct Google-only integration.

Before implementing that alternative, obtain an explicit supported Sites integration contract for app-owned sessions and external callbacks, or choose a hosting/authentication setup that supports them. A Google client registration alone does not establish Sites compatibility. Preserve existing profile IDs with deliberate account linking; do not merge people merely because their emails match. Do not reuse Sites-reserved authentication routes for a custom provider.

References: installed `sites-building/references/authentication.md` and `starter-capabilities.md`; the current repository authentication helpers; live Sites metadata; the visible hosted OpenAI login flow; [OpenAI authentication methods](https://help.openai.com/en/articles/4936824-can-i-change-how-i-log-into-my-account-authentication-method); [Google Identity Services setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
