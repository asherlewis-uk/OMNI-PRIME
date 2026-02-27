// ═══════════════════════════════════════════════════════════════════════════════
// BADGE - Status Indicator Component
// ═══════════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-violet-600 text-white shadow hover:bg-violet-600/80",
        secondary:
          "border-transparent bg-white/10 text-white hover:bg-white/20",
        destructive:
          "border-transparent bg-red-600 text-white shadow hover:bg-red-600/80",
        outline:
          "text-white border-white/20",
        success:
          "border-transparent bg-emerald-600 text-white shadow hover:bg-emerald-600/80",
        warning:
          "border-transparent bg-amber-600 text-white shadow hover:bg-amber-600/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
