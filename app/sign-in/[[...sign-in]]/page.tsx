import Link from "next/link";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { clerkActive } from "@/lib/auth/mode";
import { safeReturnPath, SIGN_IN_PATH } from "@/lib/auth/paths";

export const metadata = { title: "Sign in · Polis" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  // Links from before the move to Vercel name their destination `return_to`.
  if (typeof search.return_to === "string" && search.redirect_url === undefined)
    redirect(SIGN_IN_PATH + "?redirect_url=" + encodeURIComponent(safeReturnPath(search.return_to)));
  return (
    <main className="auth-page">
      <p className="legal-back">
        <Link href="/">← Polis</Link>
      </p>
      {clerkActive() ? (
        <>
          <SignIn path={SIGN_IN_PATH} routing="path" withSignUp fallbackRedirectUrl="/#home" signUpFallbackRedirectUrl="/#home" />
          <p className="auth-note">
            By continuing you agree to the <Link href="/privacy">privacy notice</Link>. Sign in with your university email to join
            your campus community.
          </p>
        </>
      ) : (
        <section className="auth-unavailable">
          <h1>Accounts open soon</h1>
          <p>Polis is getting ready for its first members. Meanwhile, try the demo: it runs in your browser with fictional people.</p>
          <p>
            <Link className="btn primary" href="/demo">
              Try the demo
            </Link>
          </p>
        </section>
      )}
    </main>
  );
}
