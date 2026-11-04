import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useDelete } from "../api/hooks";

// A delete button that always asks first, in a dialog that names what will be deleted.
// If the API says no (409, for example a running task), the reason is shown in the dialog
export function DeleteButton({
  path,
  what,
  consequence,
  invalidate,
  onDeleted,
  label = "Delete",
}: {
  path: string;
  what: ReactNode;
  consequence?: ReactNode;
  invalidate: string[][];
  onDeleted?: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const del = useDelete(invalidate);
  const titleId = useId();

  // showModal traps focus and lets Esc close the dialog
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  const close = () => {
    setOpen(false);
    del.reset();
  };

  return (
    <>
      <button type="button" className="btn-ghost px-3 py-1.5 text-bad hover:bg-bad/10" onClick={() => setOpen(true)}>
        {label}
      </button>
      <dialog
        ref={dialog}
        onClose={close}
        aria-labelledby={titleId}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-md border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
      >
        <div className="space-y-3 p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            Delete {what}?
          </h2>
          {consequence && <p className="text-sm text-muted">{consequence}</p>}
          <p className="text-sm text-muted">This can't be undone.</p>
          {del.isError && (
            <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
              <strong>Not deleted: </strong>
              {del.error.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={close} autoFocus>
              Cancel
            </button>
            <button
              type="button"
              className="btn bg-bad text-white hover:bg-bad/90"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(path, {
                  onSuccess: () => {
                    close();
                    onDeleted?.();
                  },
                })
              }
            >
              {del.isPending ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
