import { ConsoleShell } from "@/components/console-shell";
import { requireStaff } from "@/lib/auth";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  return <ConsoleShell staff={staff}>{children}</ConsoleShell>;
}
