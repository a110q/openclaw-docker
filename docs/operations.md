# OpenClaw Docker 运维操作手册

> 这份文档专门回答三个问题：怎么部署、怎么改配置、改完之后该执行什么。  
> 如果你想先看项目总览，请先读 `README.md` 和 `docs/open-source-manual.md`。

## 1. 部署前准备

### 1.1 安装并启动 Docker

建议环境：

- `macOS`：`Docker Desktop`
- `Windows`：`Docker Desktop`
- `Linux`：`Docker Engine + Docker Compose`

先确认 Docker 已正常运行：

```bash
docker --version
docker compose version
```

### 1.2 准备关键参数

首次部署至少要准备这些值：

- `OPENCLAW_HOST_DATA_ROOT`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `OPENCLAW_RUN_USER`
- `OPENCLAW_ADMIN_UI_TOKEN`

辅助命令：

```bash
# 生成随机 token
openssl rand -hex 24

# 查看当前 UID / GID
id -u
id -g
```

推荐路径示例：

- `macOS`：`/Users/yourname/openclaw_data`
- `Linux`：`/home/yourname/openclaw_data`
- `Windows`：`C:/Users/yourname/openclaw_data`

## 2. 首次部署

### 2.1 复制 `.env`

```bash
cp .env.example .env
```

重点先改：

- `OPENCLAW_HOST_DATA_ROOT`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `OPENCLAW_RUN_USER`
- `OPENCLAW_ADMIN_UI_TOKEN`

### 2.2 一键部署 Gateway

```bash
chmod +x bootstrap.sh
./bootstrap.sh
```

`bootstrap.sh` 会自动完成：

1. 校验 `.env`
2. 初始化宿主机目录
3. 构建 sandbox 镜像
4. 构建运行镜像
5. 启动 `openclaw-gateway`

注意：**这个脚本默认只启动 `openclaw-gateway`，不会自动启动 `openclaw-admin-ui`。**

完成后先访问：

```text
Gateway / Control UI: http://localhost:18789
```

### 2.3 启动 Admin UI

如果你需要运维后台，执行：

```bash
./scripts/reload-admin-ui.sh
```

或使用等价命令：

```bash
docker compose up -d --build --no-deps openclaw-admin-ui
```

后台地址：

```text
Admin UI: http://localhost:18889/login
```

### 2.4 分步部署

如果你希望手工分步执行：

```bash
cp .env.example .env
chmod +x bootstrap.sh scripts/init-data-dir.sh scripts/build-sandbox-image.sh
./scripts/init-data-dir.sh
./scripts/build-sandbox-image.sh
docker compose build
docker compose up -d openclaw-gateway
./scripts/reload-admin-ui.sh
```

检查状态：

```bash
docker compose ps
docker compose logs -f openclaw-gateway
docker compose run --rm openclaw-cli gateway status
```

## 3. 配置边界

这是这个项目最重要的心智模型。

### 3.1 `.env` 是部署层配置

`.env` 主要负责：

- 端口
- 宿主机路径
- token
- API Key
- 代理参数
- sandbox 网络参数
- Admin UI 运行参数
- Control UI overlay 构建参数

### 3.2 `openclaw.json` 是运行时配置

真实运行配置文件在：

```text
<OPENCLAW_HOST_DATA_ROOT>/openclaw/openclaw.json
```

它由 `config/openclaw.json.example` 初始化生成，主要负责：

- `gateway.controlUi`
- `models.providers`
- `agents.defaults`
- `agents.list`
- `channels.feishu`
- `bindings`
- `plugins`

### 3.3 `scripts/init-data-dir.sh` 做什么

这个脚本主要有两类职责：

1. 当宿主机还没有 `openclaw.json` 时，基于模板初始化
2. 每次重载前，同步这些稳定运行参数：
   - `OPENCLAW_SANDBOX_NETWORK`
   - `OPENCLAW_SANDBOX_EXTRA_HOST`
   - 目录结构与基础工作区

注意：**代理是否最终生效，不是这个脚本直接决定的。**

真正的代理决策发生在网关容器启动时，由：

- `scripts/openclaw-network-entrypoint.sh`
- `scripts/resolve-network-policy.mjs`

共同完成。

## 4. 登录与认证

### 4.1 Gateway / Control UI

浏览器打开：

```text
http://localhost:18789
```

常见填写项：

- `WebSocket URL`：`ws://localhost:18789`
- `Gateway Token`：来自 `.env` 的 `OPENCLAW_GATEWAY_TOKEN`
- `Password`：当前项目默认留空

查看 token：

```bash
grep '^OPENCLAW_GATEWAY_TOKEN=' .env
```

### 4.2 模式 A：`token + pairing`

默认更安全，适合多人或局域网环境。

如果浏览器第一次进入时看到 `pairing required`，说明当前设备还没有通过审批。

### 4.3 第一台管理员浏览器引导

如果当前还没有任何已配对浏览器，可执行：

```bash
./scripts/bootstrap-first-control-ui-admin.sh
```

如需延长等待时间：

```bash
./scripts/bootstrap-first-control-ui-admin.sh --timeout 300
```

推荐顺序：

1. 启动 `openclaw-gateway`
2. 在终端执行引导脚本
3. 浏览器打开 `http://localhost:18789`
4. 输入 `Gateway Token`
5. 点击 `Connect`

### 4.4 模式 B：仅 `token`

如果你是单机、自用、受控环境，可以在：

```text
<OPENCLAW_HOST_DATA_ROOT>/openclaw/openclaw.json
```

中打开：

```json
"controlUi": {
  "allowedOrigins": [
    "http://localhost:18789",
    "http://127.0.0.1:18789"
  ],
  "dangerouslyDisableDeviceAuth": true
}
```

然后重载 Gateway：

```bash
./scripts/reload-gateway.sh
```

### 4.5 Admin UI 登录

如果后台尚未启动，先执行：

```bash
./scripts/reload-admin-ui.sh
```

然后访问：

```text
http://localhost:18889/login
```

查看后台令牌：

```bash
grep '^OPENCLAW_ADMIN_UI_TOKEN=' .env
```

## 5. 宿主机代理 / 科学上网

### 5.1 为什么容器不能直接用 `127.0.0.1:7890`

如果宿主机代理监听在 `127.0.0.1:7890`：

- 宿主机访问 `127.0.0.1:7890`，访问的是宿主机自己
- 容器访问 `127.0.0.1:7890`，访问的是容器自己

所以容器里必须改成：

```text
host.docker.internal:7890
```

### 5.2 推荐代理配置

把下面内容写进 `.env`：

```bash
OPENCLAW_SANDBOX_NETWORK=bridge
OPENCLAW_SANDBOX_EXTRA_HOST=host.docker.internal:host-gateway
OPENCLAW_PROXY_MODE=auto
OPENCLAW_PROXY_PROBE_TIMEOUT_MS=1500
HTTP_PROXY=http://host.docker.internal:7890
HTTPS_PROXY=http://host.docker.internal:7890
ALL_PROXY=
NO_PROXY=localhost,127.0.0.1,host.docker.internal
```

说明：

- `OPENCLAW_SANDBOX_NETWORK=bridge`：让 sandbox 可以联网
- `OPENCLAW_SANDBOX_EXTRA_HOST=host.docker.internal:host-gateway`：让容器稳定访问宿主机
- `OPENCLAW_PROXY_MODE=auto`：代理可用就走代理，不可用就自动回退直连
- `OPENCLAW_PROXY_MODE=proxy_only`：代理不可达时直接报错
- `OPENCLAW_PROXY_MODE=direct`：完全忽略代理配置
- `ALL_PROXY`：只有在你确认本地有 `SOCKS5` 代理端口时才填写

### 5.3 让代理配置生效

执行：

```bash
./scripts/reload-gateway.sh
```

这个脚本会先同步宿主机配置，再强制重建网关容器。

### 5.4 验证代理是否生效

```bash
# 看网关启动时的网络策略决策
docker compose logs --tail=80 openclaw-gateway | grep 'proxy-policy'

# 看当前最终生效的策略快照
cat <OPENCLAW_HOST_DATA_ROOT>/openclaw/admin-ui/network-policy.json

# 看 sandbox 当前运行配置
jq '.agents.defaults.sandbox.docker' <OPENCLAW_HOST_DATA_ROOT>/openclaw/openclaw.json
```

至少应该确认：

- `network` 已变成 `bridge`
- `extraHosts` 中有 `host.docker.internal:host-gateway`
- `network-policy.json` 中有 `mode` / `decision` / `reason`
- 代理可用时，`openclaw.json` 的 sandbox `env` 中会出现 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`
- 代理不可用且 `OPENCLAW_PROXY_MODE=auto` 时，`decision` 会变成 `direct`

## 6. Control UI 中文 / 双语 overlay

当前镜像会在构建阶段向 Control UI 注入一个 locale + terminology overlay，用来实现：

- 默认简体中文
- 右下角浮动 `语言` / `显示` 切换器
- `zh-only` / `zh-en` / `en-only` 三种模式
- 菜单、字段标题、帮助文案、枚举值的双语显示
- 中文关键词对当前设置页的本地搜索过滤
- 浏览器侧保存语言与显示模式

相关变量：

```bash
OPENCLAW_CONTROL_UI_DEFAULT_LOCALE=zh-CN
OPENCLAW_CONTROL_UI_FORCE_LOCALE=
OPENCLAW_CONTROL_UI_ENABLED_LOCALES=auto,zh-CN,zh-TW,en
OPENCLAW_CONTROL_UI_SHOW_LOCALE_SWITCHER=true
OPENCLAW_CONTROL_UI_TEXT_MODE_DEFAULT=zh-en
OPENCLAW_CONTROL_UI_ENABLED_TEXT_MODES=zh-only,zh-en,en-only
```

注意：这些是 **build-time** 配置。改完后执行：

```bash
docker compose build
docker compose up -d --force-recreate openclaw-gateway
```

如果只是临时切换当前页面语言或显示模式，直接用页面右下角控件即可，不需要重建镜像。

## 7. 模型 / Provider / Agent 管理

### 7.1 Provider 配置原则

当前示例配置支持：

- `default`：OpenAI-compatible
- `claude`
- `gemini`
- `ollama`

模型统一按下面格式引用：

```text
provider/model
```

例如：

```text
default/gpt-5.4
claude/claude-sonnet-4-5
gemini/gemini-2.5-pro
ollama/qwen2.5-coder:latest
```

### 7.2 推荐的修改入口

你可以通过这两种方式维护模型与 Agent：

- `Admin UI`
- `openclaw.json`

典型修改包括：

- 新增 Provider
- 调整默认模型
- 为不同 Agent 绑定不同模型
- 新增 / 删除 / 纳管 Agent

### 7.3 默认模型建议

当前项目推荐：

- **不要把 `default/glm-*` 设为系统默认 Agent 模型**

更稳妥的方式是：

- 默认模型使用更稳定的主 Provider
- `GLM` 只在单独 Agent 上按需使用

### 7.4 Agent 数据目录、导入导出与平台迁移

后台现在支持 Agent 存储目录配置，推荐始终使用：

- `OPENCLAW_HOST_DATA_ROOT` 下的相对路径
- 不要写绝对路径
- 不要写 `..`

默认值：

- `openclaw/workspace/agents`
- `openclaw/agents`

你可以在：

```text
http://localhost:18889/settings
```

里修改这两个目录。保存后：

- 新建 Agent
- 批量创建 Agent
- 自动扫描导入
- Agent 包导入

都会按新的目录规则落盘。

注意：**既有 Agent 不会因为你改了目录设置就自动迁移。** 现有 Agent 仍按 `openclaw.json` 里已经写死的绝对路径运行。

`/agents` 页支持：

- 导出选中的 Agent 包
- 导入 Agent 包

`Agent 包` 内含：

- Agent 配置片段
- Admin UI 元数据
- 绑定关系
- 相关飞书群配置 / 私聊白名单
- `workspace` / `agent` 目录内容

`/settings` 页支持：

- 生成平台迁移包
- 下载最近的迁移包

平台迁移包生成后，目标环境执行：

```bash
tar -xzf openclaw-platform-*.tar.gz
cd 解压目录
./bootstrap-migrate.sh /path/to/new-openclaw-data-root
```

脚本会自动：

- 复制宿主机数据
- 把旧环境绝对路径改成新宿主机根目录
- 执行 `docker compose up -d --build`

## 8. 配置修改后的正确操作

这是日常运维最重要的一张对照表。

### 8.1 改 `.env` 里的路径 / 代理 / sandbox 网络

例如：

- `OPENCLAW_HOST_DATA_ROOT`
- `OPENCLAW_SANDBOX_NETWORK`
- `OPENCLAW_SANDBOX_EXTRA_HOST`
- `OPENCLAW_PROXY_MODE`
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `ALL_PROXY`
- `NO_PROXY`

执行：

```bash
./scripts/reload-gateway.sh
```

### 8.2 改 `.env` 里的运行时鉴权 / 模型变量

例如：

- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `OPENCLAW_GATEWAY_TOKEN`

执行：

```bash
./scripts/reload-gateway.sh
```

### 8.3 改 `openclaw.json`

例如：

- `agents`
- `bindings`
- `channels.feishu`
- `gateway.controlUi`
- `models.providers`

执行：

```bash
./scripts/reload-gateway.sh
```

### 8.4 改后台里的 Agent 数据目录设置

例如在后台设置页里修改：

- `Workspace 根目录`
- `Agent 配置根目录`

这类配置写入的是后台元数据，**不需要重启容器**。保存后新创建 / 新导入 / 新扫描的 Agent 会立即按新目录规则落盘。

### 8.5 改 `OPENCLAW_ADMIN_UI_TOKEN` 或后台页面代码

例如：

- `OPENCLAW_ADMIN_UI_TOKEN`
- `OPENCLAW_ADMIN_UI_PORT`
- `apps/admin-ui/*`

执行：

```bash
./scripts/reload-admin-ui.sh
```

### 8.6 改 Dockerfile / overlay / 构建脚本

例如：

- `Dockerfile`
- `docker-compose.yml`
- `scripts/render-control-ui-locale-overlay.mjs`
- `overlays/*`

执行：

```bash
docker compose build
docker compose up -d --force-recreate openclaw-gateway openclaw-admin-ui
```

## 9. 日常运维

### 9.1 服务管理

```bash
# 启动 Gateway
docker compose up -d openclaw-gateway

# 停止 Gateway
docker compose stop openclaw-gateway

# 重启 Gateway
docker compose restart openclaw-gateway

# 启动 / 重建 Admin UI
docker compose up -d --build --no-deps openclaw-admin-ui

# 停止 Admin UI
docker compose stop openclaw-admin-ui

# 关闭整个项目
docker compose down
```

### 9.2 查看状态和日志

```bash
docker compose ps
docker compose run --rm openclaw-cli gateway status
docker compose logs -f openclaw-gateway
docker compose logs -f openclaw-admin-ui
docker compose logs --tail=100 openclaw-gateway
```

### 9.3 健康检查

```bash
curl http://127.0.0.1:18789/healthz
```

### 9.4 Agent 导入导出与平台迁移

```bash
# 迁移包会落在宿主机 Admin UI 数据目录
ls <OPENCLAW_HOST_DATA_ROOT>/openclaw/admin-ui/migration-exports

# 目标环境执行平台迁移脚本
tar -xzf openclaw-platform-*.tar.gz
cd 解压目录
./bootstrap-migrate.sh /path/to/new-openclaw-data-root
```

### 9.5 使用调试容器

```bash
docker compose --profile tools up -d openclaw-tools
docker compose exec openclaw-tools bash
```

## 10. 宿主机能力与飞书运维

### 10.1 为什么不直接取消 sandbox

这个项目的设计不是“取消 sandbox”，而是：

- 任务执行尽量继续留在 sandbox
- 需要宿主机动作时，再通过受控能力桥接出去

这样既保留隔离边界，也不牺牲运维能力。

### 10.2 安装宿主机能力插件

执行：

```bash
./scripts/install-host-ops-plugin.sh
```

这个脚本会：

- 把 `plugins/openclaw-host-ops` 同步到宿主机数据目录
- 更新 `openclaw.json` 的插件加载路径
- 启用 `host-ops`
- 重启 `openclaw-gateway`

### 10.3 当前宿主机能力

当前插件会暴露这些宿主机工具：

- `host_service_control`
- `host_provider_admin`
- `host_agent_admin`
- `host_feishu_admin`

这几类能力分别覆盖：

- 服务状态 / 日志 / 重启
- Provider 和模型配置
- Agent 列表、创建、删除
- 飞书配置读取、写入与绑定管理

## 11. 常用入口汇总

- 项目入口：`README.md`
- 总览说明：`docs/open-source-manual.md`
- FAQ：`docs/faq.md`
- Gateway：`http://localhost:18789`
- Admin UI：`http://localhost:18889/login`

如果你只记一个动作，请记这个：

> **改模型、改 API Key、改 Agent / bindings / 飞书配置后，优先执行 `./scripts/reload-gateway.sh`；只改后台页面或后台令牌时，执行 `./scripts/reload-admin-ui.sh`。**
