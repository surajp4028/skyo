import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: ReactNode; error?: string; hint?: string; prefix?: string }>(
  function Field({ label, icon, error, hint, prefix, className, id, ...props }, ref) {
    const fid = id || props.name;
    return (
      <div className="w-full">
        <label htmlFor={fid} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </label>
        <div
          className={cn(
            "flex h-13 items-center gap-2.5 rounded-xl border-2 bg-white px-3.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10",
            error ? "border-red-300" : "border-line",
          )}
        >
          {icon && <span className="text-muted">{icon}</span>}
          {prefix && <span className="border-r border-line pr-2.5 text-sm font-semibold text-ink">{prefix}</span>}
          <input ref={ref} id={fid} className={cn("h-12 w-full min-w-0 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-muted/60", className)} {...props} />
        </div>
        {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      </div>
    );
  },
);
