import SocialApp from "@/components/polis/social-app";
import { getSessionUser } from "@/lib/auth/session";
import { PublicHome } from "@/components/polis/public-home";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  return user ? <SocialApp /> : <PublicHome />;
}
