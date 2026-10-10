import { ConsoleTabs } from "@/components/console-tabs";
import { APPLICATION_TABS } from "@/lib/nav";

/** Presentation only. Every page underneath calls `requireAdmin()` itself. */
export default function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <ConsoleTabs items={APPLICATION_TABS} label="Applications" />
      {children}
    </div>
  );
}
