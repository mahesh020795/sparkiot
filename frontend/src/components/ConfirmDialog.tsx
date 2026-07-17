import { AlertTriangle, Trash2, X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="confirm-dialog-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <button className="confirm-dialog-close" type="button" aria-label="Close confirmation" onClick={onCancel}>
          <X size={18} />
        </button>
        <span className="confirm-dialog-icon"><AlertTriangle size={22} /></span>
        <div>
          <h2 id="confirm-dialog-title">{title}</h2>
          <p>{body}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button className="danger" type="button" onClick={onConfirm} disabled={busy}>
            <Trash2 size={16} />{busy ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
