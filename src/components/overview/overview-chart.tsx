import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ActivityIcon, TrendingUpIcon } from "lucide-react"
import { fetchRpcLogs, type RpcLog } from "@/lib/mcp-service"

const chartConfig = {
  requests: {
    label: "RPC Calls",
    color: "var(--color-primary)",
  },
  latency: {
    label: "Latency (ms)",
    color: "#10b981",
  },
} satisfies ChartConfig

export function OverviewChart() {
  const [metric, setMetric] = React.useState<"requests" | "latency">("requests")
  const [chartData, setChartData] = React.useState<Array<{ time: string; requests: number; latency: number }>>([])
  const [peakInfo, setPeakInfo] = React.useState<string>("Live stream active")

  const refreshChart = React.useCallback(async () => {
    const logs: RpcLog[] = await fetchRpcLogs()
    if (logs.length === 0) {
      const now = new Date().toLocaleTimeString("en-US", { hour12: false })
      setChartData([{ time: now, requests: 0, latency: 0 }])
      return
    }

    // Chronological order (oldest to newest)
    const reversed = [...logs].reverse()
    const points = reversed.map((l) => ({
      time: l.time,
      requests: 1,
      latency: l.latencyMs,
    }))

    setChartData(points)
    const maxLatency = Math.max(...points.map((p) => p.latency))
    setPeakInfo(`Max latency: ${maxLatency}ms · Buffer: ${points.length} calls`)
  }, [])

  React.useEffect(() => {
    refreshChart()
    const interval = setInterval(refreshChart, 2500)
    return () => clearInterval(interval)
  }, [refreshChart])

  return (
    <Card className="flex flex-col min-w-0">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ActivityIcon className="size-4 text-primary shrink-0" />
            <span>Gateway Activity & Latency</span>
          </CardTitle>
          <CardDescription className="text-xs truncate">
            Live JSON-RPC calls and roundtrip response latency across all attached servers
          </CardDescription>
        </div>
        <CardAction className="shrink-0">
          <ToggleGroup
            value={[metric]}
            onValueChange={(val) => {
              const first = val[0]
              if (first === "requests" || first === "latency") {
                setMetric(first)
              }
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="requests" className="text-xs cursor-pointer px-2.5 h-7">
              RPC Calls
            </ToggleGroupItem>
            <ToggleGroupItem value="latency" className="text-xs cursor-pointer px-2.5 h-7">
              Latency (ms)
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillLatency" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v: string) => v}
              className="text-xs"
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) => `Time: ${value}`}
                />
              }
            />
            {metric === "requests" ? (
              <Area
                type="monotone"
                dataKey="requests"
                stroke="var(--color-primary)"
                fill="url(#fillRequests)"
                strokeWidth={2}
              />
            ) : (
              <Area
                type="monotone"
                dataKey="latency"
                stroke="#10b981"
                fill="url(#fillLatency)"
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ChartContainer>

        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{peakInfo}</span>
          </div>
          <div className="flex items-center gap-1 font-medium text-emerald-500">
            <TrendingUpIcon className="size-3.5" />
            <span>100% Operational</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
