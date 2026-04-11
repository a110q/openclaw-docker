import mysql, { type Pool } from 'mysql2/promise';
import { getPlatformEnv } from './platform-env';
import { hashPassword } from './platform-security';
import { randomUUID } from 'crypto';

declare global {
  var __openclawPlatformPool: Pool | undefined;
  var __openclawPlatformSchemaPromise: Promise<void> | undefined;
}

export function getPlatformPool() {
  if (global.__openclawPlatformPool) {
    return global.__openclawPlatformPool;
  }

  const env = getPlatformEnv();
  global.__openclawPlatformPool = mysql.createPool({
    host: env.OPENCLAW_PLATFORM_MYSQL_HOST,
    port: env.OPENCLAW_PLATFORM_MYSQL_PORT,
    user: env.OPENCLAW_PLATFORM_MYSQL_USER,
    password: env.OPENCLAW_PLATFORM_MYSQL_PASSWORD,
    database: env.OPENCLAW_PLATFORM_MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  });

  return global.__openclawPlatformPool;
}

async function seedBootstrapAdmin() {
  const pool = getPlatformPool();
  const env = getPlatformEnv();
  const [rows] = await pool.query<any[]>(
    'SELECT id FROM platform_users WHERE email = ? LIMIT 1',
    [env.OPENCLAW_PLATFORM_BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase()],
  );

  if (rows.length > 0) return;

  await pool.execute(
    `INSERT INTO platform_users (id, email, display_name, password_hash, role, status)
     VALUES (?, ?, ?, ?, 'admin', 'active')`,
    [
      randomUUID(),
      env.OPENCLAW_PLATFORM_BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase(),
      '平台管理员',
      await hashPassword(env.OPENCLAW_PLATFORM_BOOTSTRAP_ADMIN_PASSWORD),
    ],
  );
}

async function runSchemaSetup() {
  const pool = getPlatformPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_users (
      id CHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(190) NOT NULL UNIQUE,
      display_name VARCHAR(80) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      status ENUM('active','disabled') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_login_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_sessions (
      id CHAR(64) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NULL,
      INDEX idx_platform_sessions_user_id (user_id),
      INDEX idx_platform_sessions_expires_at (expires_at),
      CONSTRAINT fk_platform_sessions_user FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_providers (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      name VARCHAR(80) NOT NULL,
      type VARCHAR(40) NOT NULL DEFAULT 'openai-compatible',
      base_url VARCHAR(500) NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      model_id VARCHAR(160) NOT NULL,
      model_name VARCHAR(160) NOT NULL,
      runtime_provider_id VARCHAR(120) NOT NULL UNIQUE,
      runtime_model_ref VARCHAR(220) NOT NULL,
      sync_status ENUM('pending','synced','failed') NOT NULL DEFAULT 'pending',
      sync_error TEXT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_platform_providers_user_id (user_id),
      CONSTRAINT fk_platform_providers_user FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_lobsters (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      name VARCHAR(80) NOT NULL,
      archetype VARCHAR(80) NOT NULL DEFAULT '通用龙虾',
      persona_summary VARCHAR(255) NULL,
      model_ref VARCHAR(220) NOT NULL,
      provider_id CHAR(36) NULL,
      runtime_agent_id VARCHAR(120) NULL UNIQUE,
      runtime_sync_status ENUM('pending','synced','failed') NOT NULL DEFAULT 'pending',
      runtime_sync_error TEXT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_platform_lobsters_user_id (user_id),
      CONSTRAINT fk_platform_lobsters_user FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_platform_lobsters_provider FOREIGN KEY (provider_id) REFERENCES platform_providers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_swarm_workspaces (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      swarm_tenant_key VARCHAR(120) NOT NULL UNIQUE,
      swarm_user_ref VARCHAR(120) NOT NULL,
      status ENUM('pending','ready','error') NOT NULL DEFAULT 'pending',
      last_sync_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_platform_swarm_workspaces_user_id (user_id),
      INDEX idx_platform_swarm_workspaces_status (status),
      CONSTRAINT fk_platform_swarm_workspaces_user FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_swarm_members (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      lobster_id CHAR(36) NOT NULL,
      runtime_agent_id VARCHAR(120) NULL,
      swarm_member_ref VARCHAR(120) NOT NULL UNIQUE,
      display_name VARCHAR(120) NOT NULL,
      sync_status ENUM('pending','synced','failed') NOT NULL DEFAULT 'pending',
      sync_error TEXT NULL,
      last_synced_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_platform_swarm_members_user_lobster (user_id, lobster_id),
      INDEX idx_platform_swarm_members_user_id (user_id),
      INDEX idx_platform_swarm_members_sync_status (sync_status),
      CONSTRAINT fk_platform_swarm_members_user FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_platform_swarm_members_lobster FOREIGN KEY (lobster_id) REFERENCES platform_lobsters(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_swarm_sessions (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      workspace_id CHAR(36) NOT NULL,
      swarm_conversation_ref VARCHAR(120) NOT NULL,
      title VARCHAR(160) NOT NULL,
      mode VARCHAR(40) NOT NULL DEFAULT 'direct',
      status ENUM('pending','running','succeeded','failed') NOT NULL DEFAULT 'pending',
      last_message_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_platform_swarm_sessions_user_id (user_id),
      INDEX idx_platform_swarm_sessions_workspace_id (workspace_id),
      CONSTRAINT fk_platform_swarm_sessions_user FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_platform_swarm_sessions_workspace FOREIGN KEY (workspace_id) REFERENCES platform_swarm_workspaces(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_swarm_tasks (
      id CHAR(36) NOT NULL PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      workspace_id CHAR(36) NOT NULL,
      swarm_task_ref VARCHAR(120) NOT NULL,
      conversation_id CHAR(36) NULL,
      title VARCHAR(160) NOT NULL,
      status ENUM('pending','running','succeeded','failed') NOT NULL DEFAULT 'pending',
      summary TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_platform_swarm_tasks_user_id (user_id),
      INDEX idx_platform_swarm_tasks_workspace_id (workspace_id),
      CONSTRAINT fk_platform_swarm_tasks_user FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_platform_swarm_tasks_workspace FOREIGN KEY (workspace_id) REFERENCES platform_swarm_workspaces(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_swarm_settings (
      user_id CHAR(36) NOT NULL PRIMARY KEY,
      preferences_json JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_platform_swarm_settings_user FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await seedBootstrapAdmin();
}

export async function ensurePlatformSchema() {
  if (!global.__openclawPlatformSchemaPromise) {
    global.__openclawPlatformSchemaPromise = runSchemaSetup();
  }
  await global.__openclawPlatformSchemaPromise;
}
