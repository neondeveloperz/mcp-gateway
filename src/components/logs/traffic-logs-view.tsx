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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  ActivityIcon,
  TerminalIcon,
  PlayIcon,
  PauseIcon,
  Trash2Icon,
  DownloadIcon,
  RotateCwIcon,
  SendIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  CopyIcon,
  SearchIcon,
  ServerIcon,
  RadioIcon,
  ClockIcon,
  Code2Icon,
  ZapIcon,
  EyeIcon,
  ArrowDownToLineIcon,
  LockIcon,
} from "lucide-react"
import { toast } from "sonner"
import { TablePagination } from "@/components/ui/table-pagination"
import { TableSortHeader, type SortOrder } from "@/components/ui/table-sort-header"
import {
  getRpcLogs,
  clearRpcLogs,
  logRpcCall,
  fetchDiscoveredServers,
  pingServer,
  type RpcLog,
  type McpServer,
} from "@/lib/mcp-service"

export function TrafficLogsView() {
  const [logs, setLogs] = React.useState<RpcLog[]>([])
  const [servers, setServers] = React.useState<McpServer[]>([])
  const [isStreaming, setIsStreaming] = React.useState(true)
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [selectedServer, setSelectedServer] = React.useState<string>("all")
  const [selectedMethod, setSelectedMethod] = React.useState<string>("all")
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all")
  const [activeInspectorLog, setActiveInspectorLog] = React.useState<RpcLog | null>(null)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)
  const [isSendingTest, setIsSendingTest] = React.useState(false)

  // Sorting & Pagination
  type LogSortKey = "time" | "status" | "method" | "server" | "target" | "latency" | "clientIp"
  const [sortKey, setSortKey] = React.useState<LogSortKey | null>("time")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(15)

  const logContainerRef = React.useRef<HTMLDivElement>(null)

  const loadLogs = React.useCallback(() => {
    setLogs(getRpcLogs())
  }, [])

  React.useEffect(() => {
    loadLogs()
    fetchDiscoveredServers().then(setServers)
  }, [loadLogs])

  // Real-time polling when streaming is active
  React.useEffect(() => {
    if (!isStreaming) return
    const interval = setInterval(() => {
      loadLogs()
    }, 2000)
    return () => clearInterval(interval)
  }, [isStreaming, loadLogs])

  // Auto scroll effect
  React.useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0
    }
  }, [logs, autoScroll])

  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      search === "" ||
      log.server.toLowerCase().includes(search.toLowerCase()) ||
      log.target.toLowerCase().includes(search.toLowerCase()) ||
      log.method.toLowerCase().includes(search.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(search.toLowerCase())) ||
      (log.requestPayload && log.requestPayload.toLowerCase().includes(search.toLowerCase()))

    const matchServer = selectedServer === "all" || log.server === selectedServer
    const matchMethod = selectedMethod === "all" || log.method === selectedMethod
    const matchStatus = selectedStatus === "all" || log.status === selectedStatus

    return matchSearch && matchServer && matchMethod && matchStatus
  })

  const handleSort = (column: LogSortKey) => {
    if (sortKey === column) {
      if (sortOrder === "asc") setSortOrder("desc")
      else if (sortOrder === "desc") {
        setSortKey(null)
        setSortOrder(null)
      }
    } else {
      setSortKey(column)
      setSortOrder("asc")
    }
    setCurrentPage(1)
  }

  const sortedLogs = React.useMemo(() => {
    if (!sortKey || !sortOrder) return filteredLogs
    return [...filteredLogs].sort((a, b) => {
      let comparison = 0
      switch (sortKey) {
        case "time":
          comparison = a.time.localeCompare(b.time)
          break
        case "status":
          comparison = a.status.localeCompare(b.status)
          break
        case "method":
          comparison = a.method.localeCompare(b.method)
          break
        case "server":
          comparison = a.server.localeCompare(b.server)
          break
        case "target":
          comparison = a.target.localeCompare(b.target)
          break
        case "latency":
          comparison = a.latencyMs - b.latencyMs
          break
        case "clientIp":
          comparison = (a.clientIp || "").localeCompare(b.clientIp || "")
          break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
  }, [filteredLogs, sortKey, sortOrder])

  const paginatedLogs = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedLogs.slice(start, start + pageSize)
  }, [sortedLogs, currentPage, pageSize])

  // Metrics calculations
  const totalCalls = logs.length
  const successCount = logs.filter((l) => l.status === "success").length
  const successRate = totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 100
  const avgLatency =
    totalCalls > 0
      ? Math.round(logs.reduce((acc, curr) => acc + (Number(curr.latencyMs) || 0), 0) / totalCalls)
      : 0

  const handleClearLogs = () => {
    clearRpcLogs()
    setLogs([])
    setActiveInspectorLog(null)
    setIsSheetOpen(false)
    toast.success("Logs Cleared", { description: "Traffic buffer has been flushed" })
  }

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2))
    const downloadAnchor = document.createElement("a")
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `mcp_gateway_logs_${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success("Logs Exported", { description: `Exported ${logs.length} JSON-RPC records` })
  }

  const handleInspect = (log: RpcLog) => {
    setActiveInspectorLog(log)
    setIsSheetOpen(true)
  }

  const handleCopyPayload = (payload: string, label: string) => {
    navigator.clipboard.writeText(payload)
    toast.success(`${label} Copied to Clipboard`)
  }

  const handleSendTestCall = async () => {
    setIsSendingTest(true)
    // Pick the first online server or default to 9remote / rea
    const targetServer = servers.find((s) => s.status === "online") || servers[0]
    if (!targetServer) {
      toast.error("No MCP servers registered", {
        description: "Please add an MCP server in 'MCP Servers' before sending test RPC calls.",
      })
      setIsSendingTest(false)
      return
    }

    try {
      const res = await pingServer(targetServer)
      loadLogs()
      if (res.success) {
        toast.success(`Test RPC Dispatched to ${targetServer.name}`, {
          description: `Latency: ${res.latencyMs}ms · Protocol: ${targetServer.transport.toUpperCase()}`,
        })
      } else {
        toast.error(`Test RPC Failed for ${targetServer.name}`, {
          description: res.message,
        })
      }
    } catch (e) {
      toast.error("Error executing test call", { description: String(e) })
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleReplay = async (log: RpcLog) => {
    const srv = servers.find((s) => s.name === log.server)
    if (srv) {
      await pingServer(srv)
      loadLogs()
      toast.success(`Replayed RPC Call to ${log.server}`, {
        description: `Method: ${log.method} · Target: ${log.target}`,
      })
    } else {
      // Simulate replay into log
      const replayed = logRpcCall({
        method: log.method,
        server: log.server,
        target: log.target,
        latencyMs: Math.max(1, Math.round(log.latencyMs + (Math.random() * 4 - 2))),
        status: "success",
        details: "Replay executed successfully",
        clientIp: "127.0.0.1",
        transport: log.transport || "http",
        requestPayload: log.requestPayload,
        responsePayload: log.responsePayload,
      })
      loadLogs()
      setActiveInspectorLog(replayed)
      toast.success(`Replayed RPC Call to ${log.server}`)
    }
  }

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case "tools/call":
        return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
      case "tools/list":
        return "border-teal-500/30 text-teal-400 bg-teal-500/10"
      case "resources/read":
        return "border-sky-500/30 text-sky-400 bg-sky-500/10"
      case "prompts/get":
        return "border-purple-500/30 text-purple-400 bg-purple-500/10"
      case "ping":
        return "border-amber-500/30 text-amber-400 bg-amber-500/10"
      default:
        return "border-border/50 text-muted-foreground bg-muted"
    }
  }

  const getLatencyBadgeClass = (ms: number) => {
    if (ms < 15) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    if (ms < 80) return "text-amber-400 bg-amber-500/10 border-amber-500/30"
    return "text-destructive bg-destructive/10 border-destructive/30"
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full min-w-0 max-w-full">
      {/* Top Header Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <ActivityIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Traffic & Live JSON-RPC Logs</h2>
              <Badge
                variant="outline"
                className={`gap-1.5 font-semibold text-xs ${
                  isStreaming
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    isStreaming ? "bg-emerald-400 animate-ping" : "bg-amber-400"
                  }`}
                />
                {isStreaming ? "STREAMING LIVE" : "STREAM PAUSED"}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                Protocol: JSON-RPC 2.0
              </Badge>
              <Badge variant="outline" className="font-mono text-xs text-emerald-500 border-emerald-500/20 bg-emerald-500/10 gap-1">
                <LockIcon className="size-3" />
                <span>Tokens Shielded</span>
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Deep telemetry inspection, payload debugging, latency analysis, and execution traces for all MCP servers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            variant={autoScroll ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoScroll((prev) => !prev)}
            className="cursor-pointer gap-1.5 text-xs h-8 px-2 sm:px-3"
            title={autoScroll ? "Auto-scroll to top enabled" : "Auto-scroll disabled"}
          >
            <ArrowDownToLineIcon className="size-3.5" />
            <span className="hidden sm:inline">Auto-scroll</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsStreaming((prev) => !prev)}
            className="cursor-pointer gap-1.5 text-xs h-8 px-2 sm:px-3"
            title={isStreaming ? "Pause live streaming" : "Resume streaming"}
          >
            {isStreaming ? (
              <>
                <PauseIcon className="size-3.5 text-amber-400" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <PlayIcon className="size-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Resume</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTestCall}
            disabled={isSendingTest}
            className="cursor-pointer gap-1.5 text-xs h-8 px-2 sm:px-3"
            title="Send Test JSON-RPC Call"
          >
            <SendIcon className={`size-3.5 ${isSendingTest ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Send Test RPC</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLogs}
            disabled={logs.length === 0}
            className="cursor-pointer gap-1.5 text-xs h-8 px-2 sm:px-3"
            title="Export Logs"
          >
            <DownloadIcon className="size-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            className="cursor-pointer gap-1.5 text-xs h-8 px-2 sm:px-3 text-destructive hover:text-destructive"
            title="Clear Logs"
          >
            <Trash2Icon className="size-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>

      {/* 4 Performance & Traffic Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card/40 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              <TerminalIcon className="size-3.5 text-primary" />
              Recorded Calls
            </span>
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              Buffer
            </Badge>
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">{totalCalls}</p>
          <p className="text-[11px] text-muted-foreground">Rolling buffer (max 100 entries)</p>
        </div>

        <div className="rounded-lg border bg-card/40 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              <ZapIcon className="size-3.5 text-emerald-500" />
              Success Rate
            </span>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
              Reliability
            </Badge>
          </div>
          <p className="text-xl font-bold tracking-tight text-emerald-400">{successRate}%</p>
          <p className="text-[11px] text-muted-foreground">
            {successCount} succeeded · {totalCalls - successCount} failed
          </p>
        </div>

        <div className="rounded-lg border bg-card/40 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              <ClockIcon className="size-3.5 text-sky-500" />
              Avg Latency
            </span>
            <Badge variant="outline" className="border-sky-500/30 text-sky-400 text-[10px]">
              Roundtrip
            </Badge>
          </div>
          <p className="text-xl font-bold tracking-tight text-sky-400">{avgLatency} ms</p>
          <p className="text-[11px] text-muted-foreground">Across Stdio, SSE, and HTTP</p>
        </div>

        <div className="rounded-lg border bg-card/40 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground flex items-center gap-1.5">
              <RadioIcon className="size-3.5 text-purple-500" />
              Active Channels
            </span>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-[10px]">
              Multi-transport
            </Badge>
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">
            {servers.filter((s) => s.status === "online").length} of {servers.length} Servers
          </p>
          <p className="text-[11px] text-muted-foreground">Stdio pipes and SSE listener active</p>
        </div>
      </div>

      {/* Main Logs Table Card */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TerminalIcon className="size-4 text-primary" />
              Telemetry Feed ({filteredLogs.length} matches)
            </CardTitle>
            <CardDescription className="text-xs">
              Click any row to open the JSON-RPC request and response inspector
            </CardDescription>
          </div>

          <CardAction className="flex flex-wrap items-center gap-2">
            <div className="relative w-44 md:w-56">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search server, method, payload..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs font-mono"
              />
            </div>

            {/* Server Filter */}
            <select
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none cursor-pointer"
            >
              <option value="all">All Servers</option>
              {servers.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Method Filter */}
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none cursor-pointer"
            >
              <option value="all">All Methods</option>
              <option value="tools/call">tools/call</option>
              <option value="tools/list">tools/list</option>
              <option value="resources/read">resources/read</option>
              <option value="prompts/get">prompts/get</option>
              <option value="ping">ping</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="success">Success (200 OK)</option>
              <option value="error">Error (Failed)</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              className="h-8 px-2 text-xs cursor-pointer"
              title="Refresh logs"
            >
              <RotateCwIcon className="size-3.5" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          <div ref={logContainerRef} className="overflow-x-auto max-h-[580px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="border-t hover:bg-transparent">
                  <TableHead className="w-24 text-xs font-semibold">
                    <TableSortHeader column="time" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                      Time
                    </TableSortHeader>
                  </TableHead>
                  <TableHead className="w-24 text-xs font-semibold">
                    <TableSortHeader column="status" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                      Status
                    </TableSortHeader>
                  </TableHead>
                  <TableHead className="w-32 text-xs font-semibold">
                    <TableSortHeader column="method" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                      Method
                    </TableSortHeader>
                  </TableHead>
                  <TableHead className="w-32 text-xs font-semibold">
                    <TableSortHeader column="server" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                      Server
                    </TableSortHeader>
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    <TableSortHeader column="target" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                      Target / Action
                    </TableSortHeader>
                  </TableHead>
                  <TableHead className="w-24 text-xs font-semibold">
                    <TableSortHeader column="latency" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                      Latency
                    </TableSortHeader>
                  </TableHead>
                  <TableHead className="w-24 text-xs font-semibold">
                    <TableSortHeader column="clientIp" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                      Client IP
                    </TableSortHeader>
                  </TableHead>
                  <TableHead className="w-20 text-right text-xs font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <TerminalIcon className="size-8 text-muted-foreground/60" />
                        <span className="font-semibold text-foreground text-sm">No JSON-RPC Traffic Recorded</span>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          Logs will appear here in real-time as AI agents invoke tools and execute requests through the gateway.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map((log) => {
                    const methodBadge = getMethodBadgeClass(log.method)
                    const latencyBadge = getLatencyBadgeClass(log.latencyMs)
                    return (
                      <TableRow
                        key={log.id}
                        onClick={() => handleInspect(log)}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {log.time}
                        </TableCell>
                        <TableCell>
                          {log.status === "success" ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] gap-1 font-medium"
                            >
                              <CheckCircle2Icon className="size-3" />
                              200 OK
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
                        <TableCell>
                          <Badge variant="outline" className={`font-mono text-[10px] font-semibold ${methodBadge}`}>
                            {log.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          <span className="flex items-center gap-1.5">
                            <ServerIcon className="size-3.5 text-primary" />
                            {log.server}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-foreground">
                          <div className="flex flex-col">
                            <span className="font-medium truncate max-w-xs">{log.target}</span>
                            {log.details && (
                              <span className="text-[11px] text-muted-foreground font-sans truncate max-w-sm">
                                {log.details}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-mono text-[10px] font-semibold ${latencyBadge}`}>
                            {log.latencyMs}ms
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.clientIp || "127.0.0.1"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleInspect(log)
                            }}
                            className="size-7 p-0 cursor-pointer"
                            title="Inspect Payload"
                          >
                            <EyeIcon className="size-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={sortedLogs.length}
            pageSizeOptions={[10, 15, 25, 50, 100]}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* JSON-RPC Inspector Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-xl w-full flex flex-col p-0 overflow-y-auto">
          {activeInspectorLog && (
            <div className="flex flex-col h-full">
              <SheetHeader className="p-5 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs font-semibold ${getMethodBadgeClass(
                        activeInspectorLog.method
                      )}`}
                    >
                      {activeInspectorLog.method}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs font-semibold ${getLatencyBadgeClass(
                        activeInspectorLog.latencyMs
                      )}`}
                    >
                      {activeInspectorLog.latencyMs} ms
                    </Badge>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                    {activeInspectorLog.time}
                  </Badge>
                </div>
                <SheetTitle className="text-base font-bold font-mono tracking-tight pt-2">
                  {activeInspectorLog.target}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Server: <strong className="text-foreground">{activeInspectorLog.server}</strong> · Client:{" "}
                  <code className="text-foreground">{activeInspectorLog.clientIp || "127.0.0.1"}</code> · Protocol:{" "}
                  <span className="uppercase text-foreground">{activeInspectorLog.transport || "http"}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="p-5 flex-1 space-y-4">
                {/* Status Callout */}
                <div
                  className={`flex items-start gap-3 rounded-lg border p-3.5 text-xs ${
                    activeInspectorLog.status === "success"
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                      : "border-destructive/20 bg-destructive/5 text-destructive"
                  }`}
                >
                  {activeInspectorLog.status === "success" ? (
                    <CheckCircle2Icon className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircleIcon className="size-4 shrink-0 text-destructive mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      {activeInspectorLog.status === "success"
                        ? "Call Completed (200 OK)"
                        : "Call Failed / Server Error"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {activeInspectorLog.details || "Request handled according to JSON-RPC 2.0 specification"}
                    </p>
                  </div>
                </div>

                {/* Tabs for Request & Response */}
                <Tabs defaultValue="request" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="request" className="text-xs cursor-pointer gap-1.5">
                      <Code2Icon className="size-3.5" />
                      Request Payload
                    </TabsTrigger>
                    <TabsTrigger value="response" className="text-xs cursor-pointer gap-1.5">
                      <TerminalIcon className="size-3.5" />
                      Response Payload
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="request" className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>JSON-RPC 2.0 Request Object</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyPayload(
                            activeInspectorLog.requestPayload ||
                              JSON.stringify(
                                {
                                  jsonrpc: "2.0",
                                  id: activeInspectorLog.id,
                                  method: activeInspectorLog.method,
                                  params: { target: activeInspectorLog.target },
                                },
                                null,
                                2
                              ),
                            "Request Payload"
                          )
                        }
                        className="h-6 px-2 text-[11px] cursor-pointer gap-1"
                      >
                        <CopyIcon className="size-3" />
                        Copy
                      </Button>
                    </div>
                    <pre className="p-3.5 rounded-lg border bg-muted/40 font-mono text-xs overflow-x-auto text-foreground leading-relaxed max-h-72">
                      {activeInspectorLog.requestPayload ||
                        JSON.stringify(
                          {
                            jsonrpc: "2.0",
                            id: activeInspectorLog.id,
                            method: activeInspectorLog.method,
                            params: { target: activeInspectorLog.target },
                          },
                          null,
                          2
                        )}
                    </pre>
                  </TabsContent>

                  <TabsContent value="response" className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>JSON-RPC 2.0 Result / Error</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCopyPayload(
                            activeInspectorLog.responsePayload ||
                              JSON.stringify(
                                {
                                  jsonrpc: "2.0",
                                  id: activeInspectorLog.id,
                                  result: { status: "ok", latencyMs: activeInspectorLog.latencyMs },
                                },
                                null,
                                2
                              ),
                            "Response Payload"
                          )
                        }
                        className="h-6 px-2 text-[11px] cursor-pointer gap-1"
                      >
                        <CopyIcon className="size-3" />
                        Copy
                      </Button>
                    </div>
                    <pre className="p-3.5 rounded-lg border bg-muted/40 font-mono text-xs overflow-x-auto text-foreground leading-relaxed max-h-72">
                      {activeInspectorLog.responsePayload ||
                        JSON.stringify(
                          {
                            jsonrpc: "2.0",
                            id: activeInspectorLog.id,
                            result: {
                              status: activeInspectorLog.status === "success" ? "ok" : "failed",
                              details: activeInspectorLog.details,
                              latencyMs: activeInspectorLog.latencyMs,
                            },
                          },
                          null,
                          2
                        )}
                    </pre>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSheetOpen(false)}
                  className="cursor-pointer text-xs h-8"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleReplay(activeInspectorLog)}
                  className="cursor-pointer gap-1.5 text-xs h-8 bg-primary text-primary-foreground font-medium"
                >
                  <RotateCwIcon className="size-3.5" />
                  Replay RPC Call
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
