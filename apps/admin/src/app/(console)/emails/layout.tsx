import { ConsoleTabs } from "@/components/console-tabs";
import { EMAIL_TABS } from "@/lib/nav";

/**
 * Presentation only. Every page underneath still calls `requireAdmin()` itself
 * — that is the boundary, and an organizer never reaches this layout because
 * `forbidden()` unwinds to the console's `forbidden.tsx` above it.
 */
export default function EmailsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <ConsoleTabs items={EMAIL_TABS} label="Email" />
      {children}
    </div>
  );
}
