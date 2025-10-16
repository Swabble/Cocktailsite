import * as React from "react";
import { cn } from "@/lib/cn";

const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="overflow-x-auto">
    <div className="min-w-full rounded-2xl border border-slate-200 bg-white shadow-soft">
      <table className={cn("w-full min-w-[880px] caption-bottom text-sm", className)} {...props} />
    </div>
  </div>
);

const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("bg-slate-50 text-left", className)} {...props} />
);

const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("divide-y divide-slate-100", className)} {...props} />
);

const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      "group cursor-pointer transition even:bg-slate-50/60 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200",
      className
    )}
    {...props}
  />
);

const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500", className)} {...props} />
);

const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("px-6 py-4 align-top text-sm text-slate-700", className)} {...props} />
);

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
