import { z } from "zod";

export const loginSchema = z.object({ token: z.string().min(1) });

const providerModelInputSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const optionalScalarSchema = z.union([z.string(), z.number()]).optional();

export const providerInputSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(["openai-compatible", "anthropic", "gemini", "ollama"]),
    baseUrl: z.string().min(1),
    apiKey: z.string().optional().default(""),
    enabled: z.boolean().default(true),
    isDefault: z.boolean().default(false),
    modelId: z.string().trim().optional().default(""),
    modelName: z.string().trim().optional().default(""),
    models: z.array(providerModelInputSchema).optional().default([]),
    defaultModelId: z.string().trim().optional().default(""),
    websiteUrl: z.string().trim().optional().default(""),
    notes: z.string().trim().optional().default(""),
  })
  .superRefine((value, ctx) => {
    const hasModelList = value.models.length > 0;
    const hasLegacyModel = Boolean(value.modelId && value.modelName);

    if (!hasModelList && !hasLegacyModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "至少配置一个模型",
        path: ["models"],
      });
    }

    if (value.modelId && !value.modelName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "填写模型 ID 时，也需要填写模型名称",
        path: ["modelName"],
      });
    }
  });

export const agentCreateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  primaryModelId: z.string().min(1),
  imageModelId: z.string().optional(),
  source: z.enum(["manual", "batch-created"]).default("manual"),
  notes: z.string().optional().default(""),
  tags: z.array(z.string()).default([]),
  workspacePath: z.string().trim().optional().default(""),
  agentDirPath: z.string().trim().optional().default(""),
  sandboxCpuLimit: optionalScalarSchema,
  sandboxMemoryLimit: z.string().trim().optional().default(""),
  sandboxMemorySwap: z.string().trim().optional().default(""),
  sandboxPidsLimit: optionalScalarSchema,
});

export const batchCreateSchema = z.object({
  prefix: z.string().min(1),
  count: z.number().int().min(1).max(50),
  startIndex: z.number().int().min(1).default(1),
  primaryModelId: z.string().min(1),
  imageModelId: z.string().optional(),
  notes: z.string().optional().default(""),
});

export const agentBindingSchema = z.object({
  primaryModelId: z.string().min(1),
  imageModelId: z.string().optional().default(""),
});

export const discoveryImportSchema = z.object({
  items: z
    .array(
      z.object({ path: z.string().min(1), suggestedName: z.string().min(1) }),
    )
    .min(1),
});

export const alertChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  webhookUrl: z.string().url(),
  secret: z.string().optional().default(""),
  enabled: z.boolean().default(true),
  minLevel: z.enum(["info", "warning", "critical"]).default("warning"),
});

export const alertRuleSchema = z.object({
  id: z.string().min(1),
  eventType: z.string().min(1),
  enabled: z.boolean(),
  level: z.enum(["info", "warning", "critical"]),
  channelIds: z.array(z.string()),
  cooldownSeconds: z.number().int().min(0),
});

export const feishuBindingUpsertSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("group-binding"),
    peerId: z.string().trim().min(1),
    agentId: z.string().trim().min(1),
    enabled: z.boolean().default(true),
    requireMention: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal("dm-binding"),
    peerId: z.string().trim().min(1),
    agentId: z.string().trim().min(1),
    enabled: z.boolean().default(true),
    bindingKind: z.enum(["direct", "dm"]).default("direct"),
  }),
]);

export const feishuBindingDeleteSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("group-binding"),
    peerId: z.string().trim().min(1),
  }),
  z.object({ kind: z.literal("dm-binding"), peerId: z.string().trim().min(1) }),
]);

export const previewChangeSchema = z.object({
  source: z.string().min(1),
  changes: z
    .array(
      z.object({
        field: z.string().min(1),
        source: z.enum(["env", "openclaw-json", "admin-meta"]),
      }),
    )
    .min(1),
});

export const agentStorageSettingsSchema = z.object({
  workspaceRoot: z.string().trim().min(1),
  agentDirRoot: z.string().trim().min(1),
});

export const sandboxPolicySchema = z.object({
  cpus: optionalScalarSchema,
  memory: z.string().trim().optional().default(""),
  memorySwap: z.string().trim().optional().default(""),
  pidsLimit: optionalScalarSchema,
});

export const sandboxContainerActionSchema = z.object({
  action: z.enum(['restart', 'remove']),
});

export const agentExportSchema = z.object({
  agentIds: z.array(z.string().trim().min(1)).min(1),
});
