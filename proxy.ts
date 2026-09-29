import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from "next/server";
import { localAuthResponse } from "@/lib/auth/local";
import { clerkActive, localSignInEnabled, testAccountsEnabled } from "@/lib/auth/mode";

// Clerk reads its session on every request so server code can call auth().
// On `next dev` without Clerk keys (or with test accounts) the local synthetic
// sign-in answers /sign-in and /sign-out instead.
let clerk: NextMiddleware | null = null;

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (localSignInEnabled()) return localAuthResponse(request, testAccountsEnabled()) ?? NextResponse.next();
  if (clerkActive()) return (clerk ??= clerkMiddleware())(request, event);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next internals and static files unless they appear in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
