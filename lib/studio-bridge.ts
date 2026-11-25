import { randomUUID } from "node:crypto";
import type {
  StudioBridgeOperation,
  StudioBridgePlan,
  StudioBridgePreviewItem,
  StudioBridgeRollbackItem,
} from "@/lib/types";
import {
  executeStudioLuau,
  listConnectedStudios,
} from "@/lib/studio-mcp";

const ALLOWED_ROOTS = new Set([
  "Workspace",
  "ReplicatedFirst",
  "ReplicatedStorage",
  "ServerScriptService",
  "ServerStorage",
  "StarterGui",
  "StarterPack",
  "StarterPlayer",
  "Lighting",
  "SoundService",
]);

const NAME_PATTERN = /^[A-Za-z0-9 _-]{1,60}$/;
const ATTRIBUTE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;

function quote(value: string | number | boolean | null) {
  if (value === null) return "nil";
  return JSON.stringify(value);
}

export function normalizeStudioPath(input: string) {
  const value = input.trim().replace(/^game\./i, "");
  const parts = value.split(".");
  if (parts.length < 1 || !ALLOWED_ROOTS.has(parts[0]))
    throw new Error(`Path must begin with an allowed service (${[...ALLOWED_ROOTS].join(", ")}).`);
  if (parts.some((part) => !NAME_PATTERN.test(part)))
    throw new Error("Studio paths may contain only letters, numbers, spaces, underscores, and hyphens.");
  return parts.join(".");
}

function operationTarget(operation: StudioBridgeOperation) {
  if (operation.kind === "set_attribute")
    return normalizeStudioPath(operation.targetPath);
  return `${normalizeStudioPath(operation.parentPath)}.${operation.name}`;
}

export function validateStudioOperations(operations: StudioBridgeOperation[]) {
  if (!operations.length) throw new Error("Add at least one Studio operation.");
  if (operations.length > 20)
    throw new Error("A bridge batch is limited to 20 operations.");
  const ids = new Set<string>();
  const targets = new Set<string>();
  for (const operation of operations) {
    if (!operation.id || ids.has(operation.id))
      throw new Error("Every operation needs a unique id.");
    ids.add(operation.id);
    const target = operationTarget(operation);
    if (operation.kind !== "set_attribute" && targets.has(target))
      throw new Error(`More than one operation targets ${target}.`);
    targets.add(target);
    if (operation.kind === "create_folder" || operation.kind === "create_script") {
      if (!NAME_PATTERN.test(operation.name))
        throw new Error("New instance names may contain only letters, numbers, spaces, underscores, and hyphens.");
    }
    if (operation.kind === "create_script") {
      if (!operation.source.trim()) throw new Error("New scripts cannot be empty.");
      if (operation.source.length > 24_000)
        throw new Error("A bridge-created script is limited to 24,000 characters.");
    }
    if (operation.kind === "set_attribute" && !ATTRIBUTE_PATTERN.test(operation.name))
      throw new Error("Attribute names must start with a letter and contain only letters, numbers, and underscores.");
  }
  return operations;
}

function luauResolver() {
  return `
local function resolvePath(path)
  local parts = string.split(path, ".")
  local current = game:GetService(parts[1])
  for index = 2, #parts do
    current = current and current:FindFirstChild(parts[index])
  end
  return current
end
`;
}

function luauOperations(
  operations: StudioBridgeOperation[],
  preview: StudioBridgePreviewItem[] = [],
) {
  return `{${operations
    .map((operation) => {
      if (operation.kind === "create_folder")
        return `{id=${quote(operation.id)},kind="create_folder",parentPath=${quote(normalizeStudioPath(operation.parentPath))},name=${quote(operation.name)}}`;
      if (operation.kind === "create_script")
        return `{id=${quote(operation.id)},kind="create_script",parentPath=${quote(normalizeStudioPath(operation.parentPath))},name=${quote(operation.name)},className=${quote(operation.className)},source=${quote(operation.source)}}`;
      const previous = preview.find((item) => item.operationId === operation.id)?.previous;
      return `{id=${quote(operation.id)},kind="set_attribute",targetPath=${quote(normalizeStudioPath(operation.targetPath))},name=${quote(operation.name)},value=${quote(operation.value)},expectedPrevious={exists=${previous?.exists ? "true" : "false"},value=${quote(previous?.value ?? null)}}}`;
    })
    .join(",")}}`;
}

export function buildPreviewLuau(operations: StudioBridgeOperation[]) {
  validateStudioOperations(operations);
  return `
local HttpService = game:GetService("HttpService")
${luauResolver()}
local operations = ${luauOperations(operations)}
local items = {}
for _, operation in operations do
  if operation.kind == "create_folder" or operation.kind == "create_script" then
    local parent = resolvePath(operation.parentPath)
    local targetPath = operation.parentPath .. "." .. operation.name
    local existing = parent and parent:FindFirstChild(operation.name)
    local safe = parent ~= nil and existing == nil
    table.insert(items, {
      operationId = operation.id,
      kind = operation.kind,
      targetPath = targetPath,
      safe = safe,
      reason = not parent and "Parent does not exist" or (existing and "Target already exists" or "Ready to create"),
    })
  else
    local target = resolvePath(operation.targetPath)
    local previous = target and target:GetAttribute(operation.name) or nil
    local previousType = typeof(previous)
    local serializable = previous == nil or previousType == "string" or previousType == "number" or previousType == "boolean"
    table.insert(items, {
      operationId = operation.id,
      kind = operation.kind,
      targetPath = operation.targetPath,
      safe = target ~= nil and serializable,
      reason = not target and "Target does not exist" or (not serializable and "Existing attribute type is not supported by reversible bridge v1" or "Ready to update attribute"),
      previous = { exists = previous ~= nil, value = serializable and previous or nil },
    })
  end
end
return HttpService:JSONEncode({items = items})
`.trim();
}

export function buildApplyLuau(
  plan: Pick<StudioBridgePlan, "id" | "title" | "operations"> &
    Partial<Pick<StudioBridgePlan, "preview">>,
) {
  validateStudioOperations(plan.operations);
  return `
local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
${luauResolver()}
local operations = ${luauOperations(plan.operations, plan.preview || [])}

for _, operation in operations do
  if operation.kind == "create_folder" or operation.kind == "create_script" then
    local parent = resolvePath(operation.parentPath)
    assert(parent, "Missing parent: " .. operation.parentPath)
    assert(not parent:FindFirstChild(operation.name), "Target already exists: " .. operation.parentPath .. "." .. operation.name)
  else
    local target = resolvePath(operation.targetPath)
    assert(target, "Missing target: " .. operation.targetPath)
    local current = target:GetAttribute(operation.name)
    if operation.expectedPrevious.exists then
      assert(current == operation.expectedPrevious.value, "Attribute changed since preview: " .. operation.targetPath)
    else
      assert(current == nil, "Attribute was added after preview: " .. operation.targetPath)
    end
  end
end

local recording = ChangeHistoryService:TryBeginRecording(${quote(`blackhole-${plan.id}`)}, ${quote(`BlackHole · ${plan.title}`)})
assert(recording, "Studio could not start an undo recording")
local results = {}
local ok, failure = pcall(function()
  for _, operation in operations do
    if operation.kind == "create_folder" or operation.kind == "create_script" then
      local parent = resolvePath(operation.parentPath)
      local instance = Instance.new(operation.kind == "create_folder" and "Folder" or operation.className)
      instance.Name = operation.name
      if operation.kind == "create_script" then
        instance.Source = operation.source
      end
      instance:SetAttribute("BlackHoleBridgePlanId", ${quote(plan.id)})
      instance:SetAttribute("BlackHoleBridgeOperationId", operation.id)
      instance.Parent = parent
      table.insert(results, {operationId = operation.id, targetPath = operation.parentPath .. "." .. operation.name, kind = "created"})
    else
      local target = resolvePath(operation.targetPath)
      local previous = target:GetAttribute(operation.name)
      target:SetAttribute(operation.name, operation.value)
      table.insert(results, {
        operationId = operation.id,
        targetPath = operation.targetPath,
        kind = "attribute",
        attributeName = operation.name,
        previous = {exists = previous ~= nil, value = previous},
        appliedValue = operation.value,
      })
    end
  end
end)
if not ok then
  ChangeHistoryService:FinishRecording(recording, Enum.FinishRecordingOperation.Cancel)
  error(failure)
end
ChangeHistoryService:FinishRecording(recording, Enum.FinishRecordingOperation.Commit)
return HttpService:JSONEncode({ok = true, changed = #results, results = results})
`.trim();
}

function luauRollbackItems(items: StudioBridgeRollbackItem[]) {
  return `{${items
    .map((item) => {
      if (item.kind === "destroy_created")
        return `{operationId=${quote(item.operationId)},kind="destroy_created",targetPath=${quote(normalizeStudioPath(item.targetPath))}}`;
      return `{operationId=${quote(item.operationId)},kind="restore_attribute",targetPath=${quote(normalizeStudioPath(item.targetPath))},attributeName=${quote(item.attributeName || "")},previous={exists=${item.previous?.exists ? "true" : "false"},value=${quote(item.previous?.value ?? null)}},appliedValue=${quote(item.appliedValue ?? null)}}`;
    })
    .join(",")}}`;
}

export function buildRollbackLuau(plan: Pick<StudioBridgePlan, "id" | "title" | "rollback">) {
  if (!plan.rollback.length) throw new Error("This plan has no recorded rollback data.");
  return `
local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
${luauResolver()}
local items = ${luauRollbackItems(plan.rollback)}

for _, item in items do
  local target = resolvePath(item.targetPath)
  if item.kind == "destroy_created" and target then
    assert(target:GetAttribute("BlackHoleBridgePlanId") == ${quote(plan.id)}, "Rollback ownership mismatch: " .. item.targetPath)
    assert(target:GetAttribute("BlackHoleBridgeOperationId") == item.operationId, "Rollback operation mismatch: " .. item.targetPath)
  elseif item.kind == "restore_attribute" then
    assert(target, "Rollback target missing: " .. item.targetPath)
    assert(target:GetAttribute(item.attributeName) == item.appliedValue, "Attribute changed after bridge execution: " .. item.targetPath)
  end
end

local recording = ChangeHistoryService:TryBeginRecording(${quote(`blackhole-rollback-${plan.id}`)}, ${quote(`Rollback · ${plan.title}`)})
assert(recording, "Studio could not start a rollback recording")
local changed = 0
local ok, failure = pcall(function()
  for _, item in items do
    local target = resolvePath(item.targetPath)
    if item.kind == "destroy_created" then
      if target then target:Destroy(); changed += 1 end
    else
      target:SetAttribute(item.attributeName, item.previous.exists and item.previous.value or nil)
      changed += 1
    end
  end
end)
if not ok then
  ChangeHistoryService:FinishRecording(recording, Enum.FinishRecordingOperation.Cancel)
  error(failure)
end
ChangeHistoryService:FinishRecording(recording, Enum.FinishRecordingOperation.Commit)
return HttpService:JSONEncode({ok = true, changed = changed})
`.trim();
}

export function buildVerificationLuau(plan: Pick<StudioBridgePlan, "id" | "operations">, rolledBack = false) {
  return `
local HttpService = game:GetService("HttpService")
${luauResolver()}
local operations = ${luauOperations(plan.operations)}
local checks = {}
local allPassed = true
for _, operation in operations do
  local targetPath = operation.kind == "set_attribute" and operation.targetPath or (operation.parentPath .. "." .. operation.name)
  local target = resolvePath(targetPath)
  local passed = false
  if ${rolledBack ? "true" : "false"} then
    passed = operation.kind == "set_attribute" or target == nil
  elseif operation.kind == "set_attribute" then
    passed = target ~= nil and target:GetAttribute(operation.name) == operation.value
  else
    passed = target ~= nil and target:GetAttribute("BlackHoleBridgePlanId") == ${quote(plan.id)} and target:GetAttribute("BlackHoleBridgeOperationId") == operation.id
  end
  allPassed = allPassed and passed
  table.insert(checks, {operationId = operation.id, targetPath = targetPath, passed = passed})
end
return HttpService:JSONEncode({ok = allPassed, checks = checks})
`.trim();
}

export function buildRollbackVerificationLuau(
  plan: Pick<StudioBridgePlan, "rollback">,
) {
  if (!plan.rollback.length) throw new Error("This plan has no recorded rollback data.");
  return `
local HttpService = game:GetService("HttpService")
${luauResolver()}
local items = ${luauRollbackItems(plan.rollback)}
local checks = {}
local allPassed = true
for _, item in items do
  local target = resolvePath(item.targetPath)
  local passed = false
  if item.kind == "destroy_created" then
    passed = target == nil
  elseif target then
    local current = target:GetAttribute(item.attributeName)
    passed = item.previous.exists and current == item.previous.value or (not item.previous.exists and current == nil)
  end
  allPassed = allPassed and passed
  table.insert(checks, {operationId = item.operationId, targetPath = item.targetPath, passed = passed})
end
return HttpService:JSONEncode({ok = allPassed, checks = checks})
`.trim();
}

function parseJsonPayload<T>(text: string): T {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace)
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T | string;
      return (typeof parsed === "string" ? JSON.parse(parsed) : parsed) as T;
    } catch {
      // Try the next bounded candidate.
    }
  }
  throw new Error(`Studio returned an unreadable response: ${trimmed.slice(0, 240)}`);
}

export async function previewStudioOperations(studioId: string, operations: StudioBridgeOperation[]) {
  const response = await executeStudioLuau(studioId, buildPreviewLuau(operations));
  const payload = parseJsonPayload<{ items: Array<Omit<StudioBridgePreviewItem, "summary">> }>(response);
  return payload.items.map((item) => ({
    ...item,
    summary:
      item.kind === "create_folder"
        ? `Create Folder at ${item.targetPath}`
        : item.kind === "create_script"
          ? `Create typed Luau script at ${item.targetPath}`
          : `Set an attribute on ${item.targetPath}`,
  }));
}

export async function applyStudioPlan(plan: StudioBridgePlan) {
  const response = await executeStudioLuau(plan.studioId, buildApplyLuau(plan));
  const payload = parseJsonPayload<{
    ok: boolean;
    changed: number;
    results: Array<{
      operationId: string;
      targetPath: string;
      kind: "created" | "attribute";
      attributeName?: string;
      previous?: { exists: boolean; value?: string | number | boolean };
      appliedValue?: string | number | boolean | null;
    }>;
  }>(response);
  const rollback: StudioBridgeRollbackItem[] = payload.results.map((item) =>
    item.kind === "created"
      ? { operationId: item.operationId, kind: "destroy_created", targetPath: item.targetPath }
      : {
          operationId: item.operationId,
          kind: "restore_attribute",
          targetPath: item.targetPath,
          attributeName: item.attributeName,
          previous: item.previous || { exists: false },
          appliedValue: item.appliedValue ?? null,
        },
  );
  try {
    const verificationResponse = await executeStudioLuau(
      plan.studioId,
      buildVerificationLuau(plan),
    );
    const verification = parseJsonPayload<{ ok: boolean; checks: Array<{ passed: boolean }> }>(verificationResponse);
    const passed = verification.checks.filter((check) => check.passed).length;
    return {
      changed: payload.changed,
      rollback,
      verificationOk: verification.ok,
      verification: `${passed}/${verification.checks.length} Studio checks passed.`,
    };
  } catch (error) {
    return {
      changed: payload.changed,
      rollback,
      verificationOk: false,
      verification: `Studio changed, but verification could not complete: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export async function rollbackStudioPlan(plan: StudioBridgePlan) {
  const response = await executeStudioLuau(plan.studioId, buildRollbackLuau(plan));
  const payload = parseJsonPayload<{ ok: boolean; changed: number }>(response);
  if (!payload.ok) throw new Error("Studio rejected the rollback.");
  const verificationResponse = await executeStudioLuau(
    plan.studioId,
    buildRollbackVerificationLuau(plan),
  );
  const verification = parseJsonPayload<{ ok: boolean; checks: Array<{ passed: boolean }> }>(verificationResponse);
  const passed = verification.checks.filter((check) => check.passed).length;
  if (!verification.ok)
    throw new Error(`Rollback ran, but only ${passed}/${verification.checks.length} verification checks passed.`);
  return {
    changed: payload.changed,
    verification: `Rollback verified: ${passed}/${verification.checks.length} checks passed.`,
  };
}

export async function getStudioBridgeOverview(preferredStudioId?: string) {
  const studios = await listConnectedStudios();
  const studio = studios.find((item) => item.id === preferredStudioId) || studios[0];
  if (!studio) return { connected: false as const, studios, snapshot: null };
  if (studio.mode !== "Edit")
    return { connected: true as const, studios, studio, snapshot: null, warning: "Studio must be in Edit mode for bridge inspection and changes." };
  const code = `
local HttpService = game:GetService("HttpService")
local serviceNames = {"Workspace", "ReplicatedStorage", "ServerScriptService", "ServerStorage", "StarterGui", "StarterPlayer", "Lighting", "SoundService"}
local services = {}
local totalScripts = 0
local totalRemotes = 0
for _, name in serviceNames do
  local service = game:GetService(name)
  local descendants = service:GetDescendants()
  local scripts = 0
  local remotes = 0
  for _, instance in descendants do
    if instance:IsA("LuaSourceContainer") then scripts += 1 end
    if instance:IsA("RemoteEvent") or instance:IsA("RemoteFunction") or instance:IsA("UnreliableRemoteEvent") then remotes += 1 end
  end
  totalScripts += scripts
  totalRemotes += remotes
  table.insert(services, {name = name, immediateChildren = #service:GetChildren(), descendants = #descendants, scripts = scripts, remotes = remotes})
end
return HttpService:JSONEncode({services = services, totalScripts = totalScripts, totalRemotes = totalRemotes})
`.trim();
  const response = await executeStudioLuau(studio.id, code);
  const snapshot = parseJsonPayload<{
    services: Array<{ name: string; immediateChildren: number; descendants: number; scripts: number; remotes: number }>;
    totalScripts: number;
    totalRemotes: number;
  }>(response);
  return { connected: true as const, studios, studio, snapshot };
}

export function createBridgePlan(input: {
  studioId: string;
  studioName: string;
  projectId?: string;
  title: string;
  description: string;
  operations: StudioBridgeOperation[];
  preview: StudioBridgePreviewItem[];
}): StudioBridgePlan {
  const timestamp = new Date().toISOString();
  return {
    id: randomUUID(),
    ...input,
    status: "preview_ready",
    rollback: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
