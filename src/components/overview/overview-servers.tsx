import * as React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ServerIcon,
  PlayIcon,
  SquareIcon,
  ZapIcon,
  ArrowRightIcon,
  WrenchIcon,
  ClockIcon,
} from "lucide-react"
import { toast } from "sonner"

export interface ServerItem {
  id: string
  name: string
  transport: "stdio" | "sse" | "websocket"
  command: string
  toolsCount: number
  resourcesCount: number
  latencyMs: number
  status: "online" | "standby" | "error"
}

export function OverviewServers({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [servers, setServers] = React.useState<ServerItem[]>([
    {
      id: "fs-1",
      name: "filesystem-local",
      transport: "stdio",
      command: "npx -y @modelcontextprotocol/server-filesystem /Users/armzi/Desktop",
      toolsCount: 6,
      resourcesCount: 4,
      latencyMs: 4,
      status: "online",
    },
    {
      id: "sqlite-1",
      name: "sqlite-database",
      transport: "stdio",
      command: "uvx mcp-server-sqlite --db-path ./data.db",
      toolsCount: 8,
      resourcesCount: 2,
      latencyMs: 8,
      status: "online",
    },
    {
      id: "github-1",
      name: "github-tools",
      transport: "stdio",
      command: "npx -y @modelcontextprotocol/server-github",
      toolsCount: 10,
      resourcesCount: 2,
      latencyMs: 19,
      status: "online",
    },
    {
      id: "postgres-1",
      name: "postgres-remote",
      transport: "sse",
      command: "http://127.0.0.1:5432/mcp-sse",
      toolsCount: 4,
      resourcesCount: 1,
      latencyMs: 0,
      status: "standby",
    },
  ])

  const [pingingId, setPingingId] = React.useState<string | null>(null)

  const handleToggle = (id: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const nextStatus = s.status === "online" ? "standby" : "online"
        toast(nextStatus === "online" ? `Started ${s.name}` : `Stopped ${s.name}`, {
          description: nextStatus === "online" ? "Transport connected and tools ready" : "Transport disconnected",
        })
        return { ...s, status: nextStatus }
      })
    )
  }

  const handlePing = (server: ServerItem) => {
    if (server.status !== "online") {
      toast.warning(`${server.name} is on standby`, {
        description: "Start the server first to perform a health check",
      })
      return
    }
    setPingingId(server.id)
    setTimeout(() => {
      setPingingId(null)
      toast.success(`Ping: ${server.name}`, {
        description: `Roundtrip latency: ${server.latencyMs}ms · Protocol OK`,
      })
    }, 450)
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ServerIcon className="size-4 text-primary" />
            Configured MCP Servers
          </CardTitle>
          <CardDescription className="text-xs">
            Manage attached stdio & SSE servers serving tools to your AI workspace
          </CardDescription>
        </div>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate?.("servers")}
            className="cursor-pointer gap-1 text-xs text-primary hover:text-primary"
          >
            <span>View All ({servers.length})</span>
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {servers.map((server) => {
            const isOnline = server.status === "online"
            return (
              <div
                key={server.id}
                className={`relative flex flex-col justify-between rounded-lg border p-3.5 transition-all ${
                  isOnline
                    ? "border-border/70 bg-card hover:border-primary/40"
                    : "border-border/40 bg-muted/20 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-sm">{server.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-semibold ${
                          server.transport === "sse"
                            ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                            : "border-sky-500/30 text-sky-400 bg-sky-500/10"
                        }`}
                      >
                        {server.transport}
                      </Badge>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          isOnline
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground border border-border/50"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
                          }`}
                        />
                        {isOnline ? "Online" : "Standby"}
                      </span>
                    </div>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {server.command}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-medium">
                      <WrenchIcon className="size-3.5 text-primary" />
                      <span>{server.toolsCount} tools</span>
                    </span>
                    {isOnline && (
                      <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-500">
                        <ClockIcon className="size-3" />
                        <span>{server.latencyMs}ms</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePing(server)}
                      disabled={!isOnline || pingingId === server.id}
                      className="h-7 cursor-pointer px-2 text-xs"
                      title="Test ping latency"
                    >
                      <ZapIcon className={`size-3.5 ${pingingId === server.id ? "animate-bounce text-amber-400" : ""}`} />
                      <span className="ml-1">Ping</span>
                    </Button>
                    <Button
                      variant={isOnline ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleToggle(server.id)}
                      className={`h-7 cursor-pointer px-2 text-xs ${
                        isOnline ? "text-destructive hover:text-destructive" : ""
                      }`}
                    >
                      {isOnline ? (
                        <>
                          <SquareIcon className="size-3 mr-1 fill-current" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon className="size-3 mr-1 fill-current" />
                          <span>Start</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
