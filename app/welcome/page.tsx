import type { Metadata } from "next";
import { PolisShowcase } from "@/components/polis/polis-showcase";

export const metadata: Metadata = {
  title: "Polis — Politics starts close to home",
  description: "Explore local issues, share your perspective, and find a reason to show up. Polis connects the people, conversations, and places in your community.",
};

export default function WelcomePage() {
  return <PolisShowcase />;
}
