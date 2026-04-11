# ADR 0002：Agent 存储目录与迁移包设计

## 状态

已采纳

## 背景

当前项目以 Docker 方式部署，运行时会把整个 `OPENCLAW_HOST_DATA_ROOT` 挂进容器。

随着后台逐步支持 Agent 纳管、批量创建、自动扫描、飞书绑定和平台迁移，出现了两个新需求：

1. Agent 的数据落盘目录需要支持配置，而不是永远写死默认路径。
2. 需要把 Agent 级别和平台级别的数据迁移做成后台可直接操作的能力。

如果允许用户直接填写任意绝对路径，会带来几个问题：

- Docker 挂载路径和容器可见路径更难保证一致。
- 平台迁移时需要处理更多不可控的宿主机路径差异。
- 后台扫描和导入逻辑更容易越出宿主机数据根目录边界。

## 决策

采用“**相对 `OPENCLAW_HOST_DATA_ROOT` 的可配置路径**”方案，而不是任意绝对路径。

具体规则：

- `workspaceRoot` 与 `agentDirRoot` 只允许填写相对路径。
- 默认值保持不变：
  - `openclaw/workspace/agents`
  - `openclaw/agents`
- 新建 Agent、批量创建、自动扫描导入、Agent 包导入都读取这两个配置。
- 既有 Agent 保留其已经写入 `openclaw.json` 的显式绝对路径，不做隐式迁移。

同时引入两类迁移包：

### 1. Agent 包

用于在当前平台内导入 / 导出一部分 Agent。

内容包括：

- 选中 Agent 的配置片段
- Admin UI 元数据
- 相关 bindings
- 匹配到的飞书群配置 / 私聊白名单
- Agent 的 `workspace` / `agent` 目录内容

### 2. 平台迁移包

用于把当前 OpenClaw Docker 平台整体迁移到另一台机器。

内容包括：

- 部署骨架（`docker-compose.yml`、`Dockerfile`、`apps`、`scripts`、`config`、`plugins`、`overlays` 等）
- 当前 `.env`
- `OPENCLAW_HOST_DATA_ROOT` 下所需的 `openclaw` 数据
- 如果 Agent 存储目录改到了 `openclaw/*` 之外，则额外包含对应子树
- `bootstrap-migrate.sh` 启动脚本

## 结果

### 优点

- 对 Docker 部署友好，路径边界清晰。
- 后台扫描和导入不会越出宿主机数据根目录。
- 平台迁移时只需替换宿主机根目录，脚本即可自动改写绝对路径。
- 用户仍然可以调整 Agent 数据目录结构，而不必改源码或改 Compose。

### 代价

- 既有 Agent 不会因为修改设置而自动迁移，需要显式导出 / 导入或手工迁移。
- 平台迁移脚本目前只重写关键运行文件中的宿主机绝对路径，不会清洗所有历史日志 / 临时快照。

## 备注

这个决策与当前 Docker 挂载方式强相关：容器已经挂载整个 `OPENCLAW_HOST_DATA_ROOT`，因此“相对宿主根目录”的抽象既安全，也最利于迁移。
