interface DubBadgeProps {
  isEngDub?: boolean | null;
  isSubOnly?: boolean | null;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Shared dub/audio badge.
 * Priority: SUB (sub-only) > E-DUB (English dub) > H-DUB (default).
 */
export function DubBadge({ isEngDub, isSubOnly, size = "sm", className = "" }: DubBadgeProps) {
  if (isSubOnly) {
    return (
      <span
        className={`font-bold uppercase tracking-wider rounded bg-emerald-500/90 text-white shadow ${
          size === "md" ? "inline-flex items-center px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]"
        } ${className}`}
      >
        SUB
      </span>
    );
  }
  if (isEngDub) {
    return (
      <span
        className={`font-bold uppercase tracking-wider rounded bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow ${
          size === "md" ? "inline-flex items-center px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]"
        } ${className}`}
      >
        E-DUB
      </span>
    );
  }
  return <span className={`badge-glass-hdub ${className}`}>H-DUB</span>;
}
