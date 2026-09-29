import { cookies, headers } from "next/headers";
import type { Identity } from "@/lib/social/service";
import { LOCAL_AUTH_COOKIE, LOCAL_OWNER_EMAIL, isLoopbackHost, localIdentity } from "./local";
import { clerkActive, localSignInEnabled, testAccountsEnabled } from "./mode";

// The organizer who can moderate and manage communities.
export const pilotOwnerEmail = () => process.env.POLIS_OWNER_EMAIL || (localSignInEnabled() ? LOCAL_OWNER_EMAIL : "");

// The signed-in person, from the trusted sign-in provider only. Nothing a
// browser submits (headers, fields, cookies other than the provider's
// session) can choose or change who someone is.
export async function getSessionUser(): Promise<Identity | null> {
  if (localSignInEnabled()) {
    const request = await headers();
    if (!isLoopbackHost(request.get("host"))) return null;
    // Exactly one session cookie: an ambiguous pair signs no one in. (Parsed
    // cookies keep only one value per name, so count the raw header.)
    const sessions = (request.get("cookie") ?? "").split(";").filter((c) => c.trim().startsWith(LOCAL_AUTH_COOKIE + "="));
    return sessions.length === 1 ? localIdentity((await cookies()).get(LOCAL_AUTH_COOKIE)?.value, testAccountsEnabled()) : null;
  }
  if (!clerkActive()) return null;
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId ? clerkIdentity(userId) : null;
}

// Profile details change rarely; a short cache keeps each API request from
// waiting on the provider. A revoked session fails auth() before this.
const recent = new Map<string, { identity: Identity | null; at: number }>();

async function clerkIdentity(userId: string): Promise<Identity | null> {
  const hit = recent.get(userId);
  if (hit && Date.now() - hit.at < 60_000) return hit.identity;
  const { clerkClient } = await import("@clerk/nextjs/server");
  const user = await (await clerkClient()).users.getUser(userId);
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  // Only a confirmed address counts: it decides pilot ownership and which
  // campus someone can join.
  const identity =
    primary?.verification?.status === "verified"
      ? {
          userId,
          email: primary.emailAddress.toLowerCase(),
          displayName: user.fullName || user.username || primary.emailAddress,
          verifiedCampusEmail: true,
        }
      : null;
  if (recent.size > 1000) recent.clear();
  recent.set(userId, { identity, at: Date.now() });
  return identity;
}
