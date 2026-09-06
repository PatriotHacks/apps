"use client";

import * as React from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "#components/button";

type ThemeName = "system" | "light" | "dark";

const NEXT: Record<ThemeName, ThemeName> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABEL: Record<ThemeName, string> = {
  system: "system theme",
  light: "light theme",
  dark: "dark theme",
};

const ICON: Record<ThemeName, React.ComponentType<{ className?: string }>> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

function isThemeName(value: string | undefined): value is ThemeName {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Cycles system -> light -> dark. The server and the first client render both
 * show the system icon; `theme` is only readable once mounted, and rendering it
 * earlier would be a hydration mismatch.
 */
function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const current: ThemeName = mounted && isThemeName(theme) ? theme : "system";
  const next = NEXT[current];
  const Icon = ICON[current];

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => {
        setTheme(next);
      }}
    >
      <Icon className="size-4" />
      <span className="sr-only">
        {`Using ${LABEL[current]}. Switch to ${LABEL[next]}.`}
      </span>
    </Button>
  );
}

export { ThemeToggle };
