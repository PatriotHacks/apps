import { describe, expect, it } from "vitest";

import { describeAudience, parseAudienceFilter, EMPTY_FILTER } from "@/lib/broadcast-audience";

describe("parseAudienceFilter", () => {
  it("keeps a filter the console could have produced", () => {
    expect(
      parseAudienceFilter({
        formId: "11111111-1111-1111-1111-111111111111",
        statuses: ["accepted", "waitlisted"],
        rsvpStatuses: ["confirmed"],
      }),
    ).toEqual({
      formId: "11111111-1111-1111-1111-111111111111",
      statuses: ["accepted", "waitlisted"],
      rsvpStatuses: ["confirmed"],
    });
  });

  it("drops a status the audience builder does not offer", () => {
    // `draft` reaching the query would mean mailing people who never applied.
    expect(parseAudienceFilter({ statuses: ["accepted", "draft", "nonsense"] }).statuses).toEqual([
      "accepted",
    ]);
  });

  it("drops a form id that is not a uuid rather than passing it to SQL", () => {
    expect(parseAudienceFilter({ formId: "' or true --" }).formId).toBeNull();
  });

  it("reads a null or malformed jsonb column as the empty filter", () => {
    expect(parseAudienceFilter(null)).toEqual(EMPTY_FILTER);
    expect(parseAudienceFilter("everyone")).toEqual(EMPTY_FILTER);
    expect(parseAudienceFilter({ statuses: "accepted" }).statuses).toEqual([]);
  });

  it("returns statuses in catalogue order however they were sent", () => {
    expect(parseAudienceFilter({ statuses: ["rejected", "submitted"] }).statuses).toEqual([
      "submitted",
      "rejected",
    ]);
  });
});

describe("describeAudience", () => {
  it("names the form, the statuses and the RSVP states", () => {
    expect(
      describeAudience(
        {
          formId: "11111111-1111-1111-1111-111111111111",
          statuses: ["accepted"],
          rsvpStatuses: ["confirmed"],
        },
        "Hacker Application",
      ),
    ).toEqual([
      "Applied to Hacker Application",
      "Status: Accepted",
      "RSVP: RSVP confirmed",
    ]);
  });

  it("says any form when no form is pinned", () => {
    expect(describeAudience(EMPTY_FILTER, null)).toEqual(["Applied to any form"]);
  });
});
