import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

const Tabs = TabsPrimitive.Root;

const TabsList = ({ className, ...props }: TabsPrimitive.TabsListProps) => (
  <TabsPrimitive.List
    className={cn(
      "flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2 shadow-soft",
      className
    )}
    {...props}
  />
);

const TabsTrigger = ({ className, ...props }: TabsPrimitive.TabsTriggerProps) => (
  <TabsPrimitive.Trigger
    className={cn(
      "inline-flex min-w-[80px] flex-1 items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium text-slate-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white",
      className
    )}
    {...props}
  />
);

const TabsContent = ({ className, ...props }: TabsPrimitive.TabsContentProps) => (
  <TabsPrimitive.Content
    className={cn("mt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200", className)}
    {...props}
  />
);

export { Tabs, TabsList, TabsTrigger, TabsContent };
