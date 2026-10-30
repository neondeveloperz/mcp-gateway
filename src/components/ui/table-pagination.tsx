import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"

export interface TablePaginationProps {
  currentPage: number
  pageSize: number
  totalItems: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  className?: string
}

export function TablePagination({
  currentPage,
  pageSize,
  totalItems,
  pageSizeOptions = [5, 10, 20, 50],
  onPageChange,
  onPageSizeChange,
  className = "",
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(totalItems, currentPage * pageSize)

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/60 text-xs text-muted-foreground ${className}`}
    >
      {/* Left: Item range summary */}
      <div className="flex items-center gap-1.5 order-2 sm:order-1">
        <span>Showing</span>
        <span className="font-semibold text-foreground">
          {startItem}-{endItem}
        </span>
        <span>of</span>
        <span className="font-semibold text-foreground">{totalItems}</span>
        <span>entries</span>
      </div>

      {/* Right: Page Size & Navigation Controls */}
      <div className="flex items-center gap-3 sm:gap-4 order-1 sm:order-2 flex-wrap justify-center sm:justify-end">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              Rows per page:
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                onPageSizeChange(Number(val))
                onPageChange(1)
              }}
            >
              <SelectTrigger className="h-7 w-16 text-xs font-medium cursor-pointer">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Page indicator */}
        <div className="text-[11px] whitespace-nowrap">
          Page <strong className="text-foreground">{currentPage}</strong> of{" "}
          <strong className="text-foreground">{totalPages}</strong>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            className="size-7 cursor-pointer"
            title="First page"
          >
            <ChevronsLeftIcon className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="size-7 cursor-pointer"
            title="Previous page"
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="size-7 cursor-pointer"
            title="Next page"
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            className="size-7 cursor-pointer"
            title="Last page"
          >
            <ChevronsRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
