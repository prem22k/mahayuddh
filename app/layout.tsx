import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Mahayuddh | Developer Squad DSA Arena",
  description: "The private DSA arena & competitive tracker for developer squads. Apple Music Web UI aesthetic.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mahayuddh",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-base text-txt-primary antialiased selection:bg-apple-accent selection:text-white">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
