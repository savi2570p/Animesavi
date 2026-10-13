interface DubBadgeProps {
  isEngDub?: boolean | null;
  isSubOnly?: boolean | null;
  genres?: string[] | null;
  size?: "sm" | "md";
  className?: string;
}

export const isAdultGenres = (genres?: string[] | null) =>
  !!genres?.some((g) => g?.toLowerCase() === "hentai");

function DubOnly({ isEngDub, isSubOnly, size = "sm", className = "" }: DubBadgeProps) {
  const sz = size === "md" ? "inline-flex items-center px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]";
  if (isSubOnly) return <span className={`font-bold uppercase tracking-wider rounded bg-emerald-500/90 text-white shadow ${sz} ${className}`}>SUB</span>;
  if (isEngDub) return <span className={`font-bold uppercase tracking-wider rounded bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow ${sz} ${className}`}>E-DUB</span>;
  return <span className={`badge-glass-hdub ${className}`}>H-DUB</span>;
}

/**
 * Shared dub/audio badge. Priority: SUB > E-DUB > H-DUB.
 * Adds an "18+" tag when genres include Hentai.
 */
export function DubBadge(props: DubBadgeProps) {
  const dub = <DubOnly {...props} />;
  if (!isAdultGenres(props.genres)) return dub;
  const sz = props.size === "md" ? "px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded font-bold bg-destructive text-destructive-foreground shadow ${sz}`}>18+</span>
      {dub}
    </span>
  );
}
