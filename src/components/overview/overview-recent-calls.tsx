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
  AlertCircleIcon,
  Code2Icon,
  RotateCwIcon,
} from "lucide-react"
import { toast } from "sonner"
import { getRpcLogs, type RpcLog } from "@/lib/mcp-service"

export function OverviewRecentCalls({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [calls, setCalls] = React.useState<RpcLog[]>([])
  const [search, setSearch] = React.useState("")
  const [filterMethod, setFilterMethod] = React.useState<string>("all")

  const refreshLogs = React.useCallback(() => {
    setCalls(getRpcLogs())
  }, [])

  React.useEffect(() => {
    refreshLogs()
    // Poll every 3 seconds for new live entries
    const timer = setInterval(refreshLogs, 3000)
    return () => clearInterval(timer)
  }, [refreshLogs])

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
      case "ping":
        return "border-amber-500/30 text-amber-400 bg-amber-500/10"
      default:
        return "border-border/50 text-muted-foreground bg-muted"
    }
  }

  const handleInspect = (call: RpcLog) => {
    toast.info(`Inspect RPC Call: ${call.target}`, {
      description: `Method: ${call.method} · Server: ${call.server} · Latency: ${call.latencyMs}ms ${
        call.details ? `· ${call.details}` : ""
      }`,
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TerminalIcon className="size-4 text-primary" />
            Live JSON-RPC Traffic Log ({calls.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Live request execution logs recorded from real agent and server traffic
          </CardDescription>
        </div>
        <CardAction className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshLogs}
            className="h-7 px-2 text-xs cursor-pointer"
            title="Refresh logs"
          >
            <RotateCwIcon className="size-3.5" />
          </Button>
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
            <ToggleGroupItem value="ping" className="text-[11px] h-7 px-2 cursor-pointer">
              ping
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="relative w-40 md:w-48">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
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
                <TableHead className="text-xs font-semibold">Function / URI / Endpoint</TableHead>
                <TableHead className="w-24 text-right text-xs font-semibold">Latency</TableHead>
                <TableHead className="w-28 text-right text-xs font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-xs text-muted-foreground">
                    No traffic logs recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((call) => (
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
                      <span className="flex items-center gap-1.5 truncate max-w-xs md:max-w-md" title={call.target}>
                        <Code2Icon className="size-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{call.target}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-500">
                      {call.latencyMs}ms
                    </TableCell>
                    <TableCell className="text-right">
                      {call.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                          <CheckCircle2Icon className="size-3.5" />
                          200 OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertCircleIcon className="size-3.5" />
                          Error
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
