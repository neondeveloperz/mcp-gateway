import * as React from "react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { MenuBadge, type BadgeVariant } from "@/components/nav-badge"
import { cn } from "@/lib/utils"

export interface NavDocumentItem {
  id: string
  name: string
  url?: string
  icon: React.ReactNode
  badge?: string | number
  badgeVariant?: BadgeVariant
}

export function NavDocuments({
  items,
  activeItem,
  onSelectItem,
  label = "Security & Management",
}: {
  items: NavDocumentItem[]
  activeItem?: string
  onSelectItem?: (id: string) => void
  label?: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isCurrentActive = activeItem === item.id
          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                tooltip={item.name}
                isActive={isCurrentActive}
                onClick={() => onSelectItem?.(item.id)}
                className={cn("cursor-pointer", item.badge != null && "pr-20")}
              >
                {item.icon}
                <span>{item.name}</span>
              </SidebarMenuButton>
              {item.badge != null && (
                <SidebarMenuBadge className="right-2 h-auto pointer-events-none">
                  <MenuBadge badge={item.badge} variant={item.badgeVariant} />
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
