import { OverviewHeader } from "@/components/overview/overview-header"
import { OverviewStats } from "@/components/overview/overview-stats"
import { OverviewServers } from "@/components/overview/overview-servers"
import { OverviewChart } from "@/components/overview/overview-chart"
import { OverviewRecentCalls } from "@/components/overview/overview-recent-calls"

export function OverviewView({
  onNavigate,
  onAddServer,
}: {
  onNavigate?: (tab: string) => void
  onAddServer?: () => void
}) {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <OverviewHeader onAddServer={onAddServer} onNavigate={onNavigate} />
      <OverviewStats onNavigate={onNavigate} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <OverviewServers onNavigate={onNavigate} />
        <OverviewChart />
      </div>
      <OverviewRecentCalls onNavigate={onNavigate} />
    </div>
  )
}
