import { useState, type CSSProperties } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { OverviewView } from "@/components/overview/overview-view"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

const tabTitles: Record<string, string> = {
  overview: "Overview",
  servers: "MCP Servers",
  tools: "Tools Explorer",
  resources: "Resources & Prompts",
  logs: "Traffic & Logs",
  keys: "API Keys & Tokens",
  security: "Security & Permissions",
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
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          activeItem={activeTab}
          onSelectItem={setActiveTab}
          onAddServer={() => setActiveTab("servers")}
        />
        <SidebarInset>
          <SiteHeader title={tabTitles[activeTab] ?? "Overview"} />
          <main className="flex-1 overflow-y-auto">
            <OverviewView
              onNavigate={setActiveTab}
              onAddServer={() => setActiveTab("servers")}
            />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  )
}
