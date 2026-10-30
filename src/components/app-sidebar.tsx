import * as React from "react"

import { NavDocuments, type NavDocumentItem } from "@/components/nav-documents"
import { NavMain, type NavMainItem } from "@/components/nav-main"
import { NavSecondary, type NavSecondaryItem } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  ServerIcon,
  WrenchIcon,
  FolderCodeIcon,
  ActivityIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  Settings2Icon,
  BookOpenIcon,
  RadioIcon,
  CircleHelpIcon,
  CpuIcon,
} from "lucide-react"

const sidebarData = {
  user: {
    name: "Gateway Admin",
    email: "admin@mcpgateway.local",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='24' fill='%23181f2a'/%3E%3Ccircle cx='48' cy='34' r='18' fill='%2338bdf8'/%3E%3Cpath d='M18 82c6-14 18-22 30-22s24 8 30 22' fill='%2338bdf8'/%3E%3C/svg%3E",
  },
  navMain: [
    {
      id: "overview",
      title: "Overview",
      url: "#overview",
      icon: <LayoutDashboardIcon className="size-4" />,
    },
    {
      id: "servers",
      title: "MCP Servers",
      url: "#servers",
      badge: "3 Active",
      icon: <ServerIcon className="size-4" />,
    },
    {
      id: "tools",
      title: "Tools Explorer",
      url: "#tools",
      badge: "24",
      icon: <WrenchIcon className="size-4" />,
    },
    {
      id: "resources",
      title: "Resources & Prompts",
      url: "#resources",
      badge: "8",
      icon: <FolderCodeIcon className="size-4" />,
    },
    {
      id: "logs",
      title: "Traffic & Logs",
      url: "#logs",
      badge: "Live",
      icon: <ActivityIcon className="size-4" />,
    },
  ] satisfies NavMainItem[],
  management: [
    {
      id: "keys",
      name: "API Keys & Tokens",
      url: "#keys",
      icon: <KeyRoundIcon className="size-4" />,
    },
    {
      id: "security",
      name: "Security & Permissions",
      url: "#security",
      icon: <ShieldCheckIcon className="size-4" />,
    },
    {
      id: "settings",
      name: "Gateway Settings",
      url: "#settings",
      icon: <Settings2Icon className="size-4" />,
    },
  ] satisfies NavDocumentItem[],
  navSecondary: [
    {
      id: "docs",
      title: "Documentation",
      url: "#docs",
      icon: <BookOpenIcon className="size-4" />,
    },
    {
      id: "status",
      title: "System Health",
      url: "#status",
      icon: <RadioIcon className="size-4" />,
    },
    {
      id: "help",
      title: "Support & Feedback",
      url: "#help",
      icon: <CircleHelpIcon className="size-4" />,
    },
  ] satisfies NavSecondaryItem[],
}

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeItem?: string
  onSelectItem?: (id: string) => void
  onAddServer?: () => void
}

export function AppSidebar({
  activeItem = "overview",
  onSelectItem,
  onAddServer,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="MCP Gateway"
              onClick={() => onSelectItem?.("overview")}
              className="cursor-pointer hover:bg-sidebar-accent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <CpuIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight">MCP Gateway</span>
                <span className="truncate text-xs text-muted-foreground">v0.1.0 · Desktop Core</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={sidebarData.navMain}
          activeItem={activeItem}
          onSelectItem={onSelectItem}
          onAddServer={onAddServer}
        />
        <NavDocuments
          label="Security & Management"
          items={sidebarData.management}
          activeItem={activeItem}
          onSelectItem={onSelectItem}
        />
        <NavSecondary
          items={sidebarData.navSecondary}
          activeItem={activeItem}
          onSelectItem={onSelectItem}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
