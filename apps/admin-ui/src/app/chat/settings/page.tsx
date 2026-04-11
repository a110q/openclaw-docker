import { PlatformShell } from '@/components/platform/platform-shell';
import { PlatformCollabNav } from '@/components/platform/platform-collab-nav';
import { readPlatformSwarmOverview } from '@/lib/server/platform-clawswarm';
import { readPlatformClawSwarmRuntimeSnapshot } from '@/lib/server/platform-clawswarm-runtime';
import { requirePlatformUser } from '@/lib/server/platform-session';

function formatTime(value?: string) {
  if (!value) return '暂无';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export default async function ChatSettingsPage() {
  const user = await requirePlatformUser();
  const [overview, runtime] = await Promise.all([
    readPlatformSwarmOverview(user.id),
    readPlatformClawSwarmRuntimeSnapshot(),
  ]);
  const { preferences } = overview.settings;

  return (
    <PlatformShell
      currentPath="/chat"
      title="协作中心"
      description="协作设置当前分成两层：平台侧偏好继续由平台托管，ClawSwarm 运行时的认证、服务地址和安全提醒也在这里统一展示。"
      user={user}
    >
      <PlatformCollabNav currentPath="/chat/settings" service={overview.service} memberCount={overview.counts.totalMembers} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="page-eyebrow">Preferences</div>
            <h2 className="mt-2 text-[1.4rem] font-semibold tracking-tight text-slate-900">平台侧协作偏好</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="surface-soft px-4 py-4">
                <div className="text-[13px] font-medium text-slate-500">默认模式</div>
                <div className="mt-2 text-[1.1rem] font-semibold text-slate-900">{preferences.defaultMode}</div>
              </div>
              <div className="surface-soft px-4 py-4">
                <div className="text-[13px] font-medium text-slate-500">中间过程</div>
                <div className="mt-2 text-[1.1rem] font-semibold text-slate-900">{preferences.showIntermediateMessages ? '显示' : '隐藏'}</div>
              </div>
              <div className="surface-soft px-4 py-4">
                <div className="text-[13px] font-medium text-slate-500">任务联动</div>
                <div className="mt-2 text-[1.1rem] font-semibold text-slate-900">{preferences.autoOpenTasks ? '自动展开' : '手动'}</div>
              </div>
            </div>
          </div>

          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="page-eyebrow">Runtime Auth</div>
            <h2 className="mt-2 text-[1.3rem] font-semibold tracking-tight text-slate-900">ClawSwarm 运行时登录状态</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="surface-soft px-4 py-4">
                <div className="text-[13px] font-medium text-slate-500">认证状态</div>
                <div className="mt-2 text-[1.1rem] font-semibold text-slate-900">{runtime.auth.authenticated ? '已登录' : '未登录'}</div>
              </div>
              <div className="surface-soft px-4 py-4">
                <div className="text-[13px] font-medium text-slate-500">运行时账号</div>
                <div className="mt-2 text-[1.1rem] font-semibold text-slate-900">{runtime.auth.username || '未识别'}</div>
              </div>
              <div className="surface-soft px-4 py-4">
                <div className="text-[13px] font-medium text-slate-500">默认密码</div>
                <div className="mt-2 text-[1.1rem] font-semibold text-slate-900">{runtime.auth.usingDefaultPassword ? '仍在使用' : '已替换'}</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {runtime.auth.diagnostics.map((item) => (
                <div key={item} className="surface-soft px-4 py-4 text-[13px] leading-6 text-slate-600">{item}</div>
              ))}
            </div>
            {runtime.auth.usingDefaultPassword ? (
              <div className="notice-error mt-4">
                ClawSwarm 当前仍使用默认弱口令。建议你在 ClawSwarm 后台修改密码后，同步更新平台的 `OPENCLAW_CLAWSWARM_PASSWORD`，再重建 `openclaw-admin-ui`。
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="page-eyebrow">Runtime Endpoints</div>
            <h2 className="mt-2 text-[1.24rem] font-semibold tracking-tight text-slate-900">服务地址</h2>
            <div className="mt-4 space-y-3 text-[13px] leading-6 text-slate-600">
              <div className="surface-soft px-4 py-4">Public URL：{overview.service.publicUrl}</div>
              <div className="surface-soft px-4 py-4">Internal URL：{overview.service.internalUrl}</div>
              <div className="surface-soft px-4 py-4">Workspace 最近同步：{formatTime(overview.workspace.lastSyncAt)}</div>
            </div>
          </div>

          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="page-eyebrow">Phase Notes</div>
            <h2 className="mt-2 text-[1.24rem] font-semibold tracking-tight text-slate-900">为什么当前仍以只读为主</h2>
            <div className="mt-4 space-y-3 text-[13px] leading-6 text-slate-600">
              <div className="surface-soft px-4 py-4">当前阶段先把运行时认证、实例、会话和协作任务读面打通。</div>
              <div className="surface-soft px-4 py-4">下一阶段再开放 connect/sync、建群、发消息与任务管理写操作。</div>
              <div className="surface-soft px-4 py-4">平台侧仍然是唯一入口，用户不会直接跳到原始 ClawSwarm 后台。</div>
            </div>
          </div>
        </div>
      </section>
    </PlatformShell>
  );
}
