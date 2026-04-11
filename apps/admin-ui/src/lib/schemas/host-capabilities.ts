import { z } from 'zod';
import { alertChannelSchema, providerInputSchema } from './admin';

export const hostCapabilityIdSchema = z.enum([
  'host.compose.ps',
  'host.compose.logs',
  'host.provider.upsert',
  'host.alert.feishu.upsert',
  'host.service.recreateGateway'
]);

const composeLogsInputSchema = z.object({
  service: z.string().min(1).default('openclaw-gateway'),
  tail: z.number().int().min(1).max(500).default(120)
});

const composePsInputSchema = z.object({}).default({});
const recreateGatewayInputSchema = z.object({}).default({});

export const hostCapabilityPreviewSchema = z.discriminatedUnion('capabilityId', [
  z.object({ capabilityId: z.literal('host.compose.ps'), input: composePsInputSchema }),
  z.object({ capabilityId: z.literal('host.compose.logs'), input: composeLogsInputSchema }),
  z.object({ capabilityId: z.literal('host.provider.upsert'), input: providerInputSchema }),
  z.object({ capabilityId: z.literal('host.alert.feishu.upsert'), input: alertChannelSchema }),
  z.object({ capabilityId: z.literal('host.service.recreateGateway'), input: recreateGatewayInputSchema })
]);

export const hostCapabilityExecuteSchema = z.discriminatedUnion('capabilityId', [
  z.object({ capabilityId: z.literal('host.compose.ps'), input: composePsInputSchema, confirmed: z.boolean().optional() }),
  z.object({ capabilityId: z.literal('host.compose.logs'), input: composeLogsInputSchema, confirmed: z.boolean().optional() }),
  z.object({ capabilityId: z.literal('host.provider.upsert'), input: providerInputSchema, confirmed: z.boolean().optional() }),
  z.object({ capabilityId: z.literal('host.alert.feishu.upsert'), input: alertChannelSchema, confirmed: z.boolean().optional() }),
  z.object({ capabilityId: z.literal('host.service.recreateGateway'), input: recreateGatewayInputSchema, confirmed: z.boolean() })
]);

export type HostCapabilityPreviewInput = z.infer<typeof hostCapabilityPreviewSchema>;
export type HostCapabilityExecuteInput = z.infer<typeof hostCapabilityExecuteSchema>;
