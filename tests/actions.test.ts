import { describe, expect, it } from "vitest";
import { parseActionRequest } from "@/lib/actions";

describe("confirmation-gated Jarvis actions", () => {
  it("turns a task request into a proposal without executing it", () => {
    const proposal = parseActionRequest(
      "Create a task: profile the boss fight as high priority",
    );
    expect(proposal).toMatchObject({
      kind: "create_task",
      risk: "low",
      payload: { title: "profile the boss fight", priority: "high" },
    });
  });

  it("clamps project progress to a safe range", () => {
    const proposal = parseActionRequest("Set Roblox project progress to 140%");
    expect(proposal).toMatchObject({
      kind: "update_project_progress",
      payload: { progress: 100 },
    });
  });

  it("does not interpret ordinary questions as actions", () => {
    expect(
      parseActionRequest("What does my vault say about server authority?"),
    ).toBeUndefined();
  });
});
