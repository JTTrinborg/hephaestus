// A Greek key band under the navigation, drawn in the accent colour at low strength
export function Frieze() {
  return (
    <svg aria-hidden="true" className="block h-3 w-full text-accent/50" preserveAspectRatio="none">
      <defs>
        <pattern id="meander" width="24" height="12" patternUnits="userSpaceOnUse">
          <path
            d="M0 11 H18 V3 H6 V8 H13 V6 M18 11 H24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="12" fill="url(#meander)" />
    </svg>
  );
}
