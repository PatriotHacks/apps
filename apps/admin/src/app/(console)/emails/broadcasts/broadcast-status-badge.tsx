import { type Broadcast } from "@patriothacks/database";
import { Badge } from "@patriothacks/ui";

const VARIANT = {
  draft: "secondary",
  sending: "outline",
  sent: "default",
  failed: "destructive",
} as const;

export function BroadcastStatusBadge({ status }: { status: Broadcast["status"] }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}
