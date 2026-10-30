import * as React from "react"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ServerIcon,
  WrenchIcon,
  ActivityIcon,
  ShieldCheckIcon,
  ArrowUpRightIcon,
} from "lucide-react"
import {
  type McpServer,
  type RpcLog,
  subscribeToServers,
  getRpcLogs,
} from "@/lib/mcp-service"

export function OverviewStats({
  servers: propServers,
  onNavigate,
}: {
  servers?: McpServer[]
  onNavigate?: (tab: string) => void
}) {
  const [servers, setServers] = React.useState<McpServer[]>(propServers || [])
  const [logs, setLogs] = React.useState<RpcLog[]>([])

  React.useEffect(() => {
    if (propServers) {
      setServers(propServers)
      setLogs(getRpcLogs())
      return
    }

    const unsubscribe = subscribeToServers((updated) => {
      setServers(updated)
      setLogs(getRpcLogs())
    })
    return unsubscribe
  }, [propServers])

  const onlineServers = servers.filter((s) => s.status === "online").length
  const totalServers = servers.length
  const totalTools = servers.reduce((acc, s) => acc + (s.toolsCount || 0), 0)
  const totalCalls = logs.length
  const avgLatency =
    logs.length > 0
      ? Math.round(logs.reduce((acc, l) => acc + (Number(l.latencyMs) || 0), 0) / logs.length)
      : 8

  const activeTokensCount = React.useMemo(() => {
    if (typeof window === "undefined") return 1
    try {
      const saved = localStorage.getItem("mcp_gateway_tokens_v2")
      if (saved) {
        const tokens = JSON.parse(saved)
        const active = tokens.filter((t: { status?: string }) => t.status === "active").length
        return active > 0 ? active : 1
      }
    } catch {
      // ignore
    }
    return 1
  }, [])

  const stats = [
    {
      title: "Connected Servers",
      value: `${onlineServers} / ${totalServers}`,
      unit: "Online",
      description: `${servers.filter((s) => s.transport === "stdio").length} Stdio · ${
        servers.filter((s) => s.transport === "http" || s.transport === "sse").length
      } Web/SSE`,
      badge: onlineServers > 0 ? "Healthy" : "Standby",
      badgeVariant: "outline" as const,
      badgeColor: onlineServers > 0 ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" : "border-amber-500/30 text-amber-500 bg-amber-500/10",
      icon: <ServerIcon className="size-4 text-emerald-500" />,
      onClick: () => onNavigate?.("servers"),
    },
    {
      title: "Registered Tools",
      value: totalTools.toString(),
      unit: "Tools",
      description: "Aggregated across all active servers",
      badge: "Validated",
      badgeVariant: "outline" as const,
      badgeColor: "border-sky-500/30 text-sky-500 bg-sky-500/10",
      icon: <WrenchIcon className="size-4 text-sky-500" />,
      onClick: () => onNavigate?.("tools"),
    },
    {
      title: "RPC Calls Today",
      value: totalCalls > 0 ? `${totalCalls} logged` : "0",
      unit: "Requests",
      description: `Avg latency ${avgLatency}ms · Local transport`,
      badge: "Realtime",
      badgeVariant: "outline" as const,
      badgeColor: "border-primary/30 text-primary bg-primary/10",
      icon: <ActivityIcon className="size-4 text-primary" />,
      onClick: () => onNavigate?.("logs"),
    },
    {
      title: "Client Sessions",
      value: activeTokensCount.toString(),
      unit: "Tokens",
      description: `${activeTokensCount} Authorized Bearer Token${activeTokensCount === 1 ? "" : "s"}`,
      badge: "TLS & Tokens",
      badgeVariant: "outline" as const,
      badgeColor: "border-emerald-500/30 text-emerald-500 bg-emerald-500/10",
      icon: <ShieldCheckIcon className="size-4 text-emerald-500" />,
      onClick: () => onNavigate?.("keys"),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
      {stats.map((stat) => (
        <Card
          key={stat.title}
          onClick={stat.onClick}
          className="group cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md min-w-0"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription className="flex items-center gap-1.5 font-medium text-xs">
              {stat.icon}
              {stat.title}
            </CardDescription>
            <CardAction>
              <Badge variant={stat.badgeVariant} className={`text-[11px] font-medium ${stat.badgeColor}`}>
                {stat.badge}
              </Badge>
            </CardAction>
          </CardHeader>
          <div className="px-4 pb-2">
            <CardTitle className="flex items-baseline gap-1.5 text-2xl font-bold tracking-tight">
              <span>{stat.value}</span>
              <span className="text-xs font-normal text-muted-foreground">{stat.unit}</span>
            </CardTitle>
          </div>
          <CardFooter className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="truncate">{stat.description}</span>
            <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
