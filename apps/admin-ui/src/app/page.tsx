import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentPlatformSession } from '@/lib/server/platform-session';

export default async function LandingPage() {
  const session = await getCurrentPlatformSession();
  if (session) {
    redirect('/home');
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-10 md:px-6">
      <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,1.18fr)_400px]">
        <section className="surface-panel p-6 md:p-7 xl:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="page-eyebrow">OpenClaw Platform</span>
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">用户空间与运维空间分离</span>
            <span className="pill-badge">一人一只龙虾</span>
          </div>

          <h1 className="mt-4 max-w-4xl text-[2.5rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[3.2rem]">
            给每个注册用户，一人一只属于自己的 OpenClaw 龙虾。
          </h1>
          <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-600">
            普通用户登录后进入的是自己的龙虾工作台，只管理自己的龙虾、模型和绑定关系。平台底层运维、Gateway、飞书告警和宿主机能力则由管理员在独立入口维护。
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ['个人空间', '普通用户只看到自己的龙虾与模型，不接触底层配置。'],
              ['模型自定义', '既能使用平台共享模型，也能录入自己的私有模型入口。'],
              ['运维隔离', '管理员控制台独立保留，不混入普通用户后台。'],
            ].map(([title, text]) => (
              <div key={title} className="surface-soft px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <div className="mt-1 text-[13px] leading-6 text-slate-600">{text}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="surface-panel p-5 md:p-6">
            <div className="page-eyebrow">User Access</div>
            <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-slate-900">普通用户入口</h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">注册或登录后，只进入你自己的龙虾工作台，不会直接看到平台运维页面。</p>
            <div className="mt-6 space-y-3">
              <Link href="/register" className="btn-primary w-full justify-center">注册我的空间</Link>
              <Link href="/login" className="btn-secondary w-full justify-center">已有账号，去登录</Link>
            </div>
          </div>

          <div className="surface-panel p-5 md:p-6">
            <div className="page-eyebrow">Admin Access</div>
            <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-slate-900">管理员运维入口</h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">平台管理员从独立入口进入运维台，负责服务控制、模型目录、Agent 纳管、飞书通道和宿主机能力。</p>
            <div className="mt-6">
              <Link href="/ops/login" className="btn-secondary w-full justify-center">进入管理员入口</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
