// Which sign-in Polis uses. Production always uses Clerk: `next build` fixes
// NODE_ENV to "production", so the local checks compile to `() => false`.

export const clerkConfigured = () => Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

// Synthetic test accounts need the local sign-in, even when Clerk keys exist.
export const testAccountsEnabled = () => process.env.NODE_ENV === "development" && process.env.POLIS_TEST_ACCOUNTS === "1";

export const localSignInEnabled = () =>
  process.env.NODE_ENV === "development" && (testAccountsEnabled() || !clerkConfigured());

export const clerkActive = () => clerkConfigured() && !localSignInEnabled();
