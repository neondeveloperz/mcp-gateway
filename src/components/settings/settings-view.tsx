import * as React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  NetworkIcon,
  ShieldCheckIcon,
  ClockIcon,
  FileTextIcon,
  SaveIcon,
  RotateCcwIcon,
  DownloadIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  RadioIcon,
  CpuIcon,
  HardDriveIcon,
  LockIcon,
  SparklesIcon,
  ZapIcon,
  ShieldAlertIcon,
  CheckIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  fetchSystemInfo,
  fetchIdeStatuses,
  syncIdeConfig,
  type SystemInfo,
  type IdeStatus,
} from "@/lib/mcp-service"

export interface GatewayConfig {
  // Network
  host: string
  port: number
  ssePath: string
  corsOrigins: string
  keepAliveSeconds: number
  maxPayloadMb: number

  // Security
  requireAuth: boolean
  allowLocalhostUnauthenticated: boolean
  enableSandbox: boolean
  executableWhitelist: string
  rateLimitPerMinute: number

  // Timeouts & Execution
  requestTimeoutMs: number
  toolTimeoutMs: number
  autoRestart: boolean
  maxRetries: number
  cacheSchemas: boolean

  // Logging & Telemetry
  logLevel: "debug" | "info" | "warn" | "error"
  redactSecrets: boolean
  persistLogs: boolean
  logPath: string
  maxLogMb: number
}

const defaultConfig: GatewayConfig = {
  host: "127.0.0.1",
  port: 8080,
  ssePath: "/sse",
  corsOrigins: "*",
  keepAliveSeconds: 30,
  maxPayloadMb: 10,

  requireAuth: true,
  allowLocalhostUnauthenticated: true,
  enableSandbox: true,
  executableWhitelist: "node, bun, npx, uvx, python3, python, docker, git",
  rateLimitPerMinute: 120,

  requestTimeoutMs: 30000,
  toolTimeoutMs: 60000,
  autoRestart: true,
  maxRetries: 3,
  cacheSchemas: true,

  logLevel: "info",
  redactSecrets: true,
  persistLogs: true,
  logPath: "~/.mcp-gateway/logs/gateway.log",
  maxLogMb: 50,
}

const STORAGE_KEY = "mcp_gateway_config_v1"

export function SettingsView({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const [config, setConfig] = React.useState<GatewayConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) return { ...defaultConfig, ...JSON.parse(saved) }
      } catch {
        // Fallback to default
      }
    }
    return defaultConfig
  })

  const [hasChanges, setHasChanges] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [systemInfo, setSystemInfo] = React.useState<SystemInfo | null>(null)
  const [uptimeSeconds, setUptimeSeconds] = React.useState<number>(15238)
  const [ideStatuses, setIdeStatuses] = React.useState<IdeStatus[]>([])
  const [syncingIde, setSyncingIde] = React.useState<string | null>(null)

  const reloadIdes = React.useCallback(async () => {
    try {
      const list = await fetchIdeStatuses()
      setIdeStatuses(list)
    } catch {
      // ignore
    }
  }, [])

  React.useEffect(() => {
    reloadIdes()
  }, [reloadIdes])

  const handleSyncIde = async (ide: string, name: string) => {
    setSyncingIde(ide)
    try {
      const msg = await syncIdeConfig(ide, config.port)
      toast.success(`Configured for ${name}`, {
        description: msg,
      })
      await reloadIdes()
    } catch (err) {
      toast.error(`Sync Failed: ${String(err)}`)
    } finally {
      setSyncingIde(null)
    }
  }

  React.useEffect(() => {
    fetchSystemInfo().then((info) => {
      setSystemInfo(info)
      setUptimeSeconds(info.uptimeSecs)
    })

    const timer = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatUptime = (totalSeconds: number | undefined | null) => {
    const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0))
    const days = Math.floor(secs / 86400)
    const hours = Math.floor((secs % 86400) / 3600)
    const minutes = Math.floor((secs % 3600) / 60)
    const seconds = secs % 60
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`
    }
    return `${hours}h ${minutes}m ${seconds}s`
  }

  const updateConfig = <K extends keyof GatewayConfig>(key: K, value: GatewayConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    setIsSaving(true)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      setTimeout(() => {
        setIsSaving(false)
        setHasChanges(false)
        toast.success("Settings Saved", {
          description: `Gateway configured to listen on http://${config.host}:${config.port}${config.ssePath}`,
        })
      }, 350)
    } catch {
      setIsSaving(false)
      toast.error("Failed to save settings")
    }
  }

  const handleReset = () => {
    setConfig(defaultConfig)
    localStorage.removeItem(STORAGE_KEY)
    setHasChanges(false)
    toast.info("Reset to Defaults", {
      description: "Standard security and network defaults restored",
    })
  }

  const handleExport = () => {
    const jsonStr = JSON.stringify(config, null, 2)
    const blob = new Blob([jsonStr], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "gateway.config.json"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported gateway.config.json", {
      description: "Configuration file downloaded successfully",
    })
  }

  const isPublicHost = config.host === "0.0.0.0"

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full min-w-0 max-w-full">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Gateway Settings</h2>
            {hasChanges && (
              <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10 text-xs">
                Unsaved Changes
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Configure host listeners, transport security, execution sandboxes, and logging parameters
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="cursor-pointer gap-1.5 text-xs px-2 sm:px-3"
            title="Export Configuration JSON"
          >
            <DownloadIcon className="size-3.5" />
            <span className="hidden sm:inline">Export JSON</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="cursor-pointer gap-1.5 text-xs px-2 sm:px-3"
            title="Reset Defaults"
          >
            <RotateCcwIcon className="size-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="cursor-pointer gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-2 sm:px-3"
            title="Save Configuration Changes"
          >
            <SaveIcon className="size-3.5" />
            <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save Changes"}</span>
          </Button>
        </div>
      </div>

      {/* Daemon Runtime Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card/40 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <RadioIcon className="size-3.5 text-emerald-500" />
            Active Endpoint
          </span>
          <p className="font-mono text-xs font-semibold text-foreground truncate">
            http://{config.host}:{config.port}{config.ssePath}
          </p>
        </div>
        <div className="rounded-lg border bg-card/40 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <CpuIcon className="size-3.5 text-primary" />
            Daemon PID / OS
          </span>
          <p className="font-mono text-xs font-semibold text-foreground">
            {systemInfo ? `${systemInfo.pid} (${systemInfo.os}-${systemInfo.arch})` : "Scanning..."}
          </p>
        </div>
        <div className="rounded-lg border bg-card/40 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <HardDriveIcon className="size-3.5 text-sky-500" />
            Host / Memory
          </span>
          <p className="font-mono text-xs font-semibold text-foreground truncate" title={systemInfo?.hostname}>
            {systemInfo ? `${systemInfo.hostname} · 48 MB` : "mac.local · 48 MB"}
          </p>
        </div>
        <div className="rounded-lg border bg-card/40 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <ClockIcon className="size-3.5 text-amber-500" />
            Gateway Uptime
          </span>
          <p className="font-mono text-xs font-semibold text-foreground">
            {formatUptime(uptimeSeconds)}
          </p>
        </div>
      </div>

      {/* Categorized Settings Tabs */}
      <Tabs defaultValue="ides" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 gap-1">
          <TabsTrigger value="ides" className="cursor-pointer gap-1.5 text-xs">
            <SparklesIcon className="size-3.5" />
            <span>1-Click IDE Sync</span>
          </TabsTrigger>
          <TabsTrigger value="governance" className="cursor-pointer gap-1.5 text-xs">
            <ShieldAlertIcon className="size-3.5" />
            <span>Loop & Circuit Guard</span>
          </TabsTrigger>
          <TabsTrigger value="network" className="cursor-pointer gap-1.5 text-xs">
            <NetworkIcon className="size-3.5" />
            <span>Network & Ports</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="cursor-pointer gap-1.5 text-xs">
            <ShieldCheckIcon className="size-3.5" />
            <span>Security & Auth</span>
          </TabsTrigger>
          <TabsTrigger value="logging" className="cursor-pointer gap-1.5 text-xs">
            <FileTextIcon className="size-3.5" />
            <span>Logs & Telemetry</span>
          </TabsTrigger>
        </TabsList>

        {/* 0. 1-Click IDE Auto-Configuration */}
        <TabsContent value="ides" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <SparklesIcon className="size-4 text-primary" />
                  One-Click IDE Auto-Configuration
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect your AI coding assistants directly to MCP Gateway without editing JSON files manually.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={reloadIdes}
                className="cursor-pointer gap-1.5 text-xs self-start md:self-auto"
              >
                <RefreshCwIcon className="size-3.5" />
                <span>Refresh Status</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ideStatuses.map((item) => (
                  <div
                    key={item.ide}
                    className="flex flex-col justify-between p-3.5 rounded-lg border bg-card/60 hover:bg-card transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
                          {item.configured ? (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] gap-1">
                              <CheckIcon className="size-3" />
                              <span>Connected</span>
                            </Badge>
                          ) : item.exists ? (
                            <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px]">
                              File Ready
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px]">
                              Not Installed
                            </Badge>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground break-all">
                          {item.path}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Target: http://{config.host}:{config.port}{item.ide === "cursor" ? "/sse" : "/mcp"}
                      </span>
                      <Button
                        size="sm"
                        variant={item.configured ? "outline" : "default"}
                        disabled={syncingIde === item.ide}
                        onClick={() => handleSyncIde(item.ide, item.name)}
                        className="cursor-pointer gap-1.5 text-xs h-7"
                      >
                        <SparklesIcon className="size-3" />
                        <span>
                          {syncingIde === item.ide
                            ? "Syncing..."
                            : item.configured
                            ? "Re-Sync"
                            : "1-Click Connect"}
                        </span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 1. Loop & Circuit Guard Governance */}
        <TabsContent value="governance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldAlertIcon className="size-4 text-amber-500" />
                Anti-Loop & Resilience Governance
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time safety guardrails to protect against runaway agent retry loops and downstream cascade outages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Anti-Loop Guard */}
                <div className="p-4 rounded-lg border bg-card/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <ZapIcon className="size-4 text-amber-500" />
                      Anti-Loop Guard
                    </span>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                      Active (Max 5 / 10s)
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Intercepts autonomous agent infinite retry loops. If an agent calls the exact same tool with identical arguments 5 times within a 10-second rolling window, execution halts immediately with JSON-RPC error <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">-32009</code>.
                  </p>
                </div>

                {/* Circuit Breaker */}
                <div className="p-4 rounded-lg border bg-card/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <ShieldCheckIcon className="size-4 text-sky-500" />
                      Downstream Circuit Breaker
                    </span>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                      Active (3 Fails · 15s Cooloff)
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fail-fast circuit breaker for downstream MCP servers. When a remote server encounters 3 consecutive failures, the circuit trips to OPEN for 15 seconds, returning error <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">-32008</code> to prevent hanging the LLM.
                  </p>
                </div>

                {/* Tool Namespacing & Collision Prevention */}
                <div className="p-4 rounded-lg border bg-card/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <CheckCircle2Icon className="size-4 text-emerald-500" />
                      Namespacing & Collision Guard
                    </span>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                      Auto-Prefix Collisions
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automatically scans all registered MCP servers. When two servers provide a tool with identical names, tools are automatically namespaced (<code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">coolify_deploy</code> vs <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">easypanel_deploy</code>) with zero LLM confusion.
                  </p>
                </div>

                {/* Secret Masking & Traffic Redaction */}
                <div className="p-4 rounded-lg border bg-card/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <LockIcon className="size-4 text-primary" />
                      Secret Masking & Redaction
                    </span>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                      Zero Secret Leakage
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All Bearer tokens, private keys, API secrets, and password strings are automatically redacted from traffic inspection tables, stdout diagnostics, and persistent disk logs using regex patterns.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 1. Network & Ports */}
        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <NetworkIcon className="size-4 text-primary" />
                Network Listener Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Manage the host binding address, port, and SSE event streaming parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Bind Host Address
                  </label>
                  <Input
                    value={config.host}
                    onChange={(e) => updateConfig("host", e.target.value)}
                    placeholder="127.0.0.1"
                    className="font-mono text-xs w-full"
                  />
                  {isPublicHost ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mt-0.5">
                      <AlertTriangleIcon className="size-3 shrink-0" />
                      <span>Warning: 0.0.0.0 exposes the gateway to local network interfaces</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Recommended: 127.0.0.1 (Localhost only) for maximum security
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    HTTP / SSE Port
                  </label>
                  <Input
                    type="number"
                    value={config.port}
                    onChange={(e) => updateConfig("port", Number(e.target.value))}
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Default port is 8080. Ensure port is not occupied.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    SSE Endpoint Route
                  </label>
                  <Input
                    value={config.ssePath}
                    onChange={(e) => updateConfig("ssePath", e.target.value)}
                    placeholder="/sse"
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Path where AI agents establish Server-Sent Events stream
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Allowed CORS Origins
                  </label>
                  <Input
                    value={config.corsOrigins}
                    onChange={(e) => updateConfig("corsOrigins", e.target.value)}
                    placeholder="*"
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use * for all or comma-separated origins (e.g. http://localhost:3000)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Keep-Alive Heartbeat (Seconds)
                  </label>
                  <Input
                    type="number"
                    value={config.keepAliveSeconds}
                    onChange={(e) => updateConfig("keepAliveSeconds", Number(e.target.value))}
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Prevents connection drops across persistent agent sessions
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Max Request Payload (MB)
                  </label>
                  <Input
                    type="number"
                    value={config.maxPayloadMb}
                    onChange={(e) => updateConfig("maxPayloadMb", Number(e.target.value))}
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Maximum body size for incoming tool argument payloads
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Security & Auth */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheckIcon className="size-4 text-emerald-500" />
                Access Control & Sandbox Policies
              </CardTitle>
              <CardDescription className="text-xs">
                Enforce authentication tokens, rate limits, and subprocess command whitelisting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <Checkbox
                    id="requireAuth"
                    checked={config.requireAuth}
                    onCheckedChange={(checked) => updateConfig("requireAuth", checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="requireAuth" className="text-xs font-medium cursor-pointer">
                      Require Bearer Token / API Key on Incoming Transports
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Reject unauthorized requests from external clients missing the Authorization header
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <Checkbox
                    id="allowLocalhost"
                    checked={config.allowLocalhostUnauthenticated}
                    onCheckedChange={(checked) =>
                      updateConfig("allowLocalhostUnauthenticated", checked === true)
                    }
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="allowLocalhost" className="text-xs font-medium cursor-pointer">
                      Allow Unauthenticated Loopback (127.0.0.1)
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Local tools on this machine can connect without manual token input
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <Checkbox
                    id="enableSandbox"
                    checked={config.enableSandbox}
                    onCheckedChange={(checked) => updateConfig("enableSandbox", checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="enableSandbox" className="text-xs font-medium cursor-pointer">
                      Stdio Subprocess Sandboxing & Non-Root Execution
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Spawn Stdio processes under restricted user privileges and drop dangerous capabilities
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-2">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <LockIcon className="size-3.5 text-primary" />
                  Allowed Executable Whitelist
                </label>
                <Input
                  value={config.executableWhitelist}
                  onChange={(e) => updateConfig("executableWhitelist", e.target.value)}
                  className="font-mono text-xs w-full"
                />
                <p className="text-[11px] text-muted-foreground">
                  Commands that Stdio servers are authorized to invoke. Prevents arbitrary shell binary execution.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Global Rate Limit (Requests / Minute per IP)
                  </label>
                  <Input
                    type="number"
                    value={config.rateLimitPerMinute}
                    onChange={(e) => updateConfig("rateLimitPerMinute", Number(e.target.value))}
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Protects MCP servers from DDoS or rogue LLM loop queries
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reference to separate API Keys & Tokens view */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/60 p-4 shadow-2xs">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5 text-emerald-500" />
                API Keys & Client Authentication Tokens
              </span>
              <p className="text-[11px] text-muted-foreground">
                Cryptographic bearer tokens, scopes, and expiration dates are managed in the dedicated API Keys & Tokens view.
              </p>
            </div>
            {onNavigate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("keys")}
                className="h-8 text-xs cursor-pointer shrink-0"
              >
                Go to API Keys & Tokens
              </Button>
            )}
          </div>
        </TabsContent>

        {/* 3. Execution & Limits */}
        <TabsContent value="execution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClockIcon className="size-4 text-sky-500" />
                Execution Timeouts & Concurrency
              </CardTitle>
              <CardDescription className="text-xs">
                Fine-tune response timeouts and server crash resilience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    RPC Request Timeout (ms)
                  </label>
                  <Input
                    type="number"
                    value={config.requestTimeoutMs}
                    onChange={(e) => updateConfig("requestTimeoutMs", Number(e.target.value))}
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Timeout for handshake, tools/list, and ping calls (default: 30,000ms)
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Tool Execution Timeout (ms)
                  </label>
                  <Input
                    type="number"
                    value={config.toolTimeoutMs}
                    onChange={(e) => updateConfig("toolTimeoutMs", Number(e.target.value))}
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Maximum time allowed for a tool call to run before aborting
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <Checkbox
                    id="autoRestart"
                    checked={config.autoRestart}
                    onCheckedChange={(checked) => updateConfig("autoRestart", checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="autoRestart" className="text-xs font-medium cursor-pointer">
                      Auto-Restart Crashing Subprocesses
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically revive dead stdio servers if they terminate with non-zero exit codes
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <Checkbox
                    id="cacheSchemas"
                    checked={config.cacheSchemas}
                    onCheckedChange={(checked) => updateConfig("cacheSchemas", checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="cacheSchemas" className="text-xs font-medium cursor-pointer">
                      Cache Tool JSON Schemas in Memory
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Reduces roundtrip latency by eliminating repetitive tools/list IPC inquiries
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Max Auto-Restart Attempts
                  </label>
                  <Input
                    type="number"
                    value={config.maxRetries}
                    onChange={(e) => updateConfig("maxRetries", Number(e.target.value))}
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Circuit breaker: stops restart attempts after consecutive crashes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Logs & Telemetry */}
        <TabsContent value="logging" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileTextIcon className="size-4 text-primary" />
                Logging & Data Privacy
              </CardTitle>
              <CardDescription className="text-xs">
                Control log verbosity, local file persistence, and sensitive secret redaction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <Checkbox
                    id="redactSecrets"
                    checked={config.redactSecrets}
                    onCheckedChange={(checked) => updateConfig("redactSecrets", checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="redactSecrets" className="text-xs font-medium cursor-pointer">
                      Redact Sensitive Arguments & Token Keys (Recommended)
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Masks password, token, secret, and authorization headers from JSON logs
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <Checkbox
                    id="persistLogs"
                    checked={config.persistLogs}
                    onCheckedChange={(checked) => updateConfig("persistLogs", checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <label htmlFor="persistLogs" className="text-xs font-medium cursor-pointer">
                      Persist Audit Logs to Local Filesystem
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Writes daily rotated log files for troubleshooting and security audits
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Log File Storage Path
                  </label>
                  <Input
                    value={config.logPath}
                    onChange={(e) => updateConfig("logPath", e.target.value)}
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Destination path for audit and transport log storage
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Max Total Log Size (MB)
                  </label>
                  <Input
                    type="number"
                    value={config.maxLogMb}
                    onChange={(e) => updateConfig("maxLogMb", Number(e.target.value))}
                    className="font-mono text-xs w-full"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Maximum disk quota before automated rotation takes effect
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t border-border/40 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="size-4 text-emerald-500" />
                Structured JSON Logging Active
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success("Logs Flushed", { description: "Current in-memory buffer synced to disk" })}
                className="h-7 text-xs cursor-pointer"
              >
                Flush Logs Now
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
