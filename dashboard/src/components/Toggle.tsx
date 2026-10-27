// An on/off switch that says its state in words too, not only with colour
export function Toggle({
  checked,
  onChange,
  label,
  onText = "Active",
  offText = "Off",
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  onText?: string;
  offText?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 text-sm disabled:cursor-wait disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? "border-accent bg-accent" : "border-line bg-sunken"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full shadow transition-all ${
            checked ? "left-[1.1rem] bg-accent-ink" : "left-0.5 bg-idle"
          }`}
        />
      </span>
      <span className={checked ? "font-medium text-ink" : "text-muted"}>{checked ? onText : offText}</span>
    </button>
  );
}
