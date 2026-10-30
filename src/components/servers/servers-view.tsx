import * as React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  ServerIcon,
  PlusIcon,
  DownloadIcon,
  RotateCwIcon,
  SearchIcon,
  Trash2Icon,
  CheckCircle2Icon,
  AlertCircleIcon,
  PlayIcon,
  SquareIcon,
  TerminalIcon,
  RadioIcon,
  GlobeIcon,
  CopyIcon,
  SlidersHorizontalIcon,
  LockIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  fetchDiscoveredServers,
  fetchDiscoveredTools,
  fetchRemoteTools,
  pingServer,
  saveServers,
  addCustomServer,
  deleteCustomServer,
  subscribeToServers,
  type McpServer,
} from "@/lib/mcp-service"

export function ServersView() {
  const [servers, setServers] = React.useState<McpServer[]>([])
  const [toolsCountMap, setToolsCountMap] = React.useState<Record<string, number>>({})
  const [search, setSearch] = React.useState("")
  const [transportFilter, setTransportFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [pingingId, setPingingId] = React.useState<string | null>(null)

  // Add Server Form State
  const [newName, setNewName] = React.useState("")
  const [newTransport, setNewTransport] = React.useState<"stdio" | "sse" | "http">("stdio")
  const [newCommand, setNewCommand] = React.useState("")
  const [newArgs, setNewArgs] = React.useState("")
  const [newUrl, setNewUrl] = React.useState("")
  const [newEnvText, setNewEnvText] = React.useState("")
  const [newAuthToken, setNewAuthToken] = React.useState("")
  const [newCustomHeaders, setNewCustomHeaders] = React.useState("")

  const syncToolsCount = React.useCallback(async (serverList: McpServer[]) => {
    try {
      const allTools = await fetchDiscoveredTools()
      const counts: Record<string, number> = {}
      allTools.forEach((t) => {
        counts[t.server] = (counts[t.server] || 0) + 1
      })
      setToolsCountMap(counts)

      let changed = false
      const updated = serverList.map((srv) => {
        const count = counts[srv.name] ?? srv.toolsCount ?? 0
        if (srv.toolsCount !== count) {
          changed = true
          return { ...srv, toolsCount: count }
        }
        return srv
      })
      if (changed) {
        saveServers(updated)
      }
    } catch {
      // ignore
    }
  }, [])

  const loadServers = React.useCallback(async () => {
    const list = await fetchDiscoveredServers()
    setServers(list)
    await syncToolsCount(list)
  }, [syncToolsCount])

  React.useEffect(() => {
    const unsubscribe = subscribeToServers((updated) => {
      setServers(updated)
      syncToolsCount(updated)
    })
    return unsubscribe
  }, [syncToolsCount])

  const filteredServers = servers.filter((srv) => {
    const matchSearch =
      srv.name.toLowerCase().includes(search.toLowerCase()) ||
      srv.command.toLowerCase().includes(search.toLowerCase()) ||
      srv.url.toLowerCase().includes(search.toLowerCase()) ||
      srv.source.toLowerCase().includes(search.toLowerCase())
    const matchTransport = transportFilter === "all" || srv.transport === transportFilter
    const matchStatus = statusFilter === "all" || srv.status === statusFilter
    return matchSearch && matchTransport && matchStatus
  })

  const onlineCount = servers.filter((s) => s.status === "online").length
  const stdioCount = servers.filter((s) => s.transport === "stdio").length
  const remoteCount = servers.filter((s) => s.transport === "http" || s.transport === "sse").length

  const handlePing = async (server: McpServer) => {
    setPingingId(server.id)
    try {
      const res = await pingServer(server)
      if (res.success) {
        let toolsFound = toolsCountMap[server.name] ?? server.toolsCount ?? 0
        if (server.url) {
          try {
            const remoteTools = await fetchRemoteTools(server)
            if (remoteTools.length > 0) {
              toolsFound = remoteTools.length
              setToolsCountMap((prev) => ({ ...prev, [server.name]: toolsFound }))
            }
          } catch {
            // ignore
          }
        }
        toast.success(`Ping Succeeded for ${server.name}`, {
          description: `Latency: ${res.latencyMs}ms · Discovered: ${toolsFound} Tools`,
        })
        const updated = servers.map((s) =>
          s.id === server.id
            ? { ...s, status: "online" as const, latencyMs: res.latencyMs, toolsCount: toolsFound }
            : s
        )
        setServers(updated)
        saveServers(updated)
      } else {
        toast.error(`Ping Failed for ${server.name}`, {
          description: res.message,
        })
        const updated = servers.map((s) =>
          s.id === server.id ? { ...s, status: "error" as const } : s
        )
        setServers(updated)
        saveServers(updated)
      }
    } finally {
      setPingingId(null)
    }
  }

  const handleToggleStatus = (server: McpServer) => {
    const nextStatus = server.status === "online" ? "standby" : "online"
    const updated = servers.map((s) =>
      s.id === server.id ? { ...s, status: nextStatus as McpServer["status"] } : s
    )
    setServers(updated)
    saveServers(updated)
    toast.info(`${server.name} status updated to ${nextStatus.toUpperCase()}`)
  }

  const handleDeleteServer = (id: string, name: string) => {
    deleteCustomServer(id)
    const updated = servers.filter((s) => s.id !== id)
    setServers(updated)
    toast.success(`Server Removed`, { description: `${name} was deleted from configuration` })
  }

  const parseEnv = (text: string): Record<string, string> => {
    if (!text.trim()) return {}
    try {
      if (text.trim().startsWith("{")) {
        return JSON.parse(text)
      }
    } catch {
      // ignore
    }
    const envObj: Record<string, string> = {}
    text.split("\n").forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) return
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx > 0) {
        const k = trimmed.slice(0, eqIdx).trim()
        const v = trimmed.slice(eqIdx + 1).trim()
        envObj[k] = v
      }
    })
    return envObj
  }

  const parseHeaders = (text: string, token: string): Record<string, string> => {
    let headers: Record<string, string> = {}
    if (text.trim()) {
      try {
        if (text.trim().startsWith("{")) {
          headers = JSON.parse(text)
        }
      } catch {
        // ignore
      }
    }
    if (token.trim()) {
      headers["Authorization"] = token.trim().startsWith("Bearer ") ? token.trim() : `Bearer ${token.trim()}`
    }
    return headers
  }

  const handleCreateServer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) {
      toast.error("Server name is required")
      return
    }

    const parsedEnv = parseEnv(newEnvText)
    const parsedHeaders = parseHeaders(newCustomHeaders, newAuthToken)

    const created = addCustomServer({
      name: newName.trim(),
      transport: newTransport,
      command: newCommand.trim(),
      args: newArgs.trim() ? newArgs.split(" ") : [],
      url: newUrl.trim(),
      env: Object.keys(parsedEnv).length > 0 ? parsedEnv : undefined,
      headers: Object.keys(parsedHeaders).length > 0 ? parsedHeaders : undefined,
      authToken: newAuthToken.trim() || undefined,
    })

    setIsAddOpen(false)
    setNewName("")
    setNewCommand("")
    setNewArgs("")
    setNewUrl("")
    setNewEnvText("")
    setNewAuthToken("")
    setNewCustomHeaders("")
    toast.success("MCP Server Added", {
      description: `${created.name} (${created.transport.toUpperCase()}) registered successfully`,
    })
  }

  const handleExportMcpConfig = () => {
    const configMap: Record<string, unknown> = {}
    servers.forEach((s) => {
      if (s.transport === "stdio") {
        const stdioCfg: Record<string, unknown> = {
          command: s.command,
          args: s.args,
        }
        if (s.env && Object.keys(s.env).length > 0) {
          stdioCfg.env = s.env
        }
        configMap[s.name] = stdioCfg
      } else {
        const remoteCfg: Record<string, unknown> = {
          url: s.url,
        }
        if (s.headers && Object.keys(s.headers).length > 0) {
          remoteCfg.headers = s.headers
        } else if (s.authToken) {
          remoteCfg.headers = {
            Authorization: s.authToken.startsWith("Bearer ") ? s.authToken : `Bearer ${s.authToken}`,
          }
        }
        configMap[s.name] = remoteCfg
      }
    })

    const payload = JSON.stringify({ mcpServers: configMap }, null, 2)
    const blob = new Blob([payload], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "mcp_servers_config.json"
    document.body.appendChild(a)
    a.click()
    a.remove()
    toast.success("Config Exported", {
      description: "Compatible with Claude Desktop, Cursor, and Antigravity",
    })
  }

  const getTransportIcon = (transport: McpServer["transport"]) => {
    switch (transport) {
      case "stdio":
        return <TerminalIcon className="size-3.5 text-sky-400" />
      case "sse":
        return <RadioIcon className="size-3.5 text-purple-400" />
      case "http":
        return <GlobeIcon className="size-3.5 text-emerald-400" />
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <ServerIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">MCP Servers Management</h2>
              <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold text-xs">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                {onlineCount} of {servers.length} Servers Active
              </Badge>
              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                Manual Configuration Only
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Register, probe, and orchestrate stdio pipes, SSE event streams, and remote HTTP MCP servers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="cursor-pointer gap-1.5 bg-primary text-primary-foreground font-medium text-xs h-8"
          >
            <PlusIcon className="size-3.5" />
            <span>Add MCP Server</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMcpConfig}
            className="cursor-pointer gap-1.5 text-xs h-8"
          >
            <DownloadIcon className="size-3.5" />
            <span>Export mcp.json</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadServers}
            className="size-8 p-0 cursor-pointer"
            title="Reload servers"
          >
            <RotateCwIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 4 Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card/40 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              <ServerIcon className="size-3.5 text-primary" />
              Total Servers
            </span>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              Active Suite
            </Badge>
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">{servers.length}</p>
          <p className="text-[11px] text-muted-foreground">Configured in registry</p>
        </div>

        <div className="rounded-lg border bg-card/40 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2Icon className="size-3.5 text-emerald-500" />
              Online & Ready
            </span>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
              Healthy
            </Badge>
          </div>
          <p className="text-xl font-bold tracking-tight text-emerald-400">{onlineCount}</p>
          <p className="text-[11px] text-muted-foreground">Ready to accept tool executions</p>
        </div>

        <div className="rounded-lg border bg-card/40 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              <TerminalIcon className="size-3.5 text-sky-400" />
              Stdio Subprocesses
            </span>
            <Badge variant="outline" className="border-sky-500/30 text-sky-400 text-[10px]">
              Local Pipes
            </Badge>
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">{stdioCount}</p>
          <p className="text-[11px] text-muted-foreground">Jailed local child processes</p>
        </div>

        <div className="rounded-lg border bg-card/40 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              <RadioIcon className="size-3.5 text-purple-400" />
              HTTP / SSE Remote
            </span>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-[10px]">
              Network
            </Badge>
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">{remoteCount}</p>
          <p className="text-[11px] text-muted-foreground">Tunnel & event-driven bridges</p>
        </div>
      </div>

      {/* Server List Card */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <SlidersHorizontalIcon className="size-4 text-primary" />
              Configured MCP Servers ({filteredServers.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Live status, ping test, transport endpoints, and child process controls
            </CardDescription>
          </div>

          <CardAction className="flex flex-wrap items-center gap-2">
            <div className="relative w-44 md:w-56">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search server, command..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs font-mono"
              />
            </div>

            <select
              value={transportFilter}
              onChange={(e) => setTransportFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none cursor-pointer"
            >
              <option value="all">All Transports</option>
              <option value="stdio">Stdio</option>
              <option value="http">HTTP</option>
              <option value="sse">SSE</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="online">Online</option>
              <option value="standby">Standby</option>
              <option value="error">Error</option>
            </select>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-t hover:bg-transparent">
                  <TableHead className="w-48 text-xs font-semibold">Server Name</TableHead>
                  <TableHead className="w-28 text-xs font-semibold">Transport</TableHead>
                  <TableHead className="text-xs font-semibold">Target / Command</TableHead>
                  <TableHead className="w-28 text-xs font-semibold">Status</TableHead>
                  <TableHead className="w-24 text-xs font-semibold">Tools</TableHead>
                  <TableHead className="w-24 text-xs font-semibold">Latency</TableHead>
                  <TableHead className="w-44 text-right text-xs font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ServerIcon className="size-8 text-muted-foreground/60" />
                        <span className="font-semibold text-foreground text-sm">No MCP Servers Configured</span>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          No servers are automatically loaded from the host. Click &quot;Add MCP Server&quot; to configure your own Stdio or SSE servers manually.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsAddOpen(true)}
                          className="mt-2 h-8 text-xs cursor-pointer gap-1.5 bg-primary text-primary-foreground font-medium"
                        >
                          <PlusIcon className="size-3.5" />
                          <span>Add MCP Server</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServers.map((server) => {
                    const isPinging = pingingId === server.id
                    return (
                      <TableRow key={server.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-semibold text-xs">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-foreground">
                              <ServerIcon className="size-3.5 text-primary" />
                              <span>{server.name}</span>
                              {(server.authToken || (server.env && Object.keys(server.env).length > 0) || (server.headers && Object.keys(server.headers).length > 0)) && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-500/30 text-emerald-400 gap-0.5 font-normal">
                                  <LockIcon className="size-2.5" />
                                  Auth
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-normal truncate max-w-44">
                              {server.source}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1 font-mono text-[10px] uppercase">
                            {getTransportIcon(server.transport)}
                            {server.transport}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-foreground">
                          <div className="flex items-center gap-1.5 max-w-md truncate">
                            <span className="truncate">
                              {server.url || `${server.command} ${server.args.join(" ")}`.trim()}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  server.url || `${server.command} ${server.args.join(" ")}`
                                )
                                toast.success("Copied to clipboard")
                              }}
                              className="size-5 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                              title="Copy target"
                            >
                              <CopyIcon className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {server.status === "online" ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] gap-1 font-medium"
                            >
                              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Online
                            </Badge>
                          ) : server.status === "standby" ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] gap-1 font-medium"
                            >
                              <span className="size-1.5 rounded-full bg-amber-400" />
                              Standby
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-destructive/30 bg-destructive/10 text-destructive text-[10px] gap-1 font-medium"
                            >
                              <AlertCircleIcon className="size-3" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Badge variant="outline" className="border-border/60 text-muted-foreground text-[10px]">
                            {toolsCountMap[server.name] ?? server.toolsCount ?? 0} Tools
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {server.status === "online" ? `${server.latencyMs}ms` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePing(server)}
                              disabled={isPinging}
                              className="h-7 px-2 text-[11px] cursor-pointer gap-1"
                              title="Ping Server"
                            >
                              <RotateCwIcon className={`size-3 ${isPinging ? "animate-spin" : ""}`} />
                              <span>Ping</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(server)}
                              className="h-7 px-2 text-[11px] cursor-pointer gap-1"
                              title={server.status === "online" ? "Stop Server" : "Start Server"}
                            >
                              {server.status === "online" ? (
                                <SquareIcon className="size-3 text-amber-400" />
                              ) : (
                                <PlayIcon className="size-3 text-emerald-400" />
                              )}
                              <span>{server.status === "online" ? "Standby" : "Start"}</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteServer(server.id, server.name)}
                              className="size-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                              title="Delete Server"
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t border-border/40 text-xs text-muted-foreground">
          <span>Real-time child process health verification enabled</span>
          <span>Showing {filteredServers.length} servers</span>
        </CardFooter>
      </Card>

      {/* Add Server Sheet / Drawer */}
      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col p-0">
          <form onSubmit={handleCreateServer} className="flex flex-col h-full">
            <SheetHeader className="p-5 border-b border-border/60">
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <PlusIcon className="size-4 text-primary" />
                Add New MCP Server
              </SheetTitle>
              <SheetDescription className="text-xs">
                Register a new Stdio child process or remote HTTP/SSE Model Context Protocol endpoint
              </SheetDescription>
            </SheetHeader>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Server Identifier</label>
                <Input
                  placeholder="e.g. filesystem-server"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-xs font-mono"
                  required
                />
                <p className="text-[11px] text-muted-foreground">Unique identifier used by AI clients</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Transport Protocol</label>
                <select
                  value={newTransport}
                  onChange={(e) => setNewTransport(e.target.value as "stdio" | "sse" | "http")}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium outline-none cursor-pointer"
                >
                  <option value="stdio">Stdio (Local Command / Subprocess)</option>
                  <option value="sse">SSE (Server-Sent Events HTTP Stream)</option>
                  <option value="http">HTTP (REST / JSON-RPC Endpoint)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Stdio connects via stdin/stdout pipes; SSE and HTTP connect over network
                </p>
              </div>

              {newTransport === "stdio" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Executable Command</label>
                    <Input
                      placeholder="e.g. npx, uvx, node, python3"
                      value={newCommand}
                      onChange={(e) => setNewCommand(e.target.value)}
                      className="text-xs font-mono"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">Binary executable found in PATH</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Arguments (Space-separated)</label>
                    <Input
                      placeholder="e.g. -y @modelcontextprotocol/server-filesystem /Users/armzi/Desktop"
                      value={newArgs}
                      onChange={(e) => setNewArgs(e.target.value)}
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Command line parameters passed to process</p>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <LockIcon className="size-3.5 text-primary" />
                      Environment Variables & Tokens (Optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder={"GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxx\nAPI_KEY=sk_xxxx"}
                      value={newEnvText}
                      onChange={(e) => setNewEnvText(e.target.value)}
                      className="font-mono text-xs w-full rounded-md border border-input bg-background p-2.5 outline-none resize-none placeholder:text-muted-foreground/60"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Injected securely into the child process environment. Format: KEY=VALUE per line or JSON.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Endpoint URL</label>
                    <Input
                      placeholder="e.g. http://127.0.0.1:3000/sse"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="text-xs font-mono"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">Full HTTP or SSE endpoint address</p>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <LockIcon className="size-3.5 text-primary" />
                      Authentication Bearer Token / API Key (Optional)
                    </label>
                    <Input
                      type="password"
                      placeholder="e.g. ghp_... or mcp_remote_key_..."
                      value={newAuthToken}
                      onChange={(e) => setNewAuthToken(e.target.value)}
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Sent automatically in the &apos;Authorization: Bearer &lt;token&gt;&apos; header to the remote MCP server.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Custom HTTP Headers (Optional JSON)</label>
                    <Input
                      placeholder='e.g. {"x-api-key": "secret123"}'
                      value={newCustomHeaders}
                      onChange={(e) => setNewCustomHeaders(e.target.value)}
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Additional headers needed by specific remote MCP endpoints.</p>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                className="cursor-pointer text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="cursor-pointer gap-1.5 text-xs h-8 bg-primary text-primary-foreground font-medium"
              >
                <PlusIcon className="size-3.5" />
                Register Server
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

