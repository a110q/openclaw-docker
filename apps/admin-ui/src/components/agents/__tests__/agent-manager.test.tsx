import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentManager } from "../agent-manager";
import type { ManagedAgent, ProviderRecord } from "@/lib/types/admin";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const agents: ManagedAgent[] = [
  {
    id: "backend",
    name: "Backend",
    displayName: "Backend",
    source: "manual",
    workspacePath: "/data/openclaw/workspace/agents/backend",
    agentDirPath: "/data/openclaw/agents/backend/agent",
    runtimeStatus: "running",
    primaryModelId: "default/gpt-5.4",
    imageModelId: "",
    inheritsDefaultModel: false,
    sandboxMode: "all",
    tags: [],
    notes: "后端服务代理",
    managed: true,
  },
];

const models = [
  {
    id: "default/gpt-5.4",
    label: "GPT 5.4 · default · 默认",
    providerId: "default",
    modelId: "gpt-5.4",
    isDefault: true,
  },
  {
    id: "claude/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5 · claude",
    providerId: "claude",
    modelId: "claude-sonnet-4-5",
    isDefault: false,
  },
];

const providers: ProviderRecord[] = [
  {
    id: "default",
    name: "默认网关",
    type: "openai-compatible",
    baseUrl: "https://example.com/v1",
    apiKeyMasked: "sk****1234",
    apiKeyConfigured: true,
    enabled: true,
    isDefault: true,
    modelCount: 1,
    modelId: "gpt-5.4",
    modelName: "GPT 5.4",
    defaultModelId: "gpt-5.4",
    models: [{ id: "gpt-5.4", name: "GPT 5.4", capabilities: ["text", "image"] }],
    websiteUrl: "https://example.com",
    notes: "默认供应商",
    lastTestStatus: "unknown",
  },
];

describe("AgentManager", () => {
  it("shows cc-switch style provider binding mode for the selected agent", () => {
    render(
      <AgentManager agents={agents} models={models} providers={providers} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "配置 Backend" }));
    fireEvent.click(screen.getByRole("button", { name: /新增供应商并绑定/ }));

    expect(screen.getByText("供应商名称")).toBeInTheDocument();
    expect(screen.getByText("官网链接")).toBeInTheDocument();
    expect(screen.getByText("API Key")).toBeInTheDocument();
    expect(screen.getByText("API 请求地址")).toBeInTheDocument();
    expect(screen.getByText("模型名称")).toBeInTheDocument();
  });

  it("keeps an existing model binding mode alongside provider creation mode", () => {
    render(
      <AgentManager agents={agents} models={models} providers={providers} />,
    );

    expect(
      screen.getAllByRole("button", { name: /绑定现有模型/ }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /新增供应商并绑定/ }).length,
    ).toBeGreaterThan(0);
  });

  it("prefers a safe model for new agents and blocks risky default/glm bindings", () => {
    render(
      <AgentManager
        agents={agents}
        models={[
          {
            id: "default/glm-5",
            label: "GLM 5 · default · 默认 · 不建议 Agent 使用",
            providerId: "default",
            modelId: "glm-5",
            isDefault: true,
          },
          {
            id: "claude/claude-sonnet-4-5",
            label: "Claude Sonnet 4.5 · claude",
            providerId: "claude",
            modelId: "claude-sonnet-4-5",
            isDefault: false,
          },
        ]}
        providers={providers}
      />,
    );

    const agentIdInput = screen
      .getAllByLabelText("Agent 标识")
      .at(-1) as HTMLInputElement;
    const displayNameInput = screen
      .getAllByLabelText("显示名称")
      .at(-1) as HTMLInputElement;
    const primaryModel = screen
      .getAllByLabelText("主模型")
      .at(-1) as HTMLSelectElement;

    fireEvent.change(agentIdInput, { target: { value: "new-agent" } });
    fireEvent.change(displayNameInput, { target: { value: "New Agent" } });
    expect(primaryModel.value).toBe("claude/claude-sonnet-4-5");

    fireEvent.change(primaryModel, { target: { value: "default/glm-5" } });

    expect(screen.getByText(/容易导致 Agent 工具调用异常/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "请先更换主模型" }),
    ).toBeDisabled();
  });
});
