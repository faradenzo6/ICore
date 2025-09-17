import React, { useEffect } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  destructive?: boolean;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  onConfirm,
  onClose,
  loading,
  destructive,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const confirmButtonClass = destructive ? 'btn bg-red-600 hover:bg-red-700' : 'btn';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      onClick={() => { if (!loading) onClose(); }}
    >
      <div
        className="card w-full max-w-sm p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="font-semibold">{title}</div>
          <button
            className="text-neutral-300"
            onClick={() => { if (!loading) onClose(); }}
          >
            ✕
          </button>
        </div>
        {description && <div className="mb-4 text-sm text-neutral-300">{description}</div>}
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-2 rounded border border-neutral-700 hover:bg-[#242834]"
            onClick={() => { if (!loading) onClose(); }}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className={confirmButtonClass}
            onClick={() => { if (!loading) onConfirm(); }}
            disabled={loading}
          >
            {loading ? '...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
