import type { Metadata, Viewport } from "next";
import { Caveat, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { MotionRoot } from "@/components/motion-root";
import { Toaster } from "@/components/base/toast/toast";

import "@/styles/globals.css";
import "@/styles/app.css";

const hand = Caveat({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-caveat", display: "swap" });
// Stash Labs credit only, so not preloaded.
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: "400", variable: "--font-plex-mono", display: "swap", preload: false });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "600"], variable: "--font-plex-sans", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Hand Me Down",
  description: "Our family recipe book.",
  appleWebApp: { capable: true, title: "Hand Me Down", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light",
  themeColor: "#f7f7f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hand.variable} ${plexMono.variable} ${plexSans.variable}`}>
      <body className="min-h-dvh bg-background-secondary-default font-sans text-text-primary antialiased">
        <MotionRoot>{children}</MotionRoot>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
