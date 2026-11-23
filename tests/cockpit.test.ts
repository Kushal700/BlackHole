import { describe, expect, it } from "vitest";
import { calculateReadiness } from "@/lib/cockpit";

describe("project cockpit readiness", () => {
  it("reports a fully prepared project", () => {
    const result = calculateReadiness({
      objective: "Ship the boss vertical slice",
      studioLinked: true,
      repositoryUrl: "https://github.com/example/game",
      openTasks: 3,
      memoryCount: 12,
    });
    expect(result.score).toBe(100);
    expect(result.checks.every(([, complete]) => complete)).toBe(true);
  });

  it("keeps each missing production input visible", () => {
    const result = calculateReadiness({
      objective: "",
      studioLinked: false,
      openTasks: 0,
      memoryCount: 0,
    });
    expect(result.score).toBe(0);
    expect(result.checks.map(([label]) => label)).toContain("Studio linked");
  });
});
