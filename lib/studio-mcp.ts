import { spawn } from "node:child_process";
import path from "node:path";

type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

type McpToolResult = {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

function studioMcpLauncher() {
  if (process.env.ROBLOX_STUDIO_MCP_COMMAND)
    return process.env.ROBLOX_STUDIO_MCP_COMMAND;
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData)
    throw new Error("LOCALAPPDATA is unavailable; Roblox Studio MCP cannot be located.");
  return path.join(localAppData, "Roblox", "mcp.bat");
}

export async function callStudioTool<T = McpToolResult>(
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<T> {
  const launcher = studioMcpLauncher();
  return await new Promise<T>((resolve, reject) => {
    const child = spawn("cmd.exe", ["/d", "/s", "/c", launcher], {
      cwd: path.dirname(launcher),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buffer = "";
    let stderr = "";
    let settled = false;
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdin.end();
      const forceClose = setTimeout(() => child.kill(), 500);
      forceClose.unref();
      if (error) reject(error);
      else resolve(value as T);
    };
    const timer = setTimeout(
      () => finish(new Error(`Studio MCP timed out while calling ${name}.`)),
      timeoutMs,
    );
    const send = (payload: unknown) => {
      child.stdin.write(`${JSON.stringify(payload)}\n`);
    };
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-4000);
    });
    child.on("error", (error) => finish(error));
    child.on("exit", (code) => {
      if (!settled)
        finish(
          new Error(
            `Studio MCP exited before responding${code === null ? "" : ` (code ${code})`}${stderr ? `: ${stderr.trim()}` : "."}`,
          ),
        );
    });
    child.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        let message: JsonRpcResponse;
        try {
          message = JSON.parse(trimmed) as JsonRpcResponse;
        } catch {
          continue;
        }
        if (message.id === 1) {
          if (message.error)
            return finish(new Error(message.error.message || "Studio MCP initialization failed."));
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name, arguments: args },
          });
        }
        if (message.id === 2) {
          if (message.error)
            return finish(new Error(message.error.message || `Studio tool ${name} failed.`));
          finish(undefined, message.result as T);
        }
      }
    });
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "blackhole-studio-bridge", version: "1.0.0" },
      },
    });
  });
}

export function studioToolText(result: McpToolResult) {
  if (result.isError)
    throw new Error(
      result.content?.find((item) => item.type === "text")?.text ||
        "Roblox Studio reported an error.",
    );
  return (
    result.content
      ?.filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n") || ""
  );
}

export async function listConnectedStudios() {
  const result = await callStudioTool<McpToolResult>("list_roblox_studios", {});
  const text = studioToolText(result);
  const parsed = JSON.parse(text) as {
    studios?: Array<{
      id: string;
      name: string;
      mode: "Edit" | "Play";
      state?: string;
      placeId?: number;
      universeId?: number;
      persistedToCloud?: boolean;
    }>;
  };
  return parsed.studios || [];
}

export async function executeStudioLuau(studioId: string, code: string) {
  const result = await callStudioTool<McpToolResult>(
    "execute_luau",
    { studio_id: studioId, datamodel_type: "Edit", code },
    30_000,
  );
  return studioToolText(result);
}
