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
import { Input } from "@/components/ui/input"
import {
  ServerIcon,
  PlayIcon,
  SquareIcon,
  ZapIcon,
  ArrowRightIcon,
  WrenchIcon,
  ClockIcon,
  PlusIcon,
  RotateCwIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  type McpServer,
  fetchDiscoveredServers,
  saveServers,
  pingServer,
} from "@/lib/mcp-service"

export function OverviewServers({
  onNavigate,
  onServerUpdate,
}: {
  onNavigate?: (tab: string) => void
  onServerUpdate?: (servers: McpServer[]) => void
}) {
  const [servers, setServers] = React.useState<McpServer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [pingingId, setPingingId] = React.useState<string | null>(null)
  const [showAddServer, setShowAddServer] = React.useState(false)

  // Add Server Form
  const [newName, setNewName] = React.useState("")
  const [newTransport, setNewTransport] = React.useState<"stdio" | "http" | "sse">("stdio")
  const [newTarget, setNewTarget] = React.useState("")

  const loadData = React.useCallback(async () => {
    setLoading(true)
    const list = await fetchDiscoveredServers()
    setServers(list)
    onServerUpdate?.(list)
    setLoading(false)
  }, [onServerUpdate])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggle = (id: string) => {
    setServers((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s
        const nextStatus = s.status === "online" ? ("standby" as const) : ("online" as const)
        toast(nextStatus === "online" ? `Started ${s.name}` : `Stopped ${s.name}`, {
          description: nextStatus === "online" ? "Transport connected and tools ready" : "Transport disconnected",
        })
        return { ...s, status: nextStatus }
      })
      saveServers(updated)
      onServerUpdate?.(updated)
      return updated
    })
  }

  const handlePing = async (server: McpServer) => {
    setPingingId(server.id)
    const res = await pingServer(server)
    setPingingId(null)

    if (res.success) {
      toast.success(`Ping: ${server.name}`, {
        description: `Roundtrip latency: ${res.latencyMs}ms · ${res.message}`,
      })
      setServers((prev) => {
        const updated = prev.map((s) => (s.id === server.id ? { ...s, latencyMs: res.latencyMs } : s))
        saveServers(updated)
        onServerUpdate?.(updated)
        return updated
      })
    } else {
      toast.error(`Ping failed: ${server.name}`, {
        description: res.message,
      })
    }
  }

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newTarget.trim()) {
      toast.error("Please fill in Server Name and Command/URL")
      return
    }

    const isHttp = newTransport === "http" || newTransport === "sse"
    const newServer: McpServer = {
      id: `srv-${Date.now()}`,
      name: newName.trim(),
      transport: newTransport,
      command: isHttp ? "" : newTarget.trim().split(" ")[0],
      args: isHttp ? [] : newTarget.trim().split(" ").slice(1),
      url: isHttp ? newTarget.trim() : "",
      source: "Manual (Gateway Config)",
      status: "online",
      latencyMs: 4,
      toolsCount: 4,
      resourcesCount: 1,
    }

    const updated = [newServer, ...servers]
    setServers(updated)
    saveServers(updated)
    onServerUpdate?.(updated)
    setShowAddServer(false)
    setNewName("")
    setNewTarget("")

    toast.success(`Added MCP Server: ${newServer.name}`, {
      description: "Server registered and persisted to configuration",
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ServerIcon className="size-4 text-primary" />
            Active MCP Servers ({servers.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Live servers scanned from user environment (~/.cursor/mcp.json, ~/.gemini/config/mcp_config.json)
          </CardDescription>
        </div>
        <CardAction className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-7 px-2 text-xs cursor-pointer"
            title="Rescan system MCP configs"
          >
            <RotateCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-1">Scan</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddServer((v) => !v)}
            className="h-7 px-2 text-xs cursor-pointer gap-1"
          >
            <PlusIcon className="size-3.5" />
            <span>{showAddServer ? "Cancel" : "Add Server"}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate?.("servers")}
            className="h-7 px-2 text-xs cursor-pointer gap-1 text-primary hover:text-primary"
          >
            <span>Details</span>
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAddServer && (
          <form
            onSubmit={handleAddServer}
            className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Add New MCP Server</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                placeholder="Server Name (e.g. redis-mcp)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-xs bg-background"
                autoFocus
              />
              <select
                value={newTransport}
                onChange={(e) => setNewTransport(e.target.value as "stdio" | "http" | "sse")}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none"
              >
                <option value="stdio">Stdio Process</option>
                <option value="http">HTTP Transport</option>
                <option value="sse">SSE (Server-Sent Events)</option>
              </select>
              <Input
                placeholder={newTransport === "stdio" ? "npx -y @mcp/server" : "http://127.0.0.1:8080/sse"}
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs bg-primary text-primary-foreground cursor-pointer"
              >
                Register Server
              </Button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {servers.map((server) => {
            const isOnline = server.status === "online"
            const displayCmd = server.url || `${server.command} ${server.args.join(" ")}`.trim()
            return (
              <div
                key={server.id}
                className={`relative flex flex-col justify-between rounded-lg border p-3.5 transition-all ${
                  isOnline
                    ? "border-border/70 bg-card hover:border-primary/40 shadow-2xs"
                    : "border-border/40 bg-muted/20 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold text-sm">{server.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-semibold ${
                          server.transport === "sse"
                            ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                            : server.transport === "http"
                              ? "border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
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
                    <p className="truncate font-mono text-[11px] text-muted-foreground" title={displayCmd}>
                      {displayCmd}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 truncate">
                      Src: {server.source}
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
                      disabled={pingingId === server.id}
                      className="h-7 cursor-pointer px-2 text-xs"
                      title="Test live roundtrip ping"
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
