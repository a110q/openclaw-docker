import { PlatformShell } from '@/components/platform/platform-shell';
import { createPrivateProviderAction } from '@/lib/server/platform-actions';
import { listPlatformProviders, listSharedRuntimeModels } from '@/lib/server/platform-repo';
import { requirePlatformUser } from '@/lib/server/platform-session';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ModelsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePlatformUser();
  const [providers, sharedModels] = await Promise.all([
    listPlatformProviders(user.id),
    listSharedRuntimeModels(),
  ]);
  const resolved = await searchParams;
  const error = typeof resolved.error === 'string' ? decodeURIComponent(resolved.error) : '';

  return (
    <PlatformShell
      currentPath="/models"
      title="我的模型"
      description="这里管理你自己的模型接入和可绑定模型。平台公共底座与系统运行配置由管理员独立维护，不直接暴露给普通用户。"
      user={user}
    >
      <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form action={createPrivateProviderAction} className="surface-panel space-y-4 px-5 py-5 md:px-6">
          <div>
            <div className="page-eyebrow">Private Provider</div>
            <h2 className="mt-2 text-[1.42rem] font-semibold tracking-tight text-slate-900">录入我的模型</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">支持 `OpenAI-compatible / Anthropic / Gemini / Ollama`。保存后会进入你的模型清单，并供你的龙虾单独绑定。</p>
          </div>

          <label className="block">
            <span className="field-label">名称</span>
            <input name="name" className="field" placeholder="例如：我的 Codex 5.4" />
          </label>
          <label className="block">
            <span className="field-label">类型</span>
            <select name="type" defaultValue="openai-compatible" className="field">
              <option value="openai-compatible">OpenAI-compatible</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
              <option value="ollama">Ollama</option>
            </select>
          </label>
          <label className="block">
            <span className="field-label">Base URL</span>
            <input name="baseUrl" className="field" placeholder="http://127.0.0.1:8327/v1" />
          </label>
          <label className="block">
            <span className="field-label">API Key</span>
            <input name="apiKey" type="password" className="field" placeholder="如果该 Provider 不需要可留空（Ollama）" />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="field-label">模型 ID</span>
              <input name="modelId" className="field" placeholder="例如：gpt-5.4 / glm-5" />
            </label>
            <label className="block">
              <span className="field-label">模型名称</span>
              <input name="modelName" className="field" placeholder="用于页面展示" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input name="isDefault" type="checkbox" />
            保存为我的默认私有模型
          </label>

          {error ? <div className="notice-error">{error}</div> : null}

          <button type="submit" className="btn-primary w-full justify-center">保存到我的模型清单</button>
        </form>

        <section className="space-y-4">
          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="page-eyebrow">My Providers</div>
                <h2 className="mt-2 text-[1.42rem] font-semibold tracking-tight text-slate-900">我的私有模型入口</h2>
              </div>
              <span className="pill-badge">{providers.length} 个</span>
            </div>

            <div className="mt-5 space-y-3">
              {providers.map((provider) => (
                <div key={provider.id} className="list-row">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{provider.name}</div>
                        {provider.isDefault ? <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">默认</span> : null}
                        <span className="pill-badge">{provider.syncStatus === 'synced' ? '可绑定' : provider.syncStatus === 'failed' ? '同步失败' : '待同步'}</span>
                      </div>
                      <div className="mt-2 text-[13px] leading-6 text-slate-600">{provider.type} · {provider.baseUrl}</div>
                      <div className="mt-1 text-xs text-slate-500">模型引用：{provider.runtimeModelRef} · Key：{provider.apiKeyMasked || '未显示'}</div>
                    </div>
                  </div>
                  {provider.syncError ? <div className="mt-3 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{provider.syncError}</div> : null}
                </div>
              ))}
              {!providers.length ? (
                <div className="surface-soft px-4 py-5 text-[13px] leading-6 text-slate-600">
                  还没有私有模型入口。保存后，它会生成一个仅供你自己的龙虾绑定使用的模型引用。
                </div>
              ) : null}
            </div>
          </div>

          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="page-eyebrow">Shared Catalog</div>
            <h2 className="mt-2 text-[1.42rem] font-semibold tracking-tight text-slate-900">平台可用模型</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">这些是平台已经准备好的共享模型，你的龙虾也可以直接绑定使用。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {sharedModels.slice(0, 8).map((model) => (
                <div key={model.id} className="surface-soft px-4 py-4">
                  <div className="break-all text-sm font-semibold text-slate-900">{model.label}</div>
                  <div className="mt-1 break-all text-xs text-slate-500">{model.id}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </PlatformShell>
  );
}
