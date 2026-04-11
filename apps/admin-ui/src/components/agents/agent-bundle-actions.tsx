"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

function triggerDownload(downloadPath: string) {
  const anchor = document.createElement("a");
  anchor.href = downloadPath;
  anchor.download = "";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function AgentBundleActions({
  selectedIds,
  onSuccess,
  onError,
}: {
  selectedIds: string[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<"" | "export" | "import">("");

  async function handleExport() {
    if (!selectedIds.length) {
      onError("请先选择至少一个 Agent");
      return;
    }

    setBusy("export");
    try {
      const response = await fetch("/api/admin/v1/agents/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentIds: selectedIds }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { downloadPath: string; agentCount: number };
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "导出 Agent 失败");
      }

      triggerDownload(payload.data.downloadPath);
      onSuccess(`已打包 ${payload.data.agentCount} 个 Agent，下载已开始`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "导出 Agent 失败");
    } finally {
      setBusy("");
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setBusy("import");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/v1/agents/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { importedAgentIds: string[] };
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "导入 Agent 失败");
      }

      router.refresh();
      onSuccess(`已导入 ${payload.data.importedAgentIds.length} 个 Agent`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "导入 Agent 失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".tar.gz,application/gzip,application/x-gzip"
        className="hidden"
        onChange={handleImport}
      />
      <button
        type="button"
        onClick={handleExport}
        disabled={busy !== "" || !selectedIds.length}
        className="btn-secondary px-4 py-2 text-xs"
        title={selectedIds.length ? "导出选中的 Agent" : "请先勾选 Agent"}
      >
        {busy === "export" ? "导出中…" : "导出 Agent 包"}
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy !== ""}
        className="btn-secondary px-4 py-2 text-xs"
      >
        {busy === "import" ? "导入中…" : "导入 Agent 包"}
      </button>
    </>
  );
}
