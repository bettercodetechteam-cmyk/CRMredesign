"use client";

import { cn } from "@/lib/utils";

interface NoiseBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  gradientColors?: string[];
  noiseIntensity?: number;
  animating?: boolean;
}

const DEFAULT_GRADIENTS = [
  "rgb(255, 100, 150)",
  "rgb(100, 150, 255)",
  "rgb(255, 200, 100)",
];

export function NoiseBackground({
  children,
  className,
  containerClassName,
  gradientColors = DEFAULT_GRADIENTS,
  noiseIntensity = 0.2,
  animating = true,
}: NoiseBackgroundProps) {
  const [c1, c2, c3] = gradientColors;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full w-fit inline-block",
        containerClassName
      )}
    >
      {/* Animated gradient border - decorative only, behind content */}
      <div
        className={cn(
          "absolute inset-0 rounded-full p-[2px]",
          animating && "animate-noise-gradient"
        )}
        style={{
          background: `linear-gradient(120deg, ${c1}, ${c2}, ${c3}, ${c1})`,
          backgroundSize: "200% 200%",
        }}
        aria-hidden
      />
      {/* Inner content in flow so container gets size from button */}
      <div
        className={cn(
          "relative rounded-full m-[2px] bg-white dark:bg-neutral-950 min-w-0",
          className
        )}
      >
        {/* Noise texture overlay - pointer-events-none so button stays clickable */}
        <div
          className="absolute inset-0 rounded-full opacity-[var(--noise-opacity,0.15)] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            ["--noise-opacity" as string]: noiseIntensity,
          }}
        />
        {children}
      </div>
    </div>
  );
}
