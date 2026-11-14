import { useState, type ReactNode } from "react";
import { useDelete } from "../api/hooks";
import { ConfirmDialog } from "./ConfirmDialog";

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
  const del = useDelete(invalidate);

  const close = () => {
    setOpen(false);
    del.reset();
  };

  return (
    <>
      <button type="button" className="btn-ghost px-3 py-1.5 text-bad hover:bg-bad/10" onClick={() => setOpen(true)}>
        {label}
      </button>
      <ConfirmDialog
        open={open}
        title={<>Delete {what}?</>}
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
        tone="danger"
        pending={del.isPending}
        error={del.error}
        errorPrefix="Not deleted:"
        onClose={close}
        onConfirm={() =>
          del.mutate(path, {
            onSuccess: () => {
              close();
              onDeleted?.();
            },
          })
        }
      >
        {consequence && <p className="text-sm text-muted">{consequence}</p>}
        <p className="text-sm text-muted">This can't be undone.</p>
      </ConfirmDialog>
    </>
  );
}
