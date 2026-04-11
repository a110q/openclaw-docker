import Link from 'next/link';
import { redirect } from 'next/navigation';
import { platformRegisterAction } from '@/lib/server/platform-actions';
import { getCurrentPlatformSession } from '@/lib/server/platform-session';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getCurrentPlatformSession();
  if (session) {
    redirect('/home');
  }

  const resolved = await searchParams;
  const error = typeof resolved.error === 'string' ? decodeURIComponent(resolved.error) : '';

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 md:px-6">
      <div className="grid w-full max-w-[1280px] gap-4 xl:grid-cols-[minmax(0,1.05fr)_460px]">
        <section className="surface-panel hidden p-6 xl:block xl:p-7">
          <div className="page-eyebrow">OpenClaw Signup</div>
          <h1 className="mt-3 max-w-3xl text-[2.16rem] font-semibold leading-tight tracking-tight text-slate-900">
            注册后，你将得到一个只属于自己的龙虾空间。
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate-600">
            注册成功后会自动创建个人工作台、默认龙虾，以及可继续扩展的模型绑定空间。平台运维和系统底座仍由管理员独立维护。
          </p>

          <div className="mt-5 grid gap-3">
            {[
              '默认龙虾会自动创建到你的个人空间。',
              '你可以继续新增更多龙虾并绑定不同模型。',
              '平台底层运维入口不会混入你的个人后台。',
            ].map((text) => (
              <div key={text} className="surface-soft px-4 py-4 text-[13px] leading-6 text-slate-600">
                {text}
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Create Account</div>
          <h2 className="mt-2 text-[1.7rem] font-semibold tracking-tight text-slate-900">注册我的空间</h2>
          <p className="mt-3 text-[14px] leading-6 text-slate-600">填写基础资料后，系统会自动帮你创建默认龙虾和个人工作台。</p>

          <form className="mt-5 space-y-4" action={platformRegisterAction}>
            <label className="block">
              <span className="field-label">昵称</span>
              <input name="displayName" type="text" placeholder="例如：小龙虾船长" className="field" />
            </label>
            <label className="block">
              <span className="field-label">邮箱</span>
              <input name="email" type="email" autoComplete="email" placeholder="you@example.com" className="field" />
            </label>
            <label className="block">
              <span className="field-label">密码</span>
              <input name="password" type="password" autoComplete="new-password" placeholder="至少 8 位" className="field" />
            </label>
            <label className="block">
              <span className="field-label">确认密码</span>
              <input name="confirmPassword" type="password" autoComplete="new-password" placeholder="再次输入密码" className="field" />
            </label>

            {error ? <div className="notice-error">{error}</div> : null}

            <button type="submit" className="btn-primary w-full justify-center">注册并进入我的空间</button>
          </form>

          <div className="mt-4 text-sm text-slate-600">
            已有账号？<Link href="/login" className="text-sky-700">去登录</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
