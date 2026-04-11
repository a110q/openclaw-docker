'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LOGIN_HIGHLIGHTS = [
  ['服务运行', '启动、停止、平滑重启与强制重建 Gateway'],
  ['模型路由', 'Provider、默认模型与 Agent 级别绑定统一管理'],
  ['飞书纳管', '自动扫描、活动消息、通道测试和在线编辑'],
  ['系统排障', '代理决策、配置自检、日志和宿主机能力集中查看']
] as const;

export default function OpsLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/v1/session/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? '登录失败，请检查后台令牌。');
      }

      router.push('/overview');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 md:px-6">
      <div className="grid w-full max-w-[1280px] gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <section className="surface-panel hidden p-6 xl:block xl:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="page-eyebrow">OpenClaw Ops</div>
              <h1 className="mt-3 max-w-3xl text-[2.2rem] font-semibold leading-tight tracking-tight text-slate-900">
                平台管理员从这里进入运维控制台。
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate-600">
                这一侧继续负责服务运行、Gateway 配置、模型目录、飞书纳管和宿主机能力，不与平台注册用户的工作台入口混在一起。
              </p>
            </div>
            <div className="pill-badge border-sky-200 bg-sky-50 text-sky-700">Ops Console</div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {LOGIN_HIGHLIGHTS.map(([title, text]) => (
              <div key={title} className="surface-soft px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <div className="mt-1 text-[13px] leading-6 text-slate-600">{text}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="page-eyebrow">Operator Access</div>
              <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-slate-900">登录运维台</h2>
            </div>
            <span className="pill-badge">Token</span>
          </div>

          <p className="mt-3 text-[14px] leading-6 text-slate-600">请输入 `.env` 中配置的 `OPENCLAW_ADMIN_UI_TOKEN`。登录成功后会跳转到运维总览页。</p>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="field-label">后台令牌</span>
              <input
                name="token"
                type="password"
                autoComplete="current-password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="请输入后台管理令牌"
                className="field"
              />
            </label>

            {error ? <div className="notice-error">{error}</div> : null}

            <button type="submit" disabled={loading || !token.trim()} className="btn-primary w-full justify-center">
              {loading ? '登录中…' : '进入运维台'}
            </button>
          </form>

          <div className="surface-soft mt-4 px-4 py-4 text-[13px] leading-6 text-slate-600">
            修改令牌后，需要执行 `docker compose up -d --force-recreate openclaw-admin-ui` 让后台重新载入环境变量。
          </div>
        </section>
      </div>
    </main>
  );
}
