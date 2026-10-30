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

const throughputData = [
  { time: "00:00", requests: 45, latency: 11 },
  { time: "02:00", requests: 28, latency: 9 },
  { time: "04:00", requests: 12, latency: 8 },
  { time: "06:00", requests: 35, latency: 10 },
  { time: "08:00", requests: 124, latency: 14 },
  { time: "10:00", requests: 289, latency: 18 },
  { time: "12:00", requests: 312, latency: 16 },
  { time: "14:00", requests: 278, latency: 15 },
  { time: "16:00", requests: 340, latency: 19 },
  { time: "18:00", requests: 295, latency: 14 },
  { time: "20:00", requests: 180, latency: 12 },
  { time: "22:00", requests: 94, latency: 10 },
]

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

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ActivityIcon className="size-4 text-primary" />
            Gateway Activity & Latency
          </CardTitle>
          <CardDescription className="text-xs">
            Live JSON-RPC calls and roundtrip response latency across all attached servers
          </CardDescription>
        </div>
        <CardAction>
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
          <AreaChart data={throughputData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            <span className="flex size-2 rounded-full bg-emerald-500" />
            <span>Peak throughput: 340 reqs/hr at 16:00</span>
          </div>
          <div className="flex items-center gap-1 font-medium text-emerald-500">
            <TrendingUpIcon className="size-3.5" />
            <span>99.94% Uptime</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
