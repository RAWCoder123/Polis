// Sign-in and sign-out entry points. Safe to import from client components.
// The destination after sign-in (Clerk's `redirect_url`; `return_to` on links
// from before the move) only ever names a path on this site.

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_OUT_PATH = "/sign-out";
// Links shared before the move from OpenAI Sites still arrive here.
export const LEGACY_SIGN_IN_PATH = "/signin-with-chatgpt";
export const LEGACY_SIGN_OUT_PATH = "/signout-with-chatgpt";

const authPaths = new Set([SIGN_IN_PATH, SIGN_OUT_PATH, LEGACY_SIGN_IN_PATH, LEGACY_SIGN_OUT_PATH]);

export function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  try {
    const url = new URL(value, "https://polis.invalid");
    if (url.origin !== "https://polis.invalid") return "/";
    if (authPaths.has(url.pathname) || url.pathname.startsWith(SIGN_IN_PATH + "/")) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

export const signInPath = (returnTo = "/") => SIGN_IN_PATH + "?redirect_url=" + encodeURIComponent(safeReturnPath(returnTo));
export const signOutPath = (returnTo = "/") => SIGN_OUT_PATH + "?return_to=" + encodeURIComponent(safeReturnPath(returnTo));
