import * as React from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavSecondaryItem {
  id: string
  title: string
  url?: string
  icon: React.ReactNode
}

export function NavSecondary({
  items,
  activeItem,
  onSelectItem,
  ...props
}: {
  items: NavSecondaryItem[]
  activeItem?: string
  onSelectItem?: (id: string) => void
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isCurrentActive = activeItem === item.id
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isCurrentActive}
                  onClick={() => onSelectItem?.(item.id)}
                  className="cursor-pointer"
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
