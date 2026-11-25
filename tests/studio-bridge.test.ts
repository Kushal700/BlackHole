import { describe, expect, it } from "vitest";
import {
  buildApplyLuau,
  buildPreviewLuau,
  buildRollbackLuau,
  buildRollbackVerificationLuau,
  normalizeStudioPath,
  validateStudioOperations,
} from "@/lib/studio-bridge";
import type { StudioBridgeOperation, StudioBridgePlan } from "@/lib/types";

const operations: StudioBridgeOperation[] = [
  {
    id: "folder-1",
    kind: "create_folder",
    parentPath: "ReplicatedStorage",
    name: "BlackHoleGenerated",
  },
  {
    id: "script-1",
    kind: "create_script",
    parentPath: "ServerScriptService",
    name: "BlackHoleBootstrap",
    className: "Script",
    source: "--!strict\nprint(\"ready\")",
  },
];

describe("Studio execution bridge", () => {
  it("allows only explicitly supported Studio roots and safe path segments", () => {
    expect(normalizeStudioPath("game.ReplicatedStorage.Shared")).toBe(
      "ReplicatedStorage.Shared",
    );
    expect(() => normalizeStudioPath("CoreGui.Secret")).toThrow(
      "allowed service",
    );
    expect(() => normalizeStudioPath("Workspace.Bad;Destroy")).toThrow(
      "letters, numbers",
    );
  });

  it("rejects duplicate targets before Studio is contacted", () => {
    expect(() =>
      validateStudioOperations([
        operations[0],
        { ...operations[0], id: "folder-2" },
      ]),
    ).toThrow("More than one operation targets");
  });

  it("builds read-only previews and undo-recorded, ownership-marked writes", () => {
    const preview = buildPreviewLuau(operations);
    const apply = buildApplyLuau({
      id: "plan-1",
      title: "Safe scaffold",
      operations,
    });

    expect(preview).not.toContain("Instance.new");
    expect(preview).not.toContain("SetAttribute");
    expect(preview).toContain("Existing attribute type is not supported");
    expect(apply).toContain("TryBeginRecording");
    expect(apply).toContain("FinishRecordingOperation.Cancel");
    expect(apply).toContain("BlackHoleBridgePlanId");
    expect(apply).toContain("BlackHoleBridgeOperationId");
  });

  it("refuses rollback unless the created instance still belongs to the plan", () => {
    const plan = {
      id: "plan-1",
      title: "Safe scaffold",
      rollback: [
        {
          operationId: "folder-1",
          kind: "destroy_created" as const,
          targetPath: "ReplicatedStorage.BlackHoleGenerated",
        },
      ],
    } satisfies Pick<StudioBridgePlan, "id" | "title" | "rollback">;
    const rollback = buildRollbackLuau(plan);

    expect(rollback).toContain("Rollback ownership mismatch");
    expect(rollback).toContain("Rollback operation mismatch");
    expect(rollback).toContain("TryBeginRecording");
    expect(buildRollbackVerificationLuau(plan)).toContain("target == nil");
  });
});
