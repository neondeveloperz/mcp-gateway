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
} from "lucide-react"
import { toast } from "sonner"

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

export function SettingsView() {
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
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full">
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="cursor-pointer gap-1.5 text-xs"
          >
            <DownloadIcon className="size-3.5" />
            <span>Export JSON</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="cursor-pointer gap-1.5 text-xs"
          >
            <RotateCcwIcon className="size-3.5" />
            <span>Reset</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="cursor-pointer gap-1.5 bg-primary text-primary-foreground text-xs font-medium"
          >
            <SaveIcon className="size-3.5" />
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
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
            Daemon PID
          </span>
          <p className="font-mono text-xs font-semibold text-foreground">
            34821 (Core Worker)
          </p>
        </div>
        <div className="rounded-lg border bg-card/40 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <HardDriveIcon className="size-3.5 text-sky-500" />
            Resident Memory
          </span>
          <p className="font-mono text-xs font-semibold text-foreground">
            48.2 MB / 512 MB
          </p>
        </div>
        <div className="rounded-lg border bg-card/40 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <ClockIcon className="size-3.5 text-amber-500" />
            Gateway Uptime
          </span>
          <p className="font-mono text-xs font-semibold text-foreground">
            4h 12m 38s
          </p>
        </div>
      </div>

      {/* Categorized Settings Tabs */}
      <Tabs defaultValue="network" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-9">
          <TabsTrigger value="network" className="cursor-pointer gap-1.5 text-xs">
            <NetworkIcon className="size-3.5" />
            <span>Network & Ports</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="cursor-pointer gap-1.5 text-xs">
            <ShieldCheckIcon className="size-3.5" />
            <span>Security & Auth</span>
          </TabsTrigger>
          <TabsTrigger value="execution" className="cursor-pointer gap-1.5 text-xs">
            <ClockIcon className="size-3.5" />
            <span>Execution & Limits</span>
          </TabsTrigger>
          <TabsTrigger value="logging" className="cursor-pointer gap-1.5 text-xs">
            <FileTextIcon className="size-3.5" />
            <span>Logs & Telemetry</span>
          </TabsTrigger>
        </TabsList>

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
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Bind Host Address
                  </label>
                  <Input
                    value={config.host}
                    onChange={(e) => updateConfig("host", e.target.value)}
                    placeholder="127.0.0.1"
                    className="font-mono text-xs"
                  />
                  {isPublicHost ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mt-1">
                      <AlertTriangleIcon className="size-3 shrink-0" />
                      <span>Warning: 0.0.0.0 exposes the gateway to local network interfaces</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Recommended: 127.0.0.1 (Localhost only) for maximum security
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    HTTP / SSE Port
                  </label>
                  <Input
                    type="number"
                    value={config.port}
                    onChange={(e) => updateConfig("port", Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Default port is 8080. Ensure port is not occupied.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    SSE Endpoint Route
                  </label>
                  <Input
                    value={config.ssePath}
                    onChange={(e) => updateConfig("ssePath", e.target.value)}
                    placeholder="/sse"
                    className="font-mono text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Path where AI agents establish Server-Sent Events stream
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Allowed CORS Origins
                  </label>
                  <Input
                    value={config.corsOrigins}
                    onChange={(e) => updateConfig("corsOrigins", e.target.value)}
                    placeholder="*"
                    className="font-mono text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Use * for all or comma-separated origins (e.g. http://localhost:3000)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Keep-Alive Heartbeat (Seconds)
                  </label>
                  <Input
                    type="number"
                    value={config.keepAliveSeconds}
                    onChange={(e) => updateConfig("keepAliveSeconds", Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Prevents connection drops across persistent agent sessions
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Max Request Payload (MB)
                  </label>
                  <Input
                    type="number"
                    value={config.maxPayloadMb}
                    onChange={(e) => updateConfig("maxPayloadMb", Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Maximum body size for incoming tool argument payloads
                  </span>
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
            <CardContent className="space-y-5">
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

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <LockIcon className="size-3.5 text-primary" />
                  Allowed Executable Whitelist
                </label>
                <Input
                  value={config.executableWhitelist}
                  onChange={(e) => updateConfig("executableWhitelist", e.target.value)}
                  className="font-mono text-xs"
                />
                <span className="text-[11px] text-muted-foreground">
                  Commands that Stdio servers are authorized to invoke. Prevents arbitrary shell binary execution.
                </span>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-medium text-foreground">
                  Global Rate Limit (Requests / Minute per IP)
                </label>
                <Input
                  type="number"
                  value={config.rateLimitPerMinute}
                  onChange={(e) => updateConfig("rateLimitPerMinute", Number(e.target.value))}
                  className="font-mono text-xs max-w-xs"
                />
                <span className="text-[11px] text-muted-foreground">
                  Protects MCP servers from DDoS or rogue LLM loop queries
                </span>
              </div>
            </CardContent>
          </Card>
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
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    RPC Request Timeout (ms)
                  </label>
                  <Input
                    type="number"
                    value={config.requestTimeoutMs}
                    onChange={(e) => updateConfig("requestTimeoutMs", Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Timeout for handshake, tools/list, and ping calls (default: 30,000ms)
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Tool Execution Timeout (ms)
                  </label>
                  <Input
                    type="number"
                    value={config.toolTimeoutMs}
                    onChange={(e) => updateConfig("toolTimeoutMs", Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Maximum time allowed for a tool call to run before aborting
                  </span>
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

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-medium text-foreground">
                  Max Auto-Restart Attempts
                </label>
                <Input
                  type="number"
                  value={config.maxRetries}
                  onChange={(e) => updateConfig("maxRetries", Number(e.target.value))}
                  className="font-mono text-xs max-w-xs"
                />
                <span className="text-[11px] text-muted-foreground">
                  Circuit breaker: stops restart attempts after consecutive crashes
                </span>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Log File Storage Path
                  </label>
                  <Input
                    value={config.logPath}
                    onChange={(e) => updateConfig("logPath", e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Max Total Log Size (MB)
                  </label>
                  <Input
                    type="number"
                    value={config.maxLogMb}
                    onChange={(e) => updateConfig("maxLogMb", Number(e.target.value))}
                    className="font-mono text-xs"
                  />
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
