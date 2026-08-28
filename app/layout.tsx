import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { SolvingProvider } from "@/components/providers/SolvingProvider";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Mahayuddh | Developer Squad DSA Arena",
  description: "The private DSA arena & competitive tracker for developer squads. Apple Music Web UI aesthetic.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mahayuddh",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
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
        <AuthProvider>
          <SolvingProvider>
            <AppShell>{children}</AppShell>
          </SolvingProvider>
        </AuthProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
