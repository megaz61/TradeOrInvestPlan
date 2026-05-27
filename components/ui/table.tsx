import { cn } from "@/lib/utils"
import { clsx } from "clsx"

// Table root
const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-auto">
    <table
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
)

const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("[&_tr]:border-b [&_tr]:border-[#1F2937]", className)} {...props} />
)

const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
)

const TableFooter = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tfoot
    className={cn("border-t border-[#1F2937] bg-[#111827]/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
)

const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      "border-b border-[#1F2937] transition-colors hover:bg-[#1F2937]/50 data-[state=selected]:bg-[#1F2937]",
      className
    )}
    {...props}
  />
)

const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      "h-9 px-3 text-left align-middle text-xs font-medium text-gray-400 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
)

const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn(
      "px-3 py-2 align-middle text-sm text-gray-200 [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
)

const TableCaption = ({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) => (
  <caption
    className={cn("mt-4 text-sm text-gray-400", className)}
    {...props}
  />
)

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
