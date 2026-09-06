import { ThemeProvider } from "@patriothacks/ui";
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PatriotHacks Admin",
  description: "Build forms, review responses, issue decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
