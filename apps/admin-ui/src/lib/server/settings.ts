import { getAdminPaths } from "./paths";
import { readJsonFile, writeJsonFile } from "./json-store";

export interface ProviderTestSnapshot {
  lastTestStatus: "unknown" | "ok" | "failed";
  lastTestAt?: string;
  lastError?: string;
}

export interface ProviderMetadata {
  name?: string;
  websiteUrl?: string;
  notes?: string;
  enabled?: boolean;
  updatedAt?: string;
}

export interface AdminSettings {
  providerTests?: Record<string, ProviderTestSnapshot>;
  providerMetadata?: Record<string, ProviderMetadata>;
  platform?: {
    agentStorage?: {
      workspaceRoot?: string;
      agentDirRoot?: string;
    };
  };
}

export async function readAdminSettings() {
  const { adminSettingsFile } = getAdminPaths();
  return readJsonFile<AdminSettings>(adminSettingsFile, {});
}

export async function writeAdminSettings(settings: AdminSettings) {
  const { adminSettingsFile } = getAdminPaths();
  await writeJsonFile(adminSettingsFile, settings);
}

export async function readProviderTestSnapshots() {
  const settings = await readAdminSettings();
  return settings.providerTests ?? {};
}

export async function writeProviderTestSnapshot(
  providerId: string,
  snapshot: ProviderTestSnapshot,
) {
  const settings = await readAdminSettings();
  await writeAdminSettings({
    ...settings,
    providerTests: {
      ...(settings.providerTests ?? {}),
      [providerId]: snapshot,
    },
  });
}

export async function readProviderMetadataMap() {
  const settings = await readAdminSettings();
  return settings.providerMetadata ?? {};
}

export async function writeProviderMetadata(
  providerId: string,
  metadata: ProviderMetadata,
) {
  const settings = await readAdminSettings();
  await writeAdminSettings({
    ...settings,
    providerMetadata: {
      ...(settings.providerMetadata ?? {}),
      [providerId]: {
        ...(settings.providerMetadata?.[providerId] ?? {}),
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
    },
  });
}

export async function deleteProviderMetadata(providerId: string) {
  const settings = await readAdminSettings();
  if (!settings.providerMetadata?.[providerId]) {
    return;
  }

  const nextMetadata = { ...(settings.providerMetadata ?? {}) };
  delete nextMetadata[providerId];

  await writeAdminSettings({
    ...settings,
    providerMetadata: nextMetadata,
  });
}
