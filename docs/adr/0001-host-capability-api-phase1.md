# ADR-0001：保留 sandbox，并通过 Host Capability API 暴露宿主机能力

- 状态：Accepted
- 日期：2026-04-09
- 关联设计：`docs/plans/2026-04-09-sandbox-host-capability-design.md`

## 背景

当前部署里同时存在两类动作：

1. **sandbox 内动作**：适合运行 Agent、处理工作区文件、执行受限命令。
2. **宿主机动作**：例如改 Provider、写飞书通道、读取 Compose 状态、强制重建 `openclaw-gateway`。

如果让 Agent 直接拿到宿主机 Docker Socket、任意 Shell 或任意文件写权限，虽然“能做的事更多”，但会同时失去：

- 隔离边界
- 可审计性
- 高风险动作确认机制
- 最小权限原则

用户在真实使用中最常见的痛点不是“sandbox 没意义”，而是：**Agent 知道要做什么，但缺一条安全、正式的宿主机执行通道。**

## 决策

保留 sandbox，不做“任意宿主机执行”。

新增一层 **Host Capability API**，用白名单能力把常见宿主机运维动作参数化暴露出来，所有能力都走统一的：

- `catalog`：列出能力目录
- `preview`：先预览影响
- `execute`：再执行能力
- `task/activity`：记录执行轨迹与审计日志

高风险能力默认必须确认后才能执行。

## Phase 1 能力范围

### 只读

- `host.compose.ps`
- `host.compose.logs`

### 写入

- `host.provider.upsert`
- `host.alert.feishu.upsert`

### 高风险

- `host.service.recreateGateway`

## 为什么不取消 sandbox

保留 sandbox 仍然有明确价值：

- 防止 Agent 直接接触宿主机 Docker、凭据和敏感目录
- 让“工作区级任务”和“宿主机级动作”边界更清晰
- 出问题时可以追踪是 sandbox 内逻辑，还是宿主机配置变更
- 新增能力时可以按白名单逐步开放，而不是一次性放权

因此 Phase 1 的目标不是“让 Agent 拿到 root-like 权限”，而是：

- 让高频宿主机动作有正式通道
- 让高风险操作有确认与审计
- 让 Agent 以后少走“我在 sandbox 里做不到”的失败路径

## 结果

在 `apps/admin-ui` 中新增：

- Host Capability registry
- `preview` / `execute` schema
- execute dispatcher
- `/api/admin/v1/host-capabilities*` 路由
- 后台页面 `/capabilities`

未来如果仍有新的“宿主机侧做不到”场景，优先策略是：

1. 识别是否属于宿主机动作
2. 为该动作增加新的白名单 capability
3. 接入 `preview + confirm + audit`

而不是直接取消 sandbox 或暴露通用 `host.exec`。
