import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ModSentry",
  description: "Tactical moderation command center for Twitch and Kick.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
