import * as React from "react"

import { NavDocuments, type NavDocumentItem } from "@/components/nav-documents"
import { NavMain, type NavMainItem } from "@/components/nav-main"
import { NavSecondary, type NavSecondaryItem } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
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
  GlobeIcon,
  LayersIcon,
} from "lucide-react"
import {
  type McpServer,
  subscribeToServers,
  fetchDiscoveredTools,
  fetchDiscoveredResources,
} from "@/lib/mcp-service"

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
  const [servers, setServers] = React.useState<McpServer[]>([])
  const [toolsCount, setToolsCount] = React.useState<number>(0)
  const [resourcesCount, setResourcesCount] = React.useState<number>(0)

  React.useEffect(() => {
    const unsubscribe = subscribeToServers((updated) => {
      setServers(updated)
      fetchDiscoveredTools().then((tools) => {
        setToolsCount(tools.length)
      })
      fetchDiscoveredResources().then((res) => {
        setResourcesCount(res.length)
      })
    })

    return unsubscribe
  }, [])

  const onlineServers = servers.filter((s) => s.status === "online").length
  const totalTools = toolsCount > 0 ? toolsCount : servers.reduce((acc, s) => acc + (s.toolsCount || 0), 0)
  const totalResources = resourcesCount > 0 ? resourcesCount : servers.reduce((acc, s) => acc + (s.resourcesCount || 0), 0)

  const navMain: NavMainItem[] = [
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
      badge: `${onlineServers} Active`,
      icon: <ServerIcon className="size-4" />,
    },
    {
      id: "marketplace",
      title: "Registry & Hub",
      url: "#marketplace",
      badge: "Hub",
      icon: <LayersIcon className="size-4 text-emerald-400" />,
    },
    {
      id: "tools",
      title: "Tools Explorer",
      url: "#tools",
      badge: totalTools > 0 ? totalTools.toString() : "0",
      icon: <WrenchIcon className="size-4" />,
    },
    {
      id: "resources",
      title: "Resources & Prompts",
      url: "#resources",
      badge: totalResources > 0 ? totalResources.toString() : "0",
      icon: <FolderCodeIcon className="size-4" />,
    },
    {
      id: "logs",
      title: "Traffic & Logs",
      url: "#logs",
      badge: "Live",
      icon: <ActivityIcon className="size-4" />,
    },
  ]

  const management: NavDocumentItem[] = [
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
      id: "tunnel",
      name: "Cloudflare Tunnel",
      url: "#tunnel",
      icon: <GlobeIcon className="size-4" />,
      badge: "Remote",
    },
    {
      id: "settings",
      name: "Gateway Settings",
      url: "#settings",
      icon: <Settings2Icon className="size-4" />,
    },
  ]

  const navSecondary: NavSecondaryItem[] = [
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
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="MCP Gateway"
              onClick={() => onSelectItem?.("overview")}
              className="cursor-pointer hover:bg-sidebar-accent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-xs ring-1 ring-border/50 p-1">
                <img src="/app-icon.png" alt="MCP Gateway" className="size-full object-contain" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden group-data-[state=collapsed]:hidden">
                <span className="truncate font-semibold tracking-tight">MCP Gateway</span>
                <span className="truncate text-xs text-muted-foreground">version 0.1.1</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={navMain}
          activeItem={activeItem}
          onSelectItem={onSelectItem}
          onAddServer={onAddServer}
        />
        <NavDocuments
          label="Security & Management"
          items={management}
          activeItem={activeItem}
          onSelectItem={onSelectItem}
        />
        <NavSecondary
          items={navSecondary}
          activeItem={activeItem}
          onSelectItem={onSelectItem}
          className="mt-auto"
        />
      </SidebarContent>
    </Sidebar>
  )
}
