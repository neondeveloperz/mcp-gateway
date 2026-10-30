import * as React from "react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavDocumentItem {
  id: string
  name: string
  url?: string
  icon: React.ReactNode
  badge?: string | number
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
                <span>{item.name}</span>
              </SidebarMenuButton>
              {item.badge != null && (
                <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
