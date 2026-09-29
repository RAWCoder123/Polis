import { redirect } from "next/navigation";
import { clerkActive } from "@/lib/auth/mode";
import { safeReturnPath } from "@/lib/auth/paths";
import { SignOutNow } from "./sign-out-now";

export const metadata = { title: "Signing out · Polis" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function SignOutPage({ searchParams }: { searchParams: Search }) {
  const { return_to } = await searchParams;
  const returnTo = safeReturnPath(typeof return_to === "string" ? return_to : "/");
  if (!clerkActive()) redirect(returnTo);
  return (
    <main className="auth-page">
      <SignOutNow returnTo={returnTo} />
    </main>
  );
}
