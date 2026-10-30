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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  TerminalIcon,
  SearchIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  Code2Icon,
} from "lucide-react"
import { toast } from "sonner"

interface RPCCallLog {
  id: string
  time: string
  method: "tools/call" | "tools/list" | "resources/read" | "prompts/get"
  server: string
  target: string
  latencyMs: number
  status: "success" | "error"
}

export function OverviewRecentCalls({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [search, setSearch] = React.useState("")
  const [filterMethod, setFilterMethod] = React.useState<string>("all")

  const calls: RPCCallLog[] = [
    {
      id: "call-1",
      time: "11:48:22",
      method: "tools/call",
      server: "sqlite-database",
      target: "execute_query",
      latencyMs: 8,
      status: "success",
    },
    {
      id: "call-2",
      time: "11:47:50",
      method: "tools/call",
      server: "filesystem-local",
      target: "read_file",
      latencyMs: 4,
      status: "success",
    },
    {
      id: "call-3",
      time: "11:46:12",
      method: "resources/read",
      server: "github-tools",
      target: "github://repos/armzi/mcp",
      latencyMs: 38,
      status: "success",
    },
    {
      id: "call-4",
      time: "11:45:01",
      method: "tools/call",
      server: "github-tools",
      target: "create_pull_request",
      latencyMs: 142,
      status: "success",
    },
    {
      id: "call-5",
      time: "11:42:33",
      method: "tools/list",
      server: "sqlite-database",
      target: "list_schemas",
      latencyMs: 3,
      status: "success",
    },
    {
      id: "call-6",
      time: "11:40:15",
      method: "prompts/get",
      server: "filesystem-local",
      target: "summarize_notes",
      latencyMs: 6,
      status: "success",
    },
  ]

  const filtered = calls.filter((call) => {
    const matchSearch =
      call.server.toLowerCase().includes(search.toLowerCase()) ||
      call.target.toLowerCase().includes(search.toLowerCase()) ||
      call.method.toLowerCase().includes(search.toLowerCase())
    const matchMethod = filterMethod === "all" || call.method === filterMethod
    return matchSearch && matchMethod
  })

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "tools/call":
        return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
      case "resources/read":
        return "border-sky-500/30 text-sky-400 bg-sky-500/10"
      case "prompts/get":
        return "border-purple-500/30 text-purple-400 bg-purple-500/10"
      default:
        return "border-border/50 text-muted-foreground bg-muted"
    }
  }

  const handleInspect = (call: RPCCallLog) => {
    toast.info(`Inspect RPC Call: ${call.target}`, {
      description: `Method: ${call.method} · Server: ${call.server} · Latency: ${call.latencyMs}ms`,
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TerminalIcon className="size-4 text-primary" />
            Recent JSON-RPC Traffic
          </CardTitle>
          <CardDescription className="text-xs">
            Live request execution logs across connected agents and transports
          </CardDescription>
        </div>
        <CardAction className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[filterMethod]}
            onValueChange={(val) => {
              if (val.length > 0) setFilterMethod(val[0])
            }}
            variant="outline"
            size="sm"
            className="hidden sm:flex"
          >
            <ToggleGroupItem value="all" className="text-[11px] h-7 px-2 cursor-pointer">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="tools/call" className="text-[11px] h-7 px-2 cursor-pointer">
              tools/call
            </ToggleGroupItem>
            <ToggleGroupItem value="resources/read" className="text-[11px] h-7 px-2 cursor-pointer">
              resources/read
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="relative w-40 md:w-48">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search calls..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-8 text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate?.("logs")}
            className="cursor-pointer gap-1 text-xs text-primary hover:text-primary h-7 px-2"
          >
            <span>Live Stream</span>
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-t hover:bg-transparent">
                <TableHead className="w-24 text-xs font-semibold">Time</TableHead>
                <TableHead className="w-32 text-xs font-semibold">Method</TableHead>
                <TableHead className="text-xs font-semibold">Target Server</TableHead>
                <TableHead className="text-xs font-semibold">Function / URI</TableHead>
                <TableHead className="w-24 text-right text-xs font-semibold">Latency</TableHead>
                <TableHead className="w-28 text-right text-xs font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((call) => (
                <TableRow
                  key={call.id}
                  onClick={() => handleInspect(call)}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {call.time}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-mono text-[10px] uppercase ${getMethodBadge(call.method)}`}>
                      {call.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-xs">
                    {call.server}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground/80">
                    <span className="flex items-center gap-1.5">
                      <Code2Icon className="size-3 text-muted-foreground" />
                      {call.target}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-500">
                    {call.latencyMs}ms
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                      <CheckCircle2Icon className="size-3.5" />
                      200 OK
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
