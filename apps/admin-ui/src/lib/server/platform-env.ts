import { z } from 'zod';

const envBoolean = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const platformEnvSchema = z.object({
  OPENCLAW_PLATFORM_NAME: z.string().default('OpenClaw 平台'),
  OPENCLAW_PLATFORM_MYSQL_HOST: z.string().default('openclaw-mysql'),
  OPENCLAW_PLATFORM_MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  OPENCLAW_PLATFORM_MYSQL_DATABASE: z.string().default('openclaw_platform'),
  OPENCLAW_PLATFORM_MYSQL_USER: z.string().default('openclaw'),
  OPENCLAW_PLATFORM_MYSQL_PASSWORD: z.string().default('openclaw_platform_change_me'),
  OPENCLAW_PLATFORM_CRYPTO_SECRET: z.string().min(16).default('openclaw_platform_crypto_secret_change_me'),
  OPENCLAW_PLATFORM_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  OPENCLAW_PLATFORM_DEFAULT_MODEL: z.string().default('default/gpt-5.4'),
  OPENCLAW_PLATFORM_BOOTSTRAP_ADMIN_EMAIL: z.string().email().default('admin@openclaw.local'),
  OPENCLAW_PLATFORM_BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).default('OpenClawAdmin123!'),
  OPENCLAW_CLAWSWARM_ENABLED: envBoolean.default(true),
  OPENCLAW_CLAWSWARM_PORT: z.coerce.number().int().positive().default(18080),
  OPENCLAW_CLAWSWARM_INTERNAL_URL: z.string().default('http://openclaw-clawswarm:18080'),
  OPENCLAW_CLAWSWARM_PUBLIC_URL: z.string().default('http://localhost:18080'),
  OPENCLAW_CLAWSWARM_USERNAME: z.string().min(1).default('admin'),
  OPENCLAW_CLAWSWARM_PASSWORD: z.string().min(8).default('admin123456'),
});

export type PlatformEnv = z.infer<typeof platformEnvSchema>;

let cachedPlatformEnv: PlatformEnv | null = null;

export function getPlatformEnv(): PlatformEnv {
  if (cachedPlatformEnv) return cachedPlatformEnv;
  cachedPlatformEnv = platformEnvSchema.parse(process.env);
  return cachedPlatformEnv;
}
