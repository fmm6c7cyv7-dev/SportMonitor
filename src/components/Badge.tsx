// web/src/components/Badge.tsx

import type { ReactNode } from "react";

/* ==========================================================================
   TYPES
   ========================================================================== */

export type BadgeVariant =
  | "justnu"
  | "live"
  | "klart"
  | "mal"
  | "officiellt"
  | "sport";

/* ==========================================================================
   STYLES
   ========================================================================== */

const badgeStyles: Record<BadgeVariant, string> = {
  justnu:
    "bg-yellow-500/20 text-yellow-200 border-yellow-400/20 badge-glow-yellow",
  live: "bg-amber-500/20 text-amber-200 border-amber-400/20",
  klart: "bg-sky-500/20 text-sky-200 border-sky-400/20",
  mal: "bg-emerald-500/20 text-emerald-200 border-emerald-400/20",
  officiellt: "bg-orange-500/20 text-orange-200 border-orange-400/20",
  sport: "bg-slate-800/60 text-slate-200 border-slate-700/40",
};

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export default function Badge({
  children,
  variant = "sport",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <>
      <style>{`
        @keyframes pulsing-glow-yellow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(234, 179, 8, 0.5);
            border-color: rgba(234, 179, 8, 0.5);
          }

          50% {
            box-shadow:
              0 0 15px rgba(234, 179, 8, 0.9),
              0 0 25px rgba(234, 179, 8, 0.6);
            border-color: rgba(234, 179, 8, 0.9);
          }
        }

        .badge-glow-yellow {
          animation: pulsing-glow-yellow 2s ease-in-out infinite !important;
          border: 1px solid rgba(234, 179, 8, 0.5) !important;
        }
      `}</style>

      <span
        className={[
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wide",
          badgeStyles[variant],
        ].join(" ")}
      >
        {children}
      </span>
    </>
  );
}