import { describe, it, expect } from "vitest";
import { pickEvidence } from "@/lib/pipeline/icp";

describe("expansion evidence", () => {
  it("keeps specific pages, one per site, and drops bare home pages", () => {
    const r = pickEvidence([
      { url: "https://www.linkedin.com/", title: "LinkedIn" },
      { url: "https://www.jobleads.com/job/controller-123", title: "Controller job" },
      { url: "https://www.jobleads.com/job/cfo-456", title: "CFO job" },
      { url: "https://www.indeed.com/jobs", title: "Jobs" },
      { url: "https://example.org/blog/pe-portfolio-finance", title: "PE portfolio finance" },
    ]);
    expect(r.map((x) => x.url)).toEqual(["https://www.jobleads.com/job/controller-123", "https://example.org/blog/pe-portfolio-finance"]);
  });
});
