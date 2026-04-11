# OpenClaw Docker 总览手册

> 这份文档是导航页，只回答四个问题：这个项目是什么、仓库里有什么、关键设计怎么理解、下一步该看哪里。

## 1. 项目是什么

`OpenClaw Docker` 是一套围绕官方 `OpenClaw` 运行时镜像构建的本机 / 局域网部署与运维方案。

它重点解决这些真实落地问题：

- `Docker sandbox` 的稳定落地
- 宿主机可编辑 `openclaw.json`
- 多 Agent 工作区隔离
- `OpenAI-compatible` / 多 Provider 接入
- 宿主机代理透传到容器与 sandbox
- `Control UI` 中文 / 双语 overlay
- 独立 `Admin UI` 运维后台
- 在保留 sandbox 的前提下补充宿主机能力桥

这个仓库不是 `OpenClaw` 核心源码，而是部署、运维和增强层。

## 2. 仓库里有什么

### 2.1 固定服务

当前 `docker-compose.yml` 中的主要服务有：

- `openclaw-gateway`
  - 主服务
  - 提供 Control UI、模型调度、Agent 生命周期和 sandbox 生命周期
- `openclaw-admin-ui`
  - 独立运维后台
  - 提供服务控制、模型配置、Agent 纳管、飞书通道管理和运行状态查看
- `openclaw-cli`
  - 辅助 CLI 容器
  - 用于状态检查、配对相关命令和临时排障
- `openclaw-tools`
  - 可选调试容器
  - 通过 `tools` profile 启动

### 2.2 动态容器

当 Agent 需要在隔离环境执行任务时，系统会按需创建：

- `openclaw-sbx-*`

这是正常行为，不是重复部署。

### 2.3 宿主机数据根目录

关键状态统一落在：

```text
<OPENCLAW_HOST_DATA_ROOT>
```

典型内容包括：

- `openclaw/openclaw.json`
- `openclaw/workspace/agents/*`（默认，可在后台改成其他相对目录）
- `openclaw/workspace/sandbox`
- `openclaw/agents/*/agent`（默认，可在后台改成其他相对目录）
- `openclaw/admin-ui/*`
- `cache`
- `logs`

## 3. 项目的关键心智模型

### 3.1 `.env` 不是运行时热更新配置

`.env` 是部署层参数来源，不等于改完自动生效。

大多数关键修改后，都需要：

```bash
./scripts/reload-gateway.sh
```

如果只改后台相关配置，则执行：

```bash
./scripts/reload-admin-ui.sh
```

### 3.2 `openclaw.json` 才是 Gateway 真实运行配置

当前真正生效的配置文件通常是：

```text
<OPENCLAW_HOST_DATA_ROOT>/openclaw/openclaw.json
```

仓库里的 `config/openclaw.json.example` 只是初始化模板。

### 3.3 sandbox 和宿主机能力不是二选一

这个项目不是通过“取消 sandbox”来换取能力，而是采用：

- sandbox 继续负责隔离、安全边界和工作区权限
- 宿主机能力插件负责执行 Docker、Provider 管理、Agent 管理、飞书接入等宿主机动作

### 3.4 代理是“可选使用 + 自动回退”

默认推荐：

- 有宿主机代理就优先使用
- 代理不可用时自动回退直连
- 不因为代理配置存在就让服务整体不可用

这由 `OPENCLAW_PROXY_MODE=auto` 驱动。

### 3.5 中文化方案是 overlay，不是硬改上游源码

当前中文界面是通过构建期注入 overlay 实现：

- 中文优先
- 英文共存
- 尽量不破坏上游升级路径

因此深层页面偶尔残留英文，是当前方案的已知边界。

### 3.6 Agent 存储目录是“相对宿主根目录的可迁移配置”

当前后台允许修改 Agent 存储目录，但设计原则不是随便填绝对路径，而是：

- 只允许 `OPENCLAW_HOST_DATA_ROOT` 下的相对路径
- 这样 Docker 挂载稳定
- 这样平台迁移包也更容易落地到另一台机器

默认目录仍然是：

- `openclaw/workspace/agents`
- `openclaw/agents`

既有 Agent 保留原有绝对路径；新的创建、导入、扫描结果才会使用新的目录规则。

## 4. 仓库目录怎么理解

```text
.
├── apps/
│   └── admin-ui/                 # 独立运维后台
├── config/
│   └── openclaw.json.example     # 运行时配置模板
├── docs/
│   ├── open-source-manual.md     # 当前文档
│   ├── operations.md             # 运维操作手册
│   └── faq.md                    # 常见问题
├── overlays/                     # Control UI 中文 / 双语 overlay 资源
├── plugins/
│   └── openclaw-host-ops/        # 宿主机能力插件
├── scripts/                      # 初始化、重载、网络策略与辅助脚本
├── .env.example                  # 环境变量模板
├── bootstrap.sh                  # 一键部署入口
├── docker-compose.yml            # 服务编排
└── README.md                     # 项目入口文档
```

## 5. 最常用的四个命令

```bash
# 1. 首次部署 Gateway
./bootstrap.sh

# 2. 重载 Gateway
./scripts/reload-gateway.sh

# 3. 启动 / 重载 Admin UI
./scripts/reload-admin-ui.sh

# 4. 查看状态
docker compose ps
docker compose logs -f openclaw-gateway
docker compose run --rm openclaw-cli gateway status
```

## 6. 文档怎么读

### 6.1 先看哪里

如果你是第一次接触这个仓库，推荐顺序：

1. `README.md`
2. `docs/operations.md`
3. `docs/faq.md`

### 6.2 遇到问题看哪里

- 想快速部署：看 `README.md`
- 想知道改配置后该执行什么：看 `docs/operations.md`
- 想排查问题：看 `docs/faq.md`

## 7. 一句话总结

如果你只记一个结论，请记这个：

> **这不是一个“改完配置自动热更新”的项目；改运行配置优先重载 Gateway，改后台优先重载 Admin UI。**
