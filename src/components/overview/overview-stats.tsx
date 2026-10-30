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

export function OverviewStats({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const stats = [
    {
      title: "Connected Servers",
      value: "3 / 4",
      unit: "Online",
      description: "2 Stdio · 1 SSE · 1 Standby",
      badge: "Healthy",
      badgeVariant: "outline" as const,
      badgeColor: "border-emerald-500/30 text-emerald-500 bg-emerald-500/10",
      icon: <ServerIcon className="size-4 text-emerald-500" />,
      onClick: () => onNavigate?.("servers"),
    },
    {
      title: "Registered Tools",
      value: "24",
      unit: "Ready",
      description: "Available for LLM Function Calling",
      badge: "Validated",
      badgeVariant: "outline" as const,
      badgeColor: "border-sky-500/30 text-sky-500 bg-sky-500/10",
      icon: <WrenchIcon className="size-4 text-sky-500" />,
      onClick: () => onNavigate?.("tools"),
    },
    {
      title: "RPC Calls Today",
      value: "1,842",
      unit: "Requests",
      description: "Avg latency 12ms · 99.9% Success",
      badge: "+18.2%",
      badgeVariant: "outline" as const,
      badgeColor: "border-primary/30 text-primary bg-primary/10",
      icon: <ActivityIcon className="size-4 text-primary" />,
      onClick: () => onNavigate?.("logs"),
    },
    {
      title: "Client Sessions",
      value: "4",
      unit: "Clients",
      description: "Claude, Cursor, CLI & IDE Agent",
      badge: "TLS Guarded",
      badgeVariant: "outline" as const,
      badgeColor: "border-emerald-500/30 text-emerald-500 bg-emerald-500/10",
      icon: <ShieldCheckIcon className="size-4 text-emerald-500" />,
      onClick: () => onNavigate?.("keys"),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.title}
          onClick={stat.onClick}
          className="group cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md"
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
