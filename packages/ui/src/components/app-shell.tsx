import * as React from "react";
import { cn } from "cn";

interface AppShellProps {
  /** Rendered inside a sticky `<header>`. Omit for a bare page. */
  header?: React.ReactNode;
  /** Stacks above the content on small screens, becomes a column at `md`. */
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function AppShell({ header, sidebar, children, className }: AppShellProps) {
  return (
    <div className={cn("flex min-h-svh flex-col bg-background", className)}>
      {header ? (
        <header
          data-slot="app-shell-header"
          className="sticky top-0 z-40 border-b bg-background"
        >
          {header}
        </header>
      ) : null}

      <div className="flex flex-1 flex-col md:flex-row">
        {sidebar ? (
          <aside
            data-slot="app-shell-sidebar"
            className="border-b md:w-64 md:shrink-0 md:border-r md:border-b-0"
          >
            {sidebar}
          </aside>
        ) : null}

        <main data-slot="app-shell-main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell, type AppShellProps };
