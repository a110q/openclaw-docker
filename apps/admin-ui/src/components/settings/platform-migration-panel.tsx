"use client";

import { useState } from "react";
import type { MigrationExportSummary } from "@/lib/types/admin";

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

function triggerDownload(downloadPath: string) {
  const anchor = document.createElement("a");
  anchor.href = downloadPath;
  anchor.download = "";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function PlatformMigrationPanel({
  initialExports,
}: {
  initialExports: MigrationExportSummary[];
}) {
  const [exports, setExports] = useState(initialExports);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refreshExports() {
    const response = await fetch("/api/admin/v1/platform/export", { method: "GET" });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      data?: MigrationExportSummary[];
    };
    if (!response.ok || !payload.data) {
      throw new Error(payload.error || "刷新迁移包列表失败");
    }
    setExports(payload.data);
  }

  async function handleExport() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/v1/platform/export", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { downloadPath: string; fileName: string };
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "生成平台迁移包失败");
      }
      await refreshExports();
      triggerDownload(payload.data.downloadPath);
      setMessage("平台迁移包已生成，下载已开始。目标环境解压后执行 `./bootstrap-migrate.sh <新宿主数据根目录>` 即可。" );
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "生成平台迁移包失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface-panel p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="page-eyebrow">Platform Migration</div>
          <h2 className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-900">
            一键平台迁移包
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            为当前 Docker 部署导出自包含迁移包，包含部署骨架、`.env`、OpenClaw 配置、Admin UI 元数据与 Agent 宿主机目录。
          </p>
        </div>
        <span className="pill-badge">Migration</span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-[22px] border border-slate-200/90 bg-white/90 px-4 py-4 text-sm leading-7 text-slate-600">
            <ol className="list-decimal space-y-2 pl-5">
              <li>点击下面按钮生成并下载平台迁移包。</li>
              <li>把压缩包拷到目标机器并解压。</li>
              <li>运行 `./bootstrap-migrate.sh /path/to/new-openclaw-data-root`。</li>
              <li>脚本会改写旧宿主机绝对路径并执行 `docker compose up -d --build`。</li>
            </ol>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="btn-primary px-4 py-2 text-sm"
            >
              {loading ? "生成中…" : "生成并下载平台迁移包"}
            </button>
            <button
              type="button"
              onClick={refreshExports}
              disabled={loading}
              className="btn-secondary px-4 py-2 text-sm"
            >
              刷新列表
            </button>
          </div>

          {message ? <div className="notice-success whitespace-pre-wrap">{message}</div> : null}
          {error ? <div className="notice-error">{error}</div> : null}
        </div>

        <div className="space-y-3">
          <div className="surface-soft px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              最近迁移包
            </div>
            <div className="mt-3 space-y-3">
              {exports.length ? (
                exports.map((item) => (
                  <div key={item.fileName} className="rounded-[18px] border border-slate-200/90 bg-white/90 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="pill-badge">
                        {item.kind === "platform-bundle"
                          ? "平台"
                          : item.kind === "agent-bundle"
                            ? "Agent"
                            : "文件"}
                      </span>
                      <a href={item.downloadPath} className="text-xs font-medium text-sky-700 hover:text-sky-800">
                        下载
                      </a>
                    </div>
                    <div className="mt-3 break-all text-sm font-medium text-slate-900">
                      {item.fileName}
                    </div>
                    <div className="mt-2 text-[12px] leading-6 text-slate-500">
                      {formatTime(item.modifiedAt)} · {formatBytes(item.sizeBytes)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  暂无迁移包记录
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
