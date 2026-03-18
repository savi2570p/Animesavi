export function QualityBadge4K({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute top-1.5 left-1.5 z-10 ${className}`}>
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg">
        4K
      </span>
    </div>
  );
}
