# OpenClaw Docker 开源综合手册

> 面向 GitHub 访客、部署者与维护者的综合说明文档。本文档覆盖项目介绍、设计架构、部署流程、运维方式、配置模型与常见问题。

## 1. 项目简介

`OpenClaw Docker` 是一个围绕 `OpenClaw` 官方镜像构建的本机 / 局域网部署方案，目标是把原本偏“可运行”的官方 Docker 方案，整理成一套更适合个人开发者、独立部署者与本地 AI 工作流使用的“可落地运维包”。

相比直接使用上游镜像，本项目重点解决以下问题：

- 让 `OpenClaw` 在 Docker 环境中更容易启用 sandbox
- 将关键配置文件直接持久化到宿主机，便于手动修改和排障
- 提供多 agent 的基础目录结构与配置模板
- 预留飞书、OpenAI Compatible、Anthropic、Gemini、Ollama 等模型与渠道接入能力
- 统一数据目录、缓存目录与日志目录，降低后续维护成本

这个仓库不是 `OpenClaw` 核心源码仓库，而是一个围绕 `OpenClaw` 官方运行时镜像构建的部署与运维项目。

---

## 2. 设计目标

本项目的设计目标有 5 个：

### 2.1 可部署

提供一套开箱即用的 Docker Compose 结构，尽可能减少“拼装式部署”的工作量。

### 2.2 可维护

所有关键状态尽量落在宿主机目录中，而不是藏在匿名 volume 或容器层里，方便备份、迁移和人工排查。

### 2.3 可扩展

预置多 agent、多模型 provider、多渠道接入的基本骨架，方便后续演进。

### 2.4 可调试

除了主服务外，额外提供 CLI 容器与工具容器，便于执行状态检查、配对、日志查看与手工操作。

### 2.5 可开源展示

文档、目录与配置逻辑尽量明确，让第一次接触项目的人也能快速理解“这个仓库是什么、解决什么问题、怎么部署、怎么维护”。

---

## 3. 核心能力概览

当前版本主要包含以下能力：

- 基于 `ghcr.io/openclaw/openclaw:2026.4.5` 的运行镜像封装
- 为运行容器补充 Docker CLI 与 Compose plugin
- 支持 `OpenClaw` 的 Docker sandbox 模式
- 支持宿主机编辑 `openclaw.json`
- 支持多 agent 目录与默认配置模板
- 支持 OpenAI Compatible 模型网关
- 预留 Anthropic / Gemini / Ollama provider 配置模板
- 预留 Feishu channel 模板
- 提供数据初始化脚本与 sandbox 镜像构建脚本

---

## 4. 适用场景

本项目适合以下场景：

- 在 macOS Docker Desktop 上本机部署 `OpenClaw`
- 在局域网内暴露 `OpenClaw` 仪表盘与网关能力
- 需要多个 agent 分工协作的本地 AI 工作流
- 需要让 agent 在 Docker sandbox 中安全执行命令
- 需要把运行配置、缓存和日志放到宿主机统一管理

不适合或暂未优先覆盖的场景：

- 大规模生产集群部署
- Kubernetes 编排
- 高可用、多副本、自动扩缩容
- 面向公网的零信任安全发布方案

---

## 5. 总体架构

### 5.1 架构视图

```mermaid
flowchart LR
    U[Browser / Control UI] --> G[openclaw-gateway]
    C[openclaw-cli] --> G
    T[openclaw-tools] --> G
    G --> P[Model Providers\nOpenAI Compatible / Claude / Gemini / Ollama]
    G --> S[Sandbox Containers\nopenclaw-sbx-*]
    G --> D[Host Data Root\nopenclaw.json / workspace / logs / cache]
    S --> D
    G --> K[/var/run/docker.sock]
    K --> DS[Docker Engine / Docker Desktop]
```

### 5.2 架构说明

整个系统由 3 层组成：

- **控制层**：浏览器访问 OpenClaw Control UI，与网关建立连接
- **运行层**：`openclaw-gateway` 负责会话、模型调度、agent 执行、sandbox 生命周期管理
- **宿主层**：宿主机负责提供持久化目录、Docker 引擎、配置文件与日志

其中，`openclaw-gateway` 是整个系统的核心；`openclaw-cli` 和 `openclaw-tools` 主要承担辅助操作与运维调试职责。

---

## 6. 组件设计

### 6.1 `openclaw-gateway`

主服务容器，负责：

- 启动 OpenClaw 网关
- 暴露控制 UI 与桥接端口
- 加载 `openclaw.json`
- 管理 agent 会话
- 调用模型 provider
- 创建与复用 sandbox 容器
- 处理设备配对与控制台访问

这是唯一必须长期运行的服务。

### 6.2 `openclaw-cli`

辅助 CLI 容器，复用 `openclaw-gateway` 的网络命名空间，主要用于：

- 执行 `gateway status`
- 查看系统状态
- 运行 pairing 相关命令
- 做容器内排障和临时运维操作

### 6.3 `openclaw-tools`

工具容器，默认不启动，仅在 `tools` profile 下启用。适合：

- 手工进入 shell 调试
- 检查挂载目录
- 做临时文件操作
- 验证容器环境差异

### 6.4 宿主机数据目录

项目将运行数据统一放入：

```bash
/Users/awk/lqf/openclaw_data
```

在这个目录下，主要包含：

- `openclaw/openclaw.json`：主配置文件
- `openclaw/workspace/agents/*`：各 agent 工作区
- `openclaw/workspace/sandbox`：sandbox 容器工作根目录
- `openclaw/agents/*/agent`：各 agent 的 agentDir
- `cache`：缓存
- `logs`：日志

### 6.5 Sandbox 容器

当 agent 需要在 sandbox 中执行任务时，网关会调用 Docker 创建 `openclaw-sbx-*` 容器。

这些容器依赖：

- `openclaw-sandbox-common:bookworm-slim`
- 宿主机可访问的 workspace 路径
- Docker socket 权限

这也是本项目相对官方“最关键”的增强点之一。

---

## 7. 目录结构

仓库目录结构如下：

```text
.
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
├── config/
│   └── openclaw.json.example
├── scripts/
│   ├── init-data-dir.sh
│   └── build-sandbox-image.sh
└── docs/
    ├── plans/
    └── open-source-manual.md
```

各文件职责：

- `Dockerfile`：基于官方镜像补充 Docker CLI
- `docker-compose.yml`：定义主服务、CLI、工具容器
- `.env.example`：环境变量模板
- `config/openclaw.json.example`：OpenClaw 配置模板
- `scripts/init-data-dir.sh`：初始化宿主机目录与配置
- `scripts/build-sandbox-image.sh`：构建 sandbox 镜像
- `README.md`：简明使用说明
- `docs/open-source-manual.md`：完整开源综合手册

---

## 8. 配置设计

### 8.1 环境变量层

项目采用“环境变量 + JSON 模板”的配置方式。

关键原则：

- `.env` 保存部署环境的真实值
- `openclaw.json` 中尽量只保留 `${...}` 占位符
- `docker-compose.yml` 负责把环境变量注入容器

这使得部署层和运行层职责更清晰：

- **部署层**：端口、路径、token、API Key、镜像参数
- **运行层**：agent、provider、channel、sandbox、tool policy

### 8.2 `openclaw.json` 层

主配置主要由以下部分组成：

- `gateway`：网关模式、绑定方式、认证
- `models.providers`：模型服务商配置
- `agents.defaults`：agent 默认行为与 sandbox 策略
- `agents.list`：具体 agent 列表
- `tools`：文件系统、exec、session 等能力
- `channels`：飞书等渠道
- `bindings`：渠道与 agent 的路由绑定

### 8.3 Provider 设计

当前预置了 4 类 provider：

- `default`：OpenAI Compatible
- `claude`：Anthropic
- `gemini`：Google Gemini
- `ollama`：本地 Ollama

其中 `default` provider 默认用于主模型接入，适合接企业网关、代理层或自定义 OpenAI 兼容接口。

---

## 9. 多 Agent 设计

项目默认提供 3 个 agent：

- `default`
- `backend`
- `frontend`

设计意图不是“功能已经写死”，而是提供一个清晰的扩展骨架。

每个 agent 都具备：

- 独立 `workspace`
- 独立 `agentDir`
- 可独立指定模型
- 可继承统一 sandbox 策略

这种设计的好处是：

- 避免多 agent 写同一份工作目录造成上下文污染
- 方便后续为不同 agent 设置不同模型和能力边界
- 更适合做领域分工，例如后端、前端、运维、内容、测试等

---

## 10. Sandbox 设计

### 10.1 为什么要做 sandbox

如果 agent 需要运行命令、读写工作区或做自动化任务，直接在宿主机执行风险较高。Docker sandbox 提供了更可控的隔离环境。

### 10.2 本项目如何处理 sandbox

本项目围绕 sandbox 做了 3 个关键处理：

1. 在运行镜像中安装 Docker CLI
2. 为容器补充访问 Docker socket 的权限
3. 将 sandbox 使用的 workspace 路径切换为宿主机绝对路径，适配 macOS Docker Desktop 的文件共享机制

### 10.3 为什么要用宿主机绝对路径

在 Docker Desktop for macOS 中，sandbox 容器的 bind mount 必须来自 Docker 已知的宿主机路径。

如果网关把容器内路径（例如 `/home/node/.openclaw/...`）再次当作 Docker mount 源路径，Docker Desktop 会报：

```text
mounts denied: The path ... is not shared from the host
```

因此本项目最终采用：

- 网关容器内可见宿主机绝对路径
- `openclaw.json` 中的 `workspace` / `agentDir` / `workspaceRoot` 明确使用宿主机路径

这正是本项目目前可以在 macOS Docker Desktop 下跑通 sandbox 的关键原因。

---

## 11. 部署流程

### 11.0 一键部署最短路径

如果你希望以最低门槛启动这个项目，可以直接执行：

```bash
cp .env.example .env
chmod +x bootstrap.sh
./bootstrap.sh
```

然后打开：

```text
http://localhost:18789
```

对于第一次上手的用户，这已经是最短、最直接的启动路径。

`bootstrap.sh` 做的事情包括：

- 检查 `.env` 是否存在
- 检查关键值是否仍是占位符
- 执行 `scripts/init-data-dir.sh`
- 执行 `scripts/build-sandbox-image.sh`
- 执行 `docker compose build`
- 执行 `docker compose up -d openclaw-gateway`
- 打印访问地址与后续运维命令

### 11.1 前置要求

- macOS 或 Linux 主机
- Docker / Docker Desktop
- Docker Compose
- 可用的模型 API Key 或 OpenAI Compatible 接口

### 11.2 基础部署步骤

1. 复制环境变量模板

```bash
cp .env.example .env
```

2. 修改 `.env`

至少填写：

- `OPENCLAW_GATEWAY_TOKEN`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`

3. 初始化宿主机数据目录

```bash
chmod +x scripts/init-data-dir.sh scripts/build-sandbox-image.sh
./scripts/init-data-dir.sh
```

4. 构建 sandbox 镜像

```bash
./scripts/build-sandbox-image.sh
```

5. 构建并启动服务

```bash
docker compose build
docker compose up -d openclaw-gateway
```

6. 查看状态

```bash
docker compose ps
docker compose logs -f openclaw-gateway
docker compose run --rm openclaw-cli gateway status
```

---

## 12. 日常运维手册

### 12.0 容器模型说明

本项目运行后，用户通常会看到两类容器：

- `openclaw-gateway`
- `openclaw-sbx-*`

这里需要特别说明：

- `openclaw-gateway` 是主服务容器
- `openclaw-sbx-*` 是在 agent 需要执行 sandbox 任务时，由网关动态拉起的隔离容器

因此，出现两个容器通常不代表部署错了，而代表：

- 网关已经正常启动
- sandbox 机制已经开始工作

这是一种**运行时容器模型**，而不是在 Compose 里手动定义了两个业务服务。

换句话说：

- `docker compose ps` 看到的通常是主服务
- `docker ps` 额外看到的 `openclaw-sbx-*` 是运行时 sandbox 容器

如果用户对“为什么会多出一个容器”感到困惑，应该明确告诉他：

> 这个额外容器不是 bug，而是 OpenClaw 的 Docker sandbox 正在工作。

### 12.1 启动服务

```bash
docker compose up -d openclaw-gateway
```

### 12.2 停止服务

```bash
docker compose stop openclaw-gateway
```

### 12.3 重启服务

```bash
docker compose restart openclaw-gateway
```

### 12.4 查看日志

```bash
docker compose logs -f openclaw-gateway
```

### 12.5 查看网关状态

```bash
docker compose run --rm openclaw-cli gateway status
```

### 12.6 进入工具容器

```bash
docker compose --profile tools up -d openclaw-tools
docker compose exec openclaw-tools bash
```

### 12.7 备份关键数据

建议备份以下目录：

```bash
/Users/awk/lqf/openclaw_data/openclaw
/Users/awk/lqf/openclaw_data/cache
/Users/awk/lqf/openclaw_data/logs
```

重点文件包括：

- `openclaw.json`
- `devices/paired.json`
- `tasks/runs.sqlite`
- `workspace/`

---

## 13. 首次访问与配对说明

首次通过浏览器访问 Control UI 时，常见会经历两步：

1. 提供 `gateway token`
2. 完成设备配对（pairing）

这是正常的安全机制，不代表服务异常。

如果看到：

- `unauthorized: gateway token missing`
- `pairing required`

说明认证流程尚未完成。

---

## 14. 常见问题与排障

### 14.1 `permission denied while trying to connect to the docker API`

原因：容器内用户无权访问 Docker socket。

本项目当前方案：

- 挂载 `/var/run/docker.sock`
- 给服务补充 `group_add: ["0"]`

### 14.2 `mounts denied: path is not shared from the host`

原因：Docker Desktop 只认宿主机共享路径，不认容器内路径再转挂载。

本项目解决方案：

- 使用宿主机绝对路径作为 `workspace` / `agentDir` / `workspaceRoot`
- 将宿主机数据根目录原样挂入运行容器

### 14.3 页面显示 `pairing required`

原因：当前浏览器设备尚未完成配对。

处理方式：

- 使用 CLI 执行 pairing 相关操作
- 或在已有设备批准机制中放行该浏览器设备

### 14.4 模型接口可以 `/models` 成功，但聊天无响应

优先检查：

- `OPENAI_COMPATIBLE_BASE_URL` 是否正确
- `OPENAI_COMPATIBLE_API_KEY` 是否有效
- `models.providers.default.models[0].id` 是否与上游真实模型 ID 一致
- 网关日志是否有 provider 报错

---

## 15. 安全建议

开源前建议特别注意：

- **不要提交真实 `.env`**
- **不要提交真实 API Key / token / app secret**
- 保持 `.env.example` 只放占位符
- 如果曾将真实密钥写入仓库历史，发布前务必轮换密钥
- 若对外暴露局域网访问，请确认 `OPENCLAW_GATEWAY_TOKEN` 足够强

建议在 GitHub 仓库中明确说明：

- 本项目适合内网或受控环境
- 不建议直接裸露到公网
- 所有敏感配置均应通过 `.env` 管理

---

## 16. 为什么要开源这个项目

这个项目适合开源的原因在于：

- 它解决的是“如何把 OpenClaw 真正跑起来”的落地问题
- 它聚焦部署、运维、路径映射、sandbox、模型接入等实践细节
- 这些经验对第一次部署 OpenClaw 的用户很有价值
- 文档化以后，能够降低他人试错成本，也能提升项目可复用性

从开源视角看，它更像：

- 一个部署模板仓库
- 一个最佳实践仓库
- 一个面向本地 AI Agent 工作流的运维参考实现

---

## 17. 推荐的 GitHub 展示方式

建议仓库主页采用以下结构：

1. `README.md`：简洁展示项目定位、亮点和快速开始
2. `docs/open-source-manual.md`：完整手册
3. 后续可继续拆出：
   - `docs/architecture.md`
   - `docs/operations.md`
   - `docs/faq.md`

建议 README 首页重点强调：

- 这是一个 `OpenClaw` Docker 部署增强方案
- 已验证支持 Docker sandbox
- 支持 OpenAI Compatible 接入
- 支持多 agent 工作区隔离
- 提供宿主机可编辑配置与运维脚本

---

## 18. 后续演进建议

如果后续继续完善，可以考虑增加：

- 更标准的 `Makefile` 或任务脚本
- 自动化配对审批脚本
- 更细的 `docs/faq.md`
- `architecture.md` 架构独立文档
- 发布版 `CHANGELOG.md`
- `LICENSE`
- GitHub Actions 基础校验流程
- 面向 Linux 的路径与权限说明

---

## 19. 结语

`OpenClaw Docker` 的价值不在于“重新实现 OpenClaw”，而在于把 `OpenClaw` 从一个“需要自己拼装才能跑”的组件，整理成一套更容易部署、理解、维护和分享的实践方案。

如果你正在寻找一个：

- 适合本机部署的 OpenClaw 方案
- 能跑 sandbox 的 Docker 化实践
- 宿主机配置清晰、目录清晰、排障路径明确的模板仓库

那么这个项目就是为此而构建的。
