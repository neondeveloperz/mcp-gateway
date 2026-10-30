import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { PlusCircleIcon, ActivityIcon } from "lucide-react"

export interface NavMainItem {
  id: string
  title: string
  url?: string
  icon?: React.ReactNode
  badge?: string | number
  isActive?: boolean
}

export function NavMain({
  items,
  activeItem,
  onSelectItem,
  onAddServer,
}: {
  items: NavMainItem[]
  activeItem?: string
  onSelectItem?: (id: string) => void
  onAddServer?: () => void
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Gateway</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Add MCP Server"
              onClick={onAddServer}
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground cursor-pointer"
            >
              <PlusCircleIcon className="size-4" />
              <span className="font-medium">Add Server</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 shrink-0 group-data-[collapsible=icon]:opacity-0 cursor-pointer"
              variant="outline"
              title="Gateway Status: Running"
              onClick={() => onSelectItem?.("logs")}
            >
              <ActivityIcon className="size-4 text-emerald-500" />
              <span className="sr-only">Live Status</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const isCurrentActive = activeItem ? activeItem === item.id : item.isActive
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
                {item.badge != null && (
                  <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
