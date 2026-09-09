import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polis — Your community, in focus",
  description: "An interactive civic community demo. Rank policies, news, and politicians, discover nearby events, and connect with friends.",
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
