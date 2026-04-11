import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { FeishuChannelManager } from '@/components/alerts/feishu-channel-manager';
import { FeishuDiscoveryPanel } from '@/components/alerts/feishu-discovery-panel';
import { listAlertChannels } from '@/lib/server/alerts';
import { readFeishuDiscoverySnapshot } from '@/lib/server/feishu-discovery';

export const dynamic = 'force-dynamic';

export default async function FeishuAlertsPage() {
  const [channels, discovery] = await Promise.all([listAlertChannels(), readFeishuDiscoverySnapshot()]);

  const playbook = [
    {
      title: '自动扫描',
      value: '20 秒轮询',
      hint: '编辑或保存时会自动暂停，避免覆盖 live 配置操作。'
    },
    {
      title: '活动消息',
      value: '活跃时加速滚动',
      hint: '最近 3 分钟有消息时会闪烁并提高滚动速度。'
    },
    {
      title: '纳管方式',
      value: '以自动发现为主',
      hint: '先从 live 配置扫描，再在右侧做通道测试、编辑和补录。'
    }
  ];

  return (
    <AppShell currentPath="/alerts/feishu" title="飞书告警" description="把飞书机器人发现、Webhook 纳管和在线编辑收进一张更紧凑的告警工作台。" badge="Feishu Ops">
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.22fr)_360px]">
        <div className="surface-panel overflow-hidden p-5 md:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div>
              <div className="page-eyebrow">Alerting Desk</div>
              <h2 className="mt-3 max-w-4xl text-[1.95rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.28rem]">
                飞书发现、活动消息、通道纳管，收进同一个告警工作区。
              </h2>
              <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
                这一页不再把信息拆得很散：自动扫描、活动消息、通道纳管和在线编辑全部放进同一个工作区，减少来回滚动和上下跳页。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">告警 Webhook：{channels.length}</span>
                <span className="pill-badge">机器人账号：{discovery.botAccounts}</span>
                <span className="pill-badge">群绑定：{discovery.groupBindings}</span>
                <span className="pill-badge">私聊绑定：{discovery.dmBindings}</span>
              </div>
            </div>

            <div className="space-y-3">
              {playbook.map((item) => (
                <div key={item.title} className="surface-soft px-4 py-4">
                  <div className="text-[12px] font-medium text-slate-500">{item.title}</div>
                  <div className="mt-2 text-[1.15rem] font-semibold tracking-tight text-slate-900">{item.value}</div>
                  <div className="mt-1 text-[13px] leading-6 text-slate-500">{item.hint}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatusCard title="告警 Webhook" value={String(channels.length)} hint="已纳管的飞书告警通道" tone={channels.length > 0 ? 'good' : 'default'} />
            <StatusCard title="机器人账号" value={String(discovery.botAccounts)} hint="自动从 live 配置扫描" tone={discovery.botAccounts > 0 ? 'good' : 'default'} />
            <StatusCard title="群绑定" value={String(discovery.groupBindings)} hint="群聊到 Agent 的通道映射" tone={discovery.groupBindings > 0 ? 'good' : 'default'} />
            <StatusCard title="私聊绑定" value={String(discovery.dmBindings)} hint={discovery.warnings > 0 ? `其中 ${discovery.warnings} 项需关注` : '当前未发现异常项'} tone={discovery.warnings > 0 ? 'warn' : discovery.dmBindings > 0 ? 'good' : 'default'} />
          </div>
        </div>

        <div className="surface-panel p-5">
          <div className="page-eyebrow">Ops Notes</div>
          <h2 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">使用建议</h2>
          <div className="mt-4 space-y-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">先扫描，再编辑</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">优先把 live 配置里已有的飞书通道自动发现出来，再做在线修订。</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">消息活跃时更快滚动</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">左侧活动消息流会根据最近是否有消息调整滚动速度，便于盯盘。</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">变更后仍无效怎么办</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">如果 live 配置已写入但网关未刷新，去“服务控制”页做平滑重启或强制重建。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.16fr)_400px] 2xl:items-start">
        <FeishuDiscoveryPanel initialSnapshot={discovery} />
        <FeishuChannelManager channels={channels} />
      </section>
    </AppShell>
  );
}
