import path from "path";
import { getAdminEnv } from "./env";

export function resolveAdminPaths(input: {
  repoRoot: string;
  hostDataRoot: string;
}) {
  const adminDataDir = path.join(input.hostDataRoot, "openclaw", "admin-ui");
  return {
    repoRoot: input.repoRoot,
    hostDataRoot: input.hostDataRoot,
    adminDataDir,
    managedAgentsFile: path.join(adminDataDir, "managed-agents.json"),
    alertChannelsFile: path.join(adminDataDir, "alert-channels.json"),
    alertRulesFile: path.join(adminDataDir, "alert-rules.json"),
    tasksFile: path.join(adminDataDir, "tasks.json"),
    activityFile: path.join(adminDataDir, "activity.json"),
    changeSetsFile: path.join(adminDataDir, "change-sets.json"),
    adminSettingsFile: path.join(adminDataDir, "settings.json"),
    discoveryResultsDir: path.join(adminDataDir, "discovery-results"),
    migrationExportsDir: path.join(adminDataDir, "migration-exports"),
    migrationTempDir: path.join(adminDataDir, "migration-temp"),
    envFile: path.join(input.repoRoot, ".env"),
    composeFile: path.join(input.repoRoot, "docker-compose.yml"),
    openclawConfigFile: path.join(
      input.hostDataRoot,
      "openclaw",
      "openclaw.json",
    ),
  };
}

export function getAdminPaths() {
  const env = getAdminEnv();
  return resolveAdminPaths({
    repoRoot: env.OPENCLAW_ADMIN_REPO_ROOT,
    hostDataRoot: env.OPENCLAW_HOST_DATA_ROOT,
  });
}
