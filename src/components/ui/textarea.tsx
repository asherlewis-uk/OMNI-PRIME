// ═══════════════════════════════════════════════════════════════════════════════
// TEXTAREA - Multi-line Text Input Component
// ═══════════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white shadow-sm transition-colors",
          "placeholder:text-white/40",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
