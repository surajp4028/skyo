import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A vehicle icon that travels the route line ONCE — departure dot → arrival dot — and stays parked
 * at the arrival (CSS keyframes `route-run` in globals.css). Reduced motion: shown at the arrival straight away.
 */
export function RouteRunner({ children, className, duration = 2.2 }: { children: ReactNode; className?: string; duration?: number }) {
  return (
    <span aria-hidden className={cn("route-runner absolute", className)} style={{ ["--route-run" as string]: `${duration}s` }}>
      {children}
    </span>
  );
}
