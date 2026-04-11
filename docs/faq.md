# OpenClaw Docker FAQ

> 这份文档只放高频问题和排障入口。部署流程请看 `docs/operations.md`，项目入口请看 `README.md`。

## 1. 为什么会看到 `openclaw-sbx-*` 容器？

这是 OpenClaw sandbox 正常工作的结果。

- `openclaw-gateway` 是主服务
- `openclaw-sbx-*` 是任务执行时动态拉起的隔离容器
- 它们不是重复部署，也不是异常

## 2. 为什么我执行了 `./bootstrap.sh`，但 `Admin UI` 打不开？

因为 `bootstrap.sh` 默认只启动：

- `openclaw-gateway`

它不会自动启动：

- `openclaw-admin-ui`

启动后台请执行：

```bash
./scripts/reload-admin-ui.sh
```

或：

```bash
docker compose up -d --build --no-deps openclaw-admin-ui
```

然后再访问：

```text
http://localhost:18889/login
```

## 3. 页面显示 `pairing required` 怎么办？

说明当前浏览器设备还没有完成配对。

处理方式：

- 如果已经有管理员设备，让管理员在已登录设备上审批
- 如果这是第一台管理员浏览器，执行：

```bash
./scripts/bootstrap-first-control-ui-admin.sh
```

## 4. 为什么宿主机能科学上网，但容器不行？

最常见原因是你把代理写成了：

```text
http://127.0.0.1:7890
```

对于容器来说，这指向的是容器自己，不是宿主机。

应该改成：

```text
http://host.docker.internal:7890
```

并确保：

- `.env` 中已设置 `OPENCLAW_SANDBOX_NETWORK=bridge`
- 已执行 `./scripts/reload-gateway.sh`
- 宿主机代理软件确实在对应端口监听

## 5. 为什么 sandbox 还是不能联网？

优先检查：

1. `openclaw.json` 里的 `agents.defaults.sandbox.docker.network` 是否为 `bridge`
2. `network-policy.json` 当前 `decision` 是不是 `direct`
3. 宿主机代理软件是否真的监听对应端口
4. 你是否只填了 `ALL_PROXY`，但宿主机实际只开了 HTTP 代理

快速检查：

```bash
jq '.agents.defaults.sandbox.docker' <OPENCLAW_HOST_DATA_ROOT>/openclaw/openclaw.json
cat <OPENCLAW_HOST_DATA_ROOT>/openclaw/admin-ui/network-policy.json
```

## 6. `LLM request failed: network connection error` 怎么排查？

优先按这个顺序看：

1. `OPENAI_COMPATIBLE_BASE_URL` 是否正确
2. `OPENAI_COMPATIBLE_API_KEY` 是否正确
3. 上游地址是否真的可访问
4. 代理当前是否走到了错误地址
5. 默认模型是否绑定到了异常 Provider / 模型组合

常用排查命令：

```bash
docker compose logs --tail=120 openclaw-gateway
curl http://127.0.0.1:18789/healthz
```

## 7. `/models` 能通，但聊天无响应，怎么查？

优先检查：

- `OPENAI_COMPATIBLE_BASE_URL` 是否正确
- `OPENAI_COMPATIBLE_API_KEY` 是否正确
- Provider 中的模型 ID 是否和上游真实模型 ID 一致
- 默认 Agent 模型是否绑定错了
- `openclaw-gateway` 日志中是否有 provider 报错

## 8. 为什么 `default/glm-*` 不建议作为默认 Agent 模型？

这是当前项目的一个运行经验总结。

常见现象包括：

- 模型列表看起来存在
- 某些页面可切换
- 但默认聊天会话不稳定、切换失败或回复异常

更稳妥的做法是：

- 默认模型使用主 Provider 上更稳定的模型
- `GLM` 仅在单独 Agent 上按需使用

## 9. 网关长时间停在 `starting`，是不是挂了？

不一定。

刚重启后的几十秒里看到 `starting` 往往是正常现象。建议按下面顺序排查：

```bash
docker compose ps openclaw-gateway
docker compose logs --tail=100 openclaw-gateway
curl http://127.0.0.1:18789/healthz
```

如果 `healthz` 能返回，通常说明主服务已经起来了。

## 10. 改了 `.env`，为什么感觉没生效？

因为改 `.env` 只是在宿主机上改了参数，不代表容器会自动重建。

按改动类型处理：

### 情况 A：改的是路径 / 代理 / sandbox 网络

执行：

```bash
./scripts/reload-gateway.sh
```

### 情况 B：改的是运行时 token / API Key / 上游模型地址

执行：

```bash
./scripts/reload-gateway.sh
```

### 情况 C：改的是前端 overlay / Dockerfile / 构建脚本

执行：

```bash
docker compose build
docker compose up -d --force-recreate openclaw-gateway openclaw-admin-ui
```

## 11. 改了 `openclaw.json`，要不要重建镜像？

通常不用重建镜像，只需要重载 Gateway：

```bash
./scripts/reload-gateway.sh
```

只有你改的是镜像构建内容时，才需要重新 `docker compose build`。

## 12. 改了 `OPENCLAW_ADMIN_UI_TOKEN`，为什么后台还用旧令牌？

因为后台容器没有自动重建。

执行：

```bash
./scripts/reload-admin-ui.sh
```

## 13. `permission denied while trying to connect to the docker API` 是什么原因？

通常是容器访问 Docker socket 权限不足。

当前项目已经做了这些处理：

- 挂载 `DOCKER_SOCKET_PATH`
- 给服务增加 `group_add: ["0"]`
- 在运行镜像中安装 Docker CLI 和 Compose plugin

如果你仍然遇到问题，优先检查宿主机 Docker socket 路径是否正确。

## 14. `mounts denied: path is not shared from the host` 怎么办？

这是 Docker Desktop 常见问题。

当前项目已经通过这些方式规避：

- `workspace`
- `agentDir`
- `workspaceRoot`

都使用宿主机绝对路径，并且 `OPENCLAW_HOST_DATA_ROOT` 以原路径挂入运行容器。

如果你自己改过这些路径，优先检查它们是否仍然是宿主机真实路径。

## 15. 为什么切到中文后，某些设置页里面还是英文？

因为当前采用的是 overlay 方案，不是直接改上游前端源码。

当前策略是：

- 中文优先
- 英文共存
- 尽量不破坏上游升级路径

所以某些深层菜单、动态生成内容或新版本上游新增字段，仍可能暂时显示英文。

## 16. 为什么我改了默认语言 / 显示模式配置，却没有生效？

因为这些变量是 **build-time** 配置：

- `OPENCLAW_CONTROL_UI_DEFAULT_LOCALE`
- `OPENCLAW_CONTROL_UI_FORCE_LOCALE`
- `OPENCLAW_CONTROL_UI_ENABLED_LOCALES`
- `OPENCLAW_CONTROL_UI_SHOW_LOCALE_SWITCHER`
- `OPENCLAW_CONTROL_UI_TEXT_MODE_DEFAULT`
- `OPENCLAW_CONTROL_UI_ENABLED_TEXT_MODES`

改完后执行：

```bash
docker compose build
docker compose up -d --force-recreate openclaw-gateway
```

## 17. 为什么中文搜索时没有上游自带的 `Clear search` 按钮？

因为中文搜索桥走的是 overlay 的本地过滤逻辑，不会把中文关键词同步回上游原生英文 search state。

当前清空方式：

- 直接清空输入框
- 在搜索框按 `Esc`

## 18. 为什么 Agent 还会说“我在 sandbox 里做不到”？要不要取消 sandbox？

不建议直接取消 sandbox。

因为这不是单纯的“能不能执行命令”问题，而是两层能力边界：

- sandbox 负责隔离与权限边界
- 宿主机能力负责执行 Docker、服务控制、Provider 配置、飞书接入这类宿主机动作

正确做法是保留 sandbox，再补上宿主机能力桥。

安装方式：

```bash
./scripts/install-host-ops-plugin.sh
```

## 19. 为什么我只是重建 `openclaw-admin-ui`，结果 `gateway` 也跟着动了？

推荐使用：

```bash
./scripts/reload-admin-ui.sh
```

它内部使用：

```bash
docker compose up -d --build --no-deps openclaw-admin-ui
```

这个命令会尽量避免把 `openclaw-gateway` 一起带起来。

如果你手工执行了不带 `--no-deps` 的命令，Compose 可能会顺带处理依赖服务。

## 20. 这些文档应该按什么顺序看？

建议顺序：

1. `README.md`
2. `docs/open-source-manual.md`
3. `docs/operations.md`
4. `docs/faq.md`

如果你已经部署成功，只是排障，优先看：

1. `docs/faq.md`
2. `docs/operations.md`
