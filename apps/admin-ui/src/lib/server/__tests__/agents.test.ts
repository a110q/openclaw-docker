import { describe, expect, it } from "vitest";
import { buildAgentBatch } from "../agents";

describe("buildAgentBatch", () => {
  it("creates deterministic names and workspace paths for a prefix/count pair", () => {
    const batch = buildAgentBatch({
      prefix: "ops",
      count: 3,
      startIndex: 1,
      workspaceRoot: "/data/root/openclaw/workspace/agents",
      agentDirRoot: "/data/root/openclaw/agents",
    });
    expect(batch.map((item) => item.name)).toEqual([
      "ops-001",
      "ops-002",
      "ops-003",
    ]);
    expect(batch[0].workspacePath).toBe(
      "/data/root/openclaw/workspace/agents/ops-001",
    );
  });
});
