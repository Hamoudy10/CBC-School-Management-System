// components/ui/Table.tsx
// ============================================================
// Table Component
// Features: responsive, sorting, hover states, loading
// Parts: Table, TableHeader, TableBody, TableRow, TableHead, TableCell
// ============================================================

import {
  forwardRef,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// ============================================================
// Table Wrapper (for horizontal scroll on mobile)
// ============================================================
const TableWrapper = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "w-full overflow-auto rounded-lg border border-secondary-200",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
TableWrapper.displayName = "TableWrapper";

// ============================================================
// Table Root
// ============================================================
const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  ),
);
Table.displayName = "Table";

// ============================================================
// Table Header
// ============================================================
const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-secondary-50 [&_tr]:border-b", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

// ============================================================
// Table Body
// ============================================================
const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

// ============================================================
// Table Footer
// ============================================================
const TableFooter = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-secondary-50 font-medium [&>tr]:last:border-b-0",
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

// ============================================================
// Table Row
// ============================================================
const TableRow = forwardRef<
  HTMLTableRowElement,
  HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-secondary-100 transition-colors hover:bg-secondary-50/50 data-[state=selected]:bg-primary-50",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

// ============================================================
// Table Head Cell
// ============================================================
interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: "asc" | "desc" | null;
  onSort?: () => void;
}

const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, sortable, sortDirection, onSort, children, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-left align-middle font-semibold text-secondary-600 [&:has([role=checkbox])]:pr-0",
        sortable && "cursor-pointer select-none hover:text-secondary-900",
        className,
      )}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortable && (
          <span className="text-secondary-400">
            {sortDirection === "asc" && <ArrowUp className="h-4 w-4" />}
            {sortDirection === "desc" && <ArrowDown className="h-4 w-4" />}
            {!sortDirection && <ArrowUpDown className="h-4 w-4" />}
          </span>
        )}
      </div>
    </th>
  ),
);
TableHead.displayName = "TableHead";

// ============================================================
// Table Cell
// ============================================================
const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-3 align-middle text-secondary-700 [&:has([role=checkbox])]:pr-0",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

// ============================================================
// Table Caption
// ============================================================
const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-secondary-500", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

// ============================================================
// Empty State
// ============================================================
interface TableEmptyProps {
  message?: string;
  description?: string;
  colSpan: number;
}

function TableEmpty({
  message = "No data found",
  description,
  colSpan,
}: TableEmptyProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-32 text-center">
        <div className="flex flex-col items-center justify-center gap-1">
          <p className="font-medium text-secondary-600">{message}</p>
          {description && (
            <p className="text-sm text-secondary-400">{description}</p>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ============================================================
// Loading State
// ============================================================
interface TableLoadingProps {
  colSpan: number;
  rows?: number;
}

function TableLoading({ colSpan, rows = 5 }: TableLoadingProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: colSpan }).map((_, j) => (
            <TableCell key={j}>
              <div className="h-4 w-full animate-pulse rounded bg-secondary-200" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export {
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
  TableLoading,
};
