import * as React from "react"
import { cn } from "@/lib/utils"

export type BadgeVariant = "default" | "secondary" | "success" | "live" | "outline"

export interface MenuBadgeProps {
  badge: React.ReactNode | number | string
  variant?: BadgeVariant
  className?: string
}

export function MenuBadge({ badge, variant, className }: MenuBadgeProps) {
  if (React.isValidElement(badge)) {
    return badge
  }

  const text = String(badge).trim()
  const lower = text.toLowerCase()

  // Auto-detect variant if not specified
  const effectiveVariant =
    variant ??
    (lower === "live"
      ? "live"
      : lower.includes("active")
        ? "success"
        : "secondary")

  if (effectiveVariant === "live") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 shadow-2xs",
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        {text}
      </span>
    )
  }

  if (effectiveVariant === "success") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 shadow-2xs",
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {text}
      </span>
    )
  }

  if (effectiveVariant === "outline") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-border/70 bg-transparent px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground shadow-2xs",
          className
        )}
      >
        {text}
      </span>
    )
  }

  // secondary / default
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border/50 bg-secondary/80 px-2 py-0.5 font-mono text-[11px] font-medium text-secondary-foreground shadow-2xs transition-colors group-hover/menu-button:bg-secondary group-hover/menu-button:border-border",
        className
      )}
    >
      {text}
    </span>
  )
}
