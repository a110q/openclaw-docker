'use client';

type ConfirmActionDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  pending = false,
  tone = 'danger',
  onConfirm,
  onClose
}: ConfirmActionDialogProps) {
  if (!open) {
    return null;
  }

  const confirmClassName = tone === 'danger' ? 'btn-danger' : 'btn-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/55 px-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title">
      <div className="surface-panel w-full max-w-md p-6">
        <div className="page-eyebrow">Confirm Action</div>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900" id="confirm-action-title">{title}</div>
        <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
        <div className="mt-7 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={pending} className="btn-secondary">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className={confirmClassName}>
            {pending ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
