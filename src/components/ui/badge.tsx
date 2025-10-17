import { cn } from "@/lib/cn";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "outline";
};

export const Badge = ({ className, variant = "default", ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
      variant === "default"
        ? "bg-slate-100 text-slate-700"
        : "border border-slate-200 text-slate-600",
      className
    )}
    {...props}
  />
);
