import { ThemeProvider } from "@patriothacks/ui";
import type { Metadata } from "next";
import { Figtree } from "next/font/google";

import "./globals.css";

/**
 * Self-hosted at build time — nothing on the page requests a font CDN, and
 * `adjustFontFallback` (on by default) size-matches the fallback face so the
 * swap does not reflow. Loaded as the variable font: one file covering the
 * whole weight axis rather than a static file per weight.
 *
 * The generated class only publishes `--font-ui`. `--font-sans` in the token
 * stylesheet is what components actually read.
 */
const sans = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "PatriotHacks Admin",
  description: "Build forms, review responses, issue decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
