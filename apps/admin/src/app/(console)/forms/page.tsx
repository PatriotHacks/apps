import { type Form } from "@patriothacks/database";
import {
  Button,
  DataList,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@patriothacks/ui";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { requireStaff } from "@/lib/auth";
import { formatWindow } from "@/lib/format";
import { listForms } from "@/lib/forms";

import { createDraftForm } from "./actions";
import { DeleteForm } from "./delete-form";

const EDIT_POLICY: Record<Form["editPolicy"], string> = {
  locked: "Locked",
  per_question: "Per question",
  full: "Full",
};

export default async function FormsPage() {
  const [staff, rows] = await Promise.all([requireStaff(), listForms()]);
  const isAdmin = staff.role === "admin";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Forms</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "form" : "forms"}
          </p>
        </div>

        {isAdmin ? (
          // A plain form post rather than a client component: the action creates
          // the draft and redirects into the builder, so there is nothing for
          // the browser to hold on to in between.
          <form action={createDraftForm}>
            <Button type="submit" size="sm">
              New form
            </Button>
          </form>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground md:hidden">No forms yet.</p>
      ) : null}

      <DataList
        rows={rows}
        getKey={(row) => row.id}
        card={(row) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/forms/${row.id}`} className="font-medium hover:underline">
                {row.title}
              </Link>
              <StatusBadge status={row.status} />
            </div>
            <p className="text-xs text-muted-foreground">/{row.slug}</p>
            <p className="text-xs text-muted-foreground">
              {formatWindow(row.opensAt, row.closesAt)}
            </p>
            <Link href={`/submissions/${row.id}`} className="text-sm hover:underline">
              {row.submissionCount} {row.submissionCount === 1 ? "submission" : "submissions"}
            </Link>
            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/forms/${row.id}/edit`}>Edit</Link>
                </Button>
                <DeleteForm
                  formId={row.id}
                  title={row.title}
                  submissionCount={row.submissionCount}
                />
              </div>
            ) : null}
          </div>
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Edit policy</TableHead>
              <TableHead>Window</TableHead>
              <TableHead className="text-right">Sections</TableHead>
              <TableHead className="text-right">Questions</TableHead>
              <TableHead className="text-right">Submissions</TableHead>
              {isAdmin ? <TableHead className="w-0" /> : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} className="text-muted-foreground">
                  No forms yet.
                </TableCell>
              </TableRow>
            ) : null}

            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/forms/${row.id}`} className="font-medium hover:underline">
                    {row.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">/{row.slug}</p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {EDIT_POLICY[row.editPolicy]}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatWindow(row.opensAt, row.closesAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.sectionCount}</TableCell>
                <TableCell className="text-right tabular-nums">{row.questionCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <Link href={`/submissions/${row.id}`} className="hover:underline">
                    {row.submissionCount}
                  </Link>
                </TableCell>
                {isAdmin ? (
                  <TableCell>
                    {/* Published forms edit too — the builder warns about what
                        that costs rather than the console refusing outright. */}
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/forms/${row.id}/edit`}>Edit</Link>
                      </Button>
                      <DeleteForm
                        formId={row.id}
                        title={row.title}
                        submissionCount={row.submissionCount}
                      />
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataList>
    </div>
  );
}
