import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/cn";

const ScrollArea = ({ className, children, ...props }: ScrollAreaPrimitive.ScrollAreaProps) => (
  <ScrollAreaPrimitive.Root className={cn("relative overflow-hidden", className)} {...props}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-2xl">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
);

const ScrollBar = ({ className, ...props }: ScrollAreaPrimitive.ScrollAreaScrollbarProps) => (
  <ScrollAreaPrimitive.Scrollbar
    className={cn(
      "flex touch-none select-none transition-colors data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-slate-300" />
  </ScrollAreaPrimitive.Scrollbar>
);

export { ScrollArea };
