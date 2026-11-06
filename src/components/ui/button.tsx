import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "brand" | "dark" | "ghost" | "outline" | "danger";
const styles: Record<Variant, string> = {
  brand: "bg-gradient-to-r from-brand to-brand-2 text-white shadow-[0_10px_30px_-10px_rgba(255,90,31,0.7)] hover:brightness-105",
  dark: "bg-ink text-white hover:bg-ink-2",
  ghost: "text-ink hover:bg-ink/5",
  outline: "border border-line bg-white text-ink hover:border-ink/30",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: "sm" | "md" | "lg" }>(
  function Button({ className, variant = "brand", loading, size = "md", children, disabled, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
          size === "sm" ? "h-9 px-3.5 text-sm" : size === "lg" ? "h-14 px-7 text-base" : "h-12 px-5 text-sm",
          styles[variant],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
