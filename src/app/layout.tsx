import type { Metadata, Viewport } from "next";
import { Caveat, Inter, Newsreader } from "next/font/google";

import { MotionShell } from "@/components/motion";
import { SiteFooter } from "@/components/site-footer";

import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const hand = Caveat({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-hand", display: "swap" });

export const metadata: Metadata = {
  title: "Hand Me Down",
  description: "A private family recipe book, kept by kitchen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${hand.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans text-[15px] leading-normal text-ink antialiased">
        <div className="flex-1">
          <MotionShell>{children}</MotionShell>
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
