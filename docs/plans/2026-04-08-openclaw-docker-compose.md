# OpenClaw Docker Compose Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Docker-based OpenClaw deployment with Docker sandboxing enabled, host-mounted editable config, Feishu-ready channel scaffolding, and isolated multi-agent workspaces.

**Architecture:** Use the official `ghcr.io/openclaw/openclaw:2026.4.5` image as the runtime base, add Docker CLI in a thin wrapper image, and orchestrate `openclaw-gateway`, `openclaw-cli`, and an optional `openclaw-tools` container via Compose. Persist all runtime state under `/Users/awk/lqf/openclaw_data`, with `openclaw.json` mounted from the host for direct editing.

**Tech Stack:** Docker Compose, Debian-based Dockerfile wrapper, OpenClaw `openclaw.json`, shell helper scripts, Markdown docs.

---

### Task 1: Scaffold repository files

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `Dockerfile`
- Create: `config/openclaw.json.example`
- Create: `scripts/init-data-dir.sh`

**Step 1:** Create directory structure for `config`, `scripts`, and `docs/plans`.

**Step 2:** Add `.gitignore` entries for local `.env`, generated host data, and editor cruft.

**Step 3:** Add `.env.example` with deployment-only knobs: image tag, host ports, host data root, timezone, Docker socket, and gateway token placeholder.

**Step 4:** Add `Dockerfile` using `ghcr.io/openclaw/openclaw:2026.4.5` as the base and install Docker CLI plus Compose plugin for sandbox support.

**Step 5:** Add `docker-compose.yml` with `openclaw-gateway`, `openclaw-cli`, and profile-gated `openclaw-tools`, mounting the shared host data tree and Docker socket.

### Task 2: Author OpenClaw configuration template

**Files:**
- Create: `config/openclaw.json.example`

**Step 1:** Define `gateway` settings for LAN bind, token auth, and control UI allowed origins.

**Step 2:** Define `models.providers` with runnable `default` provider plus placeholder `claude`, `gemini`, and `ollama` providers.

**Step 3:** Define `agents.defaults` plus named `default`, `backend`, and `frontend` agents with isolated `workspace` and `agentDir` values.

**Step 4:** Define `tools`, `messages`, `memory`, and `sandbox` defaults suitable for Docker deployment.

**Step 5:** Define `channels.feishu` and sample `bindings` entries for later routing to `backend` and `frontend` agents.

### Task 3: Add operator helpers and docs

**Files:**
- Create: `scripts/init-data-dir.sh`
- Create: `README.md`

**Step 1:** Write `scripts/init-data-dir.sh` to create required directories under `/Users/awk/lqf/openclaw_data` and copy the example config if missing.

**Step 2:** Document startup flow: copy `.env.example`, initialize data dir, build image, start gateway, run CLI, and enable tools profile.

**Step 3:** Document how to edit `/Users/awk/lqf/openclaw_data/openclaw/openclaw.json`, configure Feishu credentials, and bind chats to agents.

### Task 4: Verify configuration integrity

**Files:**
- Test: `docker-compose.yml`
- Test: `config/openclaw.json.example`
- Test: `scripts/init-data-dir.sh`

**Step 1:** Run `jq . config/openclaw.json.example` and confirm valid JSON.

**Step 2:** Run `bash -n scripts/init-data-dir.sh` and confirm shell syntax is valid.

**Step 3:** Run `docker compose --env-file .env.example config` and confirm the Compose file resolves successfully.

**Step 4:** If Docker image pull/build is available, run `docker compose --env-file .env.example build` to verify the wrapper image builds.
