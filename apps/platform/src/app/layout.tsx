import { ThemeProvider } from "@patriothacks/ui";
import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";

import "./globals.css";

/** Same typeface, same variable, same reasoning as the admin console. */
const sans = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "PatriotHacks",
  description: "Apply to PatriotHacks.",
};

/** Only the theme colour — Next already emits the right `width`/`initial-scale`. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d10" },
  ],
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
