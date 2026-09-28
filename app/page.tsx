import SocialApp from "@/components/polis/social-app";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { PublicHome } from "@/components/polis/public-home";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return user ? <SocialApp /> : <PublicHome />;
}
