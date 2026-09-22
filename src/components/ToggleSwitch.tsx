"use client";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
};

export default function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DAB661]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        checked ? "bg-[#DAB661]" : "bg-slate-700"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
