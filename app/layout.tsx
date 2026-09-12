import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polis — Your community, in focus",
  description: "A local community for sharing perspectives, hearing from friends, and following the issues that matter.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
