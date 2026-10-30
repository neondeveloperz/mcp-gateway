import type { ReactNode } from "react"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"

export type SortOrder = "asc" | "desc" | null

export interface TableSortHeaderProps<T extends string = string> {
  column: T
  currentSort: T | null
  sortOrder: SortOrder
  onSort: (column: T) => void
  children: ReactNode
  className?: string
  align?: "left" | "center" | "right"
}

export function TableSortHeader<T extends string = string>({
  column,
  currentSort,
  sortOrder,
  onSort,
  children,
  className = "",
  align = "left",
}: TableSortHeaderProps<T>) {
  const isSorted = currentSort === column
  const isAsc = isSorted && sortOrder === "asc"
  const isDesc = isSorted && sortOrder === "desc"

  const justifyClass =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
      ? "justify-center text-center"
      : "justify-start text-left"

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`group flex items-center gap-1.5 cursor-pointer font-semibold transition-colors hover:text-foreground select-none w-full ${justifyClass} ${className} ${
        isSorted ? "text-foreground" : "text-muted-foreground"
      }`}
      title={`Sort by ${typeof children === "string" ? children : column}`}
    >
      <span>{children}</span>
      <span className="shrink-0 transition-opacity">
        {isAsc ? (
          <ArrowUpIcon className="size-3 text-primary stroke-[2.5]" />
        ) : isDesc ? (
          <ArrowDownIcon className="size-3 text-primary stroke-[2.5]" />
        ) : (
          <ArrowUpDownIcon className="size-3 opacity-30 group-hover:opacity-80" />
        )}
      </span>
    </button>
  )
}
