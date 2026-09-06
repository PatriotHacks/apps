"use client";

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

/**
 * `data-theme` rather than the `class` default, because the token stylesheet
 * keys off `[data-theme="dark"]` / `[data-theme="light"]`. `enableColorScheme`
 * is off so the stylesheet stays the only thing that sets `color-scheme`.
 */
function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      enableColorScheme={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider, type ThemeProviderProps };
export { useTheme } from "next-themes";
