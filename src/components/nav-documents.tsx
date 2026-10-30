import * as React from "react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { MenuBadge, type BadgeVariant } from "@/components/nav-badge"

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
                className="cursor-pointer"
              >
                {item.icon}
                <span className="flex-1 truncate group-data-[collapsible=icon]:hidden group-data-[state=collapsed]:hidden">{item.name}</span>
                {item.badge != null && (
                  <span className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden group-data-[state=collapsed]:hidden">
                    <MenuBadge badge={item.badge} variant={item.badgeVariant} />
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
