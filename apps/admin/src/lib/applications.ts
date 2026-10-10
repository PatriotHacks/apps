import { judges, volunteers } from "@patriothacks/database";
import { desc } from "drizzle-orm";

import { queryAsAdmin } from "@/lib/db";

export function listVolunteers() {
  return queryAsAdmin((tx) => tx.select().from(volunteers).orderBy(desc(volunteers.createdAt)));
}

export function listJudges() {
  return queryAsAdmin((tx) => tx.select().from(judges).orderBy(desc(judges.createdAt)));
}
