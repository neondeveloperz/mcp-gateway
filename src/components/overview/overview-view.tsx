import * as React from "react"
import { OverviewHeader } from "@/components/overview/overview-header"
import { OverviewStats } from "@/components/overview/overview-stats"
import { OverviewServers } from "@/components/overview/overview-servers"
import { OverviewChart } from "@/components/overview/overview-chart"
import { OverviewRecentCalls } from "@/components/overview/overview-recent-calls"
import { type McpServer, subscribeToServers } from "@/lib/mcp-service"

export function OverviewView({
  onNavigate,
  onAddServer,
}: {
  onNavigate?: (tab: string) => void
  onAddServer?: () => void
}) {
  const [servers, setServers] = React.useState<McpServer[]>([])

  React.useEffect(() => {
    const unsubscribe = subscribeToServers(setServers)
    return unsubscribe
  }, [])

  const onlineCount = servers.filter((s) => s.status === "online").length
  const totalTools = servers.reduce((acc, s) => acc + (s.toolsCount || 0), 0)

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full min-w-0 max-w-full">
      <OverviewHeader
        serversCount={onlineCount}
        toolsCount={totalTools}
        onAddServer={onAddServer}
        onNavigate={onNavigate}
      />
      <OverviewStats servers={servers} onNavigate={onNavigate} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <OverviewServers onNavigate={onNavigate} onServerUpdate={setServers} />
        <OverviewChart />
      </div>
      <OverviewRecentCalls onNavigate={onNavigate} />
    </div>
  )
}
