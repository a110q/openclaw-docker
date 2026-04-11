import Link from 'next/link';
import { redirect } from 'next/navigation';
import { platformLoginAction } from '@/lib/server/platform-actions';
import { getCurrentPlatformSession } from '@/lib/server/platform-session';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getCurrentPlatformSession();
  if (session) {
    redirect('/home');
  }

  const resolved = await searchParams;
  const error = typeof resolved.error === 'string' ? decodeURIComponent(resolved.error) : '';

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 md:px-6">
      <div className="grid w-full max-w-[1280px] gap-4 xl:grid-cols-[minmax(0,1.1fr)_440px]">
        <section className="surface-panel hidden p-6 xl:block xl:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="page-eyebrow">OpenClaw Workspace</div>
              <h1 className="mt-3 max-w-3xl text-[2.2rem] font-semibold leading-tight tracking-tight text-slate-900">
                登录后，你只会进入自己的龙虾工作台。
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate-600">
                普通用户登录后只管理自己的龙虾、模型和绑定关系；平台底层运维、飞书纳管、宿主机和服务控制由管理员在独立入口处理。
              </p>
            </div>
            <div className="pill-badge border-sky-200 bg-sky-50 text-sky-700">User Workspace</div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              ['我的龙虾', '查看默认龙虾，继续新增不同用途的个人龙虾。'],
              ['我的模型', '录入你自己的模型入口，并绑定到你的龙虾上。'],
              ['个人空间', '只显示与你自己的数据与配置有关的内容。'],
              ['管理员分离', '平台运维入口独立存在，不混入普通用户后台。'],
            ].map(([title, text]) => (
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
              <div className="page-eyebrow">User Login</div>
              <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-slate-900">登录我的空间</h2>
            </div>
            <span className="pill-badge">Workspace</span>
          </div>

          <p className="mt-3 text-[14px] leading-6 text-slate-600">登录后进入你的个人工作台，查看龙虾、模型绑定和运行状态。</p>

          <form className="mt-5 space-y-4" action={platformLoginAction}>
            <label className="block">
              <span className="field-label">邮箱</span>
              <input name="email" type="email" autoComplete="email" placeholder="you@example.com" className="field" />
            </label>
            <label className="block">
              <span className="field-label">密码</span>
              <input name="password" type="password" autoComplete="current-password" placeholder="请输入平台密码" className="field" />
            </label>

            {error ? <div className="notice-error">{error}</div> : null}

            <button type="submit" className="btn-primary w-full justify-center">进入我的空间</button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <Link href="/register" className="text-sky-700">还没有账号？去注册</Link>
            <Link href="/ops/login" className="text-slate-500">管理员入口</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
