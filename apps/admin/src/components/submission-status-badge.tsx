import { Badge } from "@patriothacks/ui";

import { type SubmissionStatus } from "@/lib/submission-query";

const VARIANT: Record<SubmissionStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  submitted: "default",
  under_review: "secondary",
  accepted: "default",
  waitlisted: "secondary",
  rejected: "destructive",
  withdrawn: "outline",
};

export const submissionStatusLabel = (status: SubmissionStatus) => status.replaceAll("_", " ");

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge variant={VARIANT[status]}>{submissionStatusLabel(status)}</Badge>;
}
