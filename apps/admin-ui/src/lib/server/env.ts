import path from 'path';
import { z } from 'zod';

const envSchema = z.object({
  OPENCLAW_ADMIN_UI_TOKEN: z.string().min(12, 'OPENCLAW_ADMIN_UI_TOKEN must be at least 12 chars'),
  OPENCLAW_ADMIN_REPO_ROOT: z.string().default(path.resolve(process.cwd(), '../..')),
  OPENCLAW_HOST_DATA_ROOT: z.string().min(1),
  OPENCLAW_ADMIN_UI_PORT: z.string().default('18889'),
  DOCKER_SOCKET_PATH: z.string().default('/var/run/docker.sock'),
});

export type AdminEnv = z.infer<typeof envSchema>;

let cachedEnv: AdminEnv | null = null;

export function getAdminEnv(): AdminEnv {
  if (cachedEnv) return cachedEnv;
  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}
