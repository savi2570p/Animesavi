import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Liquid-glass skeleton loader.
 * Uses a translucent frosted surface with a moving sheen instead of a flat pulse.
 * Smoother on mobile (single GPU-composited transform), and blends with the
 * dark-purple aurora theme.
 */
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-lg",
          "bg-[linear-gradient(135deg,hsl(0_0%_100%/0.05),hsl(var(--primary)/0.06)_45%,hsl(0_0%_100%/0.04))]",
          "border border-white/5 backdrop-blur-md",
          "before:absolute before:inset-0 before:-translate-x-full",
          "before:bg-[linear-gradient(110deg,transparent_35%,hsl(0_0%_100%/0.18)_50%,transparent_65%)]",
          "before:animate-[skeleton-sheen_1.6s_ease-in-out_infinite]",
          className
        )}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

export { Skeleton };
