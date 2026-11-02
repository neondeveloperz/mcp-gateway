import { useState, type CSSProperties } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { OverviewView } from "@/components/overview/overview-view"
import { ServersView } from "@/components/servers/servers-view"
import { ToolsView } from "@/components/tools/tools-view"
import { ResourcesView } from "@/components/resources/resources-view"
import { TrafficLogsView } from "@/components/logs/traffic-logs-view"
import { ApiKeysView } from "@/components/tokens/api-keys-view"
import { SecurityView } from "@/components/security/security-view"
import { CloudflareTunnelView } from "@/components/tunnel/cloudflare-tunnel-view"
import { DatabasesView } from "@/components/database/databases-view"
import { SettingsView } from "@/components/settings/settings-view"
import { DocsView } from "@/components/docs/docs-view"
import { StatusView } from "@/components/status/status-view"
import { HelpView } from "@/components/help/help-view"
import { MarketplaceView } from "@/components/marketplace/marketplace-view"
import { ApprovalModal } from "@/components/security/approval-modal"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

const tabTitles: Record<string, string> = {
  overview: "Overview",
  servers: "MCP Servers",
  marketplace: "Registry & Packages",
  databases: "Databases (Built-in)",
  tools: "Tools Explorer",
  resources: "Resources & Prompts",
  logs: "Traffic & Logs",
  keys: "API Keys & Tokens",
  security: "Security & Permissions",
  tunnel: "Cloudflare Tunnel",
  settings: "Gateway Settings",
  docs: "Documentation",
  status: "System Health",
  help: "Support & Feedback",
}

export default function App() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <TooltipProvider>
      <SidebarProvider
        className="h-screen max-h-screen overflow-hidden"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          collapsible="icon"
          activeItem={activeTab}
          onSelectItem={setActiveTab}
          onAddServer={() => setActiveTab("servers")}
        />
        <SidebarInset>
          <SiteHeader title={tabTitles[activeTab] ?? "Overview"} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0" data-ui-scroll-container>
            {activeTab === "servers" ? (
              <ServersView />
            ) : activeTab === "marketplace" ? (
              <MarketplaceView />
            ) : activeTab === "databases" ? (
              <DatabasesView />
            ) : activeTab === "tools" ? (
              <ToolsView />
            ) : activeTab === "resources" ? (
              <ResourcesView />
            ) : activeTab === "logs" ? (
              <TrafficLogsView />
            ) : activeTab === "keys" ? (
              <ApiKeysView />
            ) : activeTab === "security" ? (
              <SecurityView />
            ) : activeTab === "tunnel" ? (
              <CloudflareTunnelView />
            ) : activeTab === "settings" ? (
              <SettingsView onNavigate={setActiveTab} />
            ) : activeTab === "docs" ? (
              <DocsView />
            ) : activeTab === "status" ? (
              <StatusView />
            ) : activeTab === "help" ? (
              <HelpView />
            ) : (
              <OverviewView
                onNavigate={setActiveTab}
                onAddServer={() => setActiveTab("servers")}
              />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <ApprovalModal />
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  )
}
