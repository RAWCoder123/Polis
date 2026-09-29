"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

// Clerk ends its session in the browser, then returns to Polis signed out.
export function SignOutNow({ returnTo }: { returnTo: string }) {
  const { signOut } = useClerk();
  useEffect(() => {
    void signOut({ redirectUrl: returnTo });
  }, [signOut, returnTo]);
  return (
    <p className="auth-note" role="status">
      Signing you out…
    </p>
  );
}
