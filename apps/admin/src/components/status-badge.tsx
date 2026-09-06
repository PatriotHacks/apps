import { type Form } from "@patriothacks/database";
import { Badge } from "@patriothacks/ui";

const VARIANT = {
  draft: "secondary",
  published: "default",
  closed: "outline",
} as const;

export function StatusBadge({ status }: { status: Form["status"] }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}
