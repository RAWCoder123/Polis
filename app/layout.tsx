import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkActive } from "@/lib/auth/mode";
import { SIGN_IN_PATH } from "@/lib/auth/paths";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polis — Your community, in focus",
  description: "A local community for sharing perspectives, hearing from friends, and following the issues that matter.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

// Clerk's sign-in wears Polis's cobalt and navy.
const appearance = {
  variables: {
    colorPrimary: "#3659e3",
    colorForeground: "#17233b",
    colorMutedForeground: "#4f607b",
    colorInput: "#f4f6fa",
    fontFamily: "inherit",
    borderRadius: "12px",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const page = (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
  return clerkActive() ? (
    <ClerkProvider appearance={appearance} signInUrl={SIGN_IN_PATH} signUpUrl={SIGN_IN_PATH}>
      {page}
    </ClerkProvider>
  ) : (
    page
  );
}
