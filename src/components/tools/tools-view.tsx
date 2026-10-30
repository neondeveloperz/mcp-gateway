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
  WrenchIcon,
  PlayIcon,
  SearchIcon,
  ServerIcon,
  CheckCircle2Icon,
  CopyIcon,
  RotateCwIcon,
  SlidersHorizontalIcon,
  TagIcon,
  ClockIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  fetchDiscoveredTools,
  fetchDiscoveredServers,
  subscribeToServers,
  executeMcpTool,
  type McpTool,
  type McpServer,
} from "@/lib/mcp-service"

export function ToolsView() {
  const [tools, setTools] = React.useState<McpTool[]>([])
  const [servers, setServers] = React.useState<McpServer[]>([])
  const [search, setSearch] = React.useState("")
  const [selectedServer, setSelectedServer] = React.useState<string>("all")
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all")
  const [activeTool, setActiveTool] = React.useState<McpTool | null>(null)
  const [isRunnerOpen, setIsRunnerOpen] = React.useState(false)
  const [argsJson, setArgsJson] = React.useState("{}")
  const [executionResult, setExecutionResult] = React.useState<unknown | null>(null)
  const [isRunning, setIsRunning] = React.useState(false)
  const [executionLatency, setExecutionLatency] = React.useState<number | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const reloadTools = React.useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const discoveredTools = await fetchDiscoveredTools()
      setTools(discoveredTools)
      const list = await fetchDiscoveredServers()
      setServers(list)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    reloadTools(false)
    const unsubscribe = subscribeToServers(() => {
      reloadTools(false)
    })
    return unsubscribe
  }, [reloadTools])

  const categories = Array.from(new Set(tools.map((t) => t.category)))

  const filteredTools = tools.filter((tool) => {
    const matchSearch =
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase()) ||
      tool.server.toLowerCase().includes(search.toLowerCase())
    const matchServer = selectedServer === "all" || tool.server === selectedServer
    const matchCat = selectedCategory === "all" || tool.category === selectedCategory
    return matchSearch && matchServer && matchCat
  })

  const handleOpenRunner = (tool: McpTool) => {
    setActiveTool(tool)
    const initialArgs: Record<string, unknown> = {}
    Object.entries(tool.parameters).forEach(([key, param]) => {
      if (param.type === "string") initialArgs[key] = key === "address" ? "0x100003fa0" : "test_value"
      else if (param.type === "number") initialArgs[key] = 10
      else if (param.type === "boolean") initialArgs[key] = true
      else initialArgs[key] = null
    })
    setArgsJson(JSON.stringify(initialArgs, null, 2))
    setExecutionResult(null)
    setExecutionLatency(null)
    setIsRunnerOpen(true)
  }

  const handleExecute = async () => {
    if (!activeTool) return
    setIsRunning(true)
    try {
      let parsedArgs = {}
      try {
        parsedArgs = JSON.parse(argsJson)
      } catch {
        toast.error("Invalid JSON in arguments")
        setIsRunning(false)
        return
      }

      const res = await executeMcpTool(activeTool.name, activeTool.server, parsedArgs)
      setExecutionResult(res.result)
      setExecutionLatency(res.latencyMs)
      toast.success(`Executed ${activeTool.name}`, {
        description: `Returned in ${res.latencyMs}ms`,
      })
    } catch (e) {
      toast.error("Tool execution failed", { description: String(e) })
    } finally {
      setIsRunning(false)
    }
  }

  const getRiskBadge = (risk: McpTool["riskLevel"]) => {
    switch (risk) {
      case "critical":
        return "border-destructive/30 text-destructive bg-destructive/10"
      case "high":
        return "border-amber-500/30 text-amber-500 bg-amber-500/10"
      case "medium":
        return "border-sky-500/30 text-sky-400 bg-sky-500/10"
      case "low":
        return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <WrenchIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Tools Explorer & Playground</h2>
              <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary font-semibold text-xs">
                {tools.length} Tools Available
              </Badge>
              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                JSON Schema Validated
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Explore available functions, inspect parameter schemas, and test tool execution live through the MCP Gateway
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => tools.length > 0 && handleOpenRunner(tools[0])}
            disabled={tools.length === 0}
            className="cursor-pointer gap-1.5 bg-primary text-primary-foreground font-medium text-xs h-8"
          >
            <PlayIcon className="size-3.5" />
            <span>Open Playground</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => reloadTools(true)}
            disabled={isLoading}
            className="cursor-pointer gap-1.5 text-xs h-8"
            title="Reload tools"
          >
            <RotateCwIcon className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Fetching Tools..." : "Refresh Tools"}</span>
          </Button>
        </div>
      </div>

      {/* Main Tools Catalog Card */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <SlidersHorizontalIcon className="size-4 text-primary" />
              Active Tools Catalog ({filteredTools.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Direct tools exposed by registered MCP servers
            </CardDescription>
          </div>

          <CardAction className="flex flex-wrap items-center gap-2">
            <div className="relative w-44 md:w-56">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tool or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs font-mono"
              />
            </div>

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

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </CardAction>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-t hover:bg-transparent">
                  <TableHead className="w-56 text-xs font-semibold">Tool Name</TableHead>
                  <TableHead className="w-28 text-xs font-semibold">Server</TableHead>
                  <TableHead className="w-36 text-xs font-semibold">Category</TableHead>
                  <TableHead className="text-xs font-semibold">Description</TableHead>
                  <TableHead className="w-44 text-xs font-semibold">Parameters</TableHead>
                  <TableHead className="w-24 text-xs font-semibold">Risk</TableHead>
                  <TableHead className="w-28 text-right text-xs font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <WrenchIcon className="size-8 text-muted-foreground/60" />
                        <span className="font-semibold text-foreground text-sm">No Tools Available</span>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {servers.length === 0
                            ? "Tools will appear here once you add and connect MCP servers in 'MCP Servers'."
                            : `You have ${servers.length} connected server(s). Click below to fetch and synchronize their tools.`}
                        </p>
                        {servers.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => reloadTools(true)}
                            disabled={isLoading}
                            className="gap-1.5 text-xs h-8 cursor-pointer mt-1 bg-primary text-primary-foreground font-medium"
                          >
                            <RotateCwIcon className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                            <span>{isLoading ? "Fetching Tools..." : "Fetch Server Tools"}</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTools.map((tool) => {
                    const paramKeys = Object.keys(tool.parameters)
                    return (
                      <TableRow key={tool.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs font-semibold text-foreground">
                          {tool.name}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            <ServerIcon className="size-3.5 text-primary" />
                            {tool.server}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                            <TagIcon className="size-2.5 text-muted-foreground" />
                            {tool.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-sm truncate">
                          {tool.description}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {paramKeys.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground italic">None</span>
                            ) : (
                              paramKeys.map((p) => (
                                <Badge
                                  key={p}
                                  variant="outline"
                                  className="font-mono text-[10px] bg-muted/40 text-foreground"
                                >
                                  {p}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${getRiskBadge(tool.riskLevel)}`}>
                            {tool.riskLevel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRunner(tool)}
                            className="h-7 px-2.5 text-[11px] cursor-pointer gap-1"
                          >
                            <PlayIcon className="size-3 text-primary" />
                            <span>Test</span>
                          </Button>
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
          <span>Schema definitions synced from registered MCP servers</span>
          <span>Showing {filteredTools.length} tools</span>
        </CardFooter>
      </Card>

      {/* Tool Runner Playground Sheet */}
      <Sheet open={isRunnerOpen} onOpenChange={setIsRunnerOpen}>
        <SheetContent className="sm:max-w-xl w-full flex flex-col p-0 overflow-y-auto">
          {activeTool && (
            <div className="flex flex-col h-full">
              <SheetHeader className="p-5 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="gap-1 font-mono text-xs">
                    <ServerIcon className="size-3 text-primary" />
                    {activeTool.server}
                  </Badge>
                  <Badge variant="outline" className={`text-xs uppercase font-semibold ${getRiskBadge(activeTool.riskLevel)}`}>
                    {activeTool.riskLevel} Risk
                  </Badge>
                </div>
                <SheetTitle className="text-base font-bold font-mono tracking-tight pt-2">
                  {activeTool.name}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {activeTool.description}
                </SheetDescription>
              </SheetHeader>

              <div className="p-5 flex-1 space-y-4">
                {/* Parameters Schema Reference */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Expected Parameters</label>
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    {Object.keys(activeTool.parameters).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">This tool takes no parameters.</p>
                    ) : (
                      Object.entries(activeTool.parameters).map(([key, val]) => (
                        <div key={key} className="flex items-start justify-between text-xs">
                          <div className="space-y-0.5">
                            <span className="font-mono font-semibold text-foreground">{key}</span>
                            <span className="text-[10px] text-muted-foreground ml-2">({val.type})</span>
                            <p className="text-[11px] text-muted-foreground">{val.description}</p>
                          </div>
                          {val.required && (
                            <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-[9px]">
                              Required
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Input Arguments JSON */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">Input Arguments (JSON)</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(argsJson)
                        toast.success("Arguments copied")
                      }}
                      className="h-6 px-2 text-[11px] cursor-pointer gap-1"
                    >
                      <CopyIcon className="size-3" />
                      Copy
                    </Button>
                  </div>
                  <textarea
                    value={argsJson}
                    onChange={(e) => setArgsJson(e.target.value)}
                    rows={6}
                    className="w-full rounded-md border border-input bg-muted/30 p-3 font-mono text-xs outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Output Result */}
                {executionResult !== null && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <CheckCircle2Icon className="size-3.5 text-emerald-400" />
                        Execution Result
                      </span>
                      {executionLatency !== null && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <ClockIcon className="size-3" />
                          {executionLatency} ms
                        </span>
                      )}
                    </div>
                    <pre className="p-3.5 rounded-lg border bg-muted/40 font-mono text-xs overflow-x-auto text-foreground max-h-60 leading-relaxed">
                      {typeof executionResult === "string"
                        ? executionResult
                        : JSON.stringify(executionResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRunnerOpen(false)}
                  className="cursor-pointer text-xs h-8"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecute}
                  disabled={isRunning}
                  className="cursor-pointer gap-1.5 text-xs h-8 bg-primary text-primary-foreground font-medium"
                >
                  <PlayIcon className={`size-3.5 ${isRunning ? "animate-spin" : ""}`} />
                  <span>{isRunning ? "Executing..." : "Execute Tool"}</span>
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

