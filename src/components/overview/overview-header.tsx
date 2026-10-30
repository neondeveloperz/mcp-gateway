import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CopyIcon, RotateCwIcon, PlusIcon, CheckIcon, RadioIcon, ShieldCheckIcon } from "lucide-react"
import { toast } from "sonner"

export function OverviewHeader({
  onAddServer,
  onNavigate,
}: {
  onAddServer?: () => void
  onNavigate?: (tab: string) => void
}) {
  const [copied, setCopied] = React.useState(false)
  const [isRestarting, setIsRestarting] = React.useState(false)

  const endpointUrl = "http://127.0.0.1:8080/sse"

  const handleCopyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(endpointUrl)
      setCopied(true)
      toast.success("SSE Endpoint Copied", {
        description: `${endpointUrl} copied to clipboard`,
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }

  const handleRestart = () => {
    setIsRestarting(true)
    toast.info("Restarting Gateway Engine...", {
      description: "Reconnecting active MCP transports and re-indexing tools",
    })
    setTimeout(() => {
      setIsRestarting(false)
      toast.success("Gateway Engine Ready", {
        description: "All 3 active servers connected · 24 tools available",
      })
    }, 1200)
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <RadioIcon className="size-6 text-emerald-500 animate-pulse" />
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">MCP Gateway Core</h2>
            <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-medium text-xs">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Engine Online
            </Badge>
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
              v0.1.0 · Protocol 2024-11-05
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheckIcon className="size-3.5 text-primary" />
              TLS & Token Guard Active
            </span>
            <span>•</span>
            <span className="font-mono text-foreground/80">{endpointUrl}</span>
            <span>•</span>
            <span>4 Client Sessions Connected</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyEndpoint}
          className="cursor-pointer gap-1.5 font-mono text-xs"
        >
          {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
          <span>{copied ? "Copied" : "Copy SSE"}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestart}
          disabled={isRestarting}
          className="cursor-pointer gap-1.5 text-xs"
        >
          <RotateCwIcon className={`size-3.5 ${isRestarting ? "animate-spin" : ""}`} />
          <span>Restart</span>
        </Button>
        <Button
          size="sm"
          onClick={onAddServer ?? (() => onNavigate?.("servers"))}
          className="cursor-pointer gap-1.5 bg-primary text-primary-foreground text-xs font-medium"
        >
          <PlusIcon className="size-3.5" />
          <span>Add Server</span>
        </Button>
      </div>
    </div>
  )
}
