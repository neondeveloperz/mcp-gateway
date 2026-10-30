import { useState, type CSSProperties } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Greet } from "@/components/greet"
import data from "@/app/dashboard/data.json"

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
        />
        <SidebarInset>
          <SiteHeader title={tabTitles[activeTab] ?? "Overview"} />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <SectionCards />
                <div className="px-4 lg:px-6">
                  <Greet />
                </div>
                <div className="px-4 lg:px-6">
                  <ChartAreaInteractive />
                </div>
                <DataTable data={data} />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
