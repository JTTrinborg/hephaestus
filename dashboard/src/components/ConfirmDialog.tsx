import { useEffect, useId, useRef, type ReactNode } from "react";

// A modal that asks before something that can't be undone, such as deleting or sending an email.
// showModal traps focus and lets Esc close it. Cancel has focus first, so Enter never confirms by accident.
// An error from the API is shown inside, and the dialog stays open so the reason can be read
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  tone,
  pending,
  error,
  errorPrefix,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  tone: "danger" | "accent";
  pending: boolean;
  error: Error | null;
  errorPrefix: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby={titleId}
      className="w-[min(30rem,calc(100vw-2rem))] rounded-md border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="space-y-3 p-5">
        <h2 id={titleId} className="break-words text-lg font-semibold">
          {title}
        </h2>
        {children}
        {error && (
          <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            <strong>{errorPrefix} </strong>
            {error.message}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn bg-bad text-white hover:bg-bad/90" : "btn-primary"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
