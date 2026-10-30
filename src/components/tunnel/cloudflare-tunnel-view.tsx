import * as React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  GlobeIcon,
  PlayIcon,
  SquareIcon,
  RotateCwIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TerminalIcon,
  AlertTriangleIcon,
  RadioIcon,
  KeyRoundIcon,
  LaptopIcon,
  ServerIcon,
  ArrowDownIcon,
  LockIcon,
  ActivityIcon,
  CpuIcon,
  NetworkIcon,
  ShieldAlertIcon,
  LayersIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  fetchCloudflareTunnelStatus,
  startCloudflareTunnel,
  stopCloudflareTunnel,
  type CloudflareTunnelStatus,
} from "@/lib/mcp-service"

export function CloudflareTunnelView() {
  const [status, setStatus] = React.useState<CloudflareTunnelStatus>({
    isInstalled: false,
    isRunning: false,
    mode: "quick",
  })
  const [mode, setMode] = React.useState<"quick" | "token">("quick")
  const [token, setToken] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [copiedUrl, setCopiedUrl] = React.useState(false)
  const [copiedConfig, setCopiedConfig] = React.useState(false)
  const [copiedInstall, setCopiedInstall] = React.useState(false)
  const [copiedIdeTab, setCopiedIdeTab] = React.useState<string | null>(null)

  const reloadStatus = React.useCallback(async () => {
    try {
      const s = await fetchCloudflareTunnelStatus()
      setStatus(s)
      if (s.mode === "token" || s.mode === "quick") {
        setMode(s.mode)
      }
    } catch {
      // ignore
    }
  }, [])

  React.useEffect(() => {
    reloadStatus()
    const timer = setInterval(reloadStatus, 5000)
    return () => clearInterval(timer)
  }, [reloadStatus])

  const handleStart = async () => {
    setLoading(true)
    try {
      if (mode === "token" && !token.trim()) {
        toast.error("Please enter your Cloudflare Tunnel Token")
        setLoading(false)
        return
      }

      await startCloudflareTunnel(mode, mode === "token" ? token.trim() : undefined)
      toast.success(
        mode === "quick"
          ? "Quick Tunnel Started! Connecting to Cloudflare..."
          : "Named Tunnel Started!"
      )
      setTimeout(reloadStatus, 1500)
    } catch (err) {
      toast.error(`Start Failed: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await stopCloudflareTunnel()
      toast.success("Cloudflare Tunnel Stopped")
      reloadStatus()
    } catch (err) {
      toast.error(`Stop Failed: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string, type: "url" | "config" | "install") => {
    navigator.clipboard.writeText(text)
    if (type === "url") {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
      toast.success("Tunnel URL Copied")
    } else if (type === "config") {
      setCopiedConfig(true)
      setTimeout(() => setCopiedConfig(false), 2000)
      toast.success("Remote MCP Config Copied")
    } else {
      setCopiedInstall(true)
      setTimeout(() => setCopiedInstall(false), 2000)
      toast.success("Install Command Copied")
    }
  }

  const handleCopyIdeSnippet = (tabKey: string, snippetText: string) => {
    navigator.clipboard.writeText(snippetText)
    setCopiedIdeTab(tabKey)
    setTimeout(() => setCopiedIdeTab(null), 2000)
    toast.success(`${tabKey.toUpperCase()} Config Copied`)
  }

  const publicEndpoint = status.publicUrl ? `${status.publicUrl}/mcp` : ""
  const displayEndpoint = publicEndpoint || "https://<your-subdomain>.trycloudflare.com/mcp"

  const cursorSnippet = JSON.stringify(
    {
      mcpServers: {
        "mcp-gateway-remote": {
          url: displayEndpoint,
        },
      },
    },
    null,
    2
  )

  const antigravitySnippet = JSON.stringify(
    {
      mcpServers: {
        "mcp-gateway-remote": {
          type: "sse",
          url: displayEndpoint,
        },
      },
    },
    null,
    2
  )

  const claudeSnippet = JSON.stringify(
    {
      mcpServers: {
        "mcp-gateway-remote": {
          url: displayEndpoint,
        },
      },
    },
    null,
    2
  )

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full min-w-0 max-w-full">
      {/* Top Header Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20">
            <GlobeIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Cloudflare Zero Trust Tunnel</h2>
              {status.isRunning ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1.5 font-medium">
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>ACTIVE INGRESS</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-xs gap-1.5">
                  <span className="size-2 rounded-full bg-muted-foreground/40" />
                  <span>STOPPED</span>
                </Badge>
              )}
              {status.isInstalled ? (
                <Badge variant="outline" className="font-mono text-[10px] text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                  cloudflared: Ready
                </Badge>
              ) : (
                <Badge variant="outline" className="font-mono text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/5">
                  CLI Not Detected
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                Port :8080
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] text-sky-500 border-sky-500/20 bg-sky-500/5">
                TLS 1.3 Ingress
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Encrypted remote ingress to connect Cursor & Antigravity on your laptop to this Gateway from anywhere without opening router ports.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 self-start md:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={reloadStatus}
            className="cursor-pointer gap-1.5 text-xs h-8 px-2 sm:px-3"
            title="Refresh Tunnel Status"
          >
            <RotateCwIcon className="size-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {status.isRunning ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={loading}
              onClick={handleStop}
              className="cursor-pointer gap-1.5 text-xs h-8 px-2 sm:px-3"
              title="Stop Tunnel"
            >
              <SquareIcon className="size-3.5" />
              <span className="hidden sm:inline">Stop Tunnel</span>
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={loading || !status.isInstalled}
              onClick={handleStart}
              className="cursor-pointer gap-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs h-8 px-2 sm:px-3"
              title="Start Cloudflare Tunnel"
            >
              <PlayIcon className="size-3.5" />
              <span className="hidden sm:inline">Start Tunnel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Left Column (7 cols): Ingress Controller, Active Endpoints, and Laptop IDE Guides */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* Main Tunnel Controls Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <RadioIcon className="size-4 text-orange-500" />
                  Tunnel Ingress Controller
                </CardTitle>
                <Badge variant="outline" className="text-[11px] font-mono">
                  Target: 127.0.0.1:8080
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Forward incoming encrypted remote MCP requests directly into your local desktop Gateway Core
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  onClick={() => !status.isRunning && setMode("quick")}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                    mode === "quick"
                      ? "border-orange-500/50 bg-orange-500/5 ring-1 ring-orange-500/20"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <SparklesIcon className="size-3.5 text-orange-500" />
                      Quick Tunnel (trycloudflare.com)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-muted/50">
                      Instant & Free
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Spawns an instant public HTTPS tunnel. No Cloudflare account, domain, or payment required.
                  </p>
                </div>

                <div
                  onClick={() => !status.isRunning && setMode("token")}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                    mode === "token"
                      ? "border-orange-500/50 bg-orange-500/5 ring-1 ring-orange-500/20"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <KeyRoundIcon className="size-3.5 text-sky-500" />
                      Named Tunnel (Zero Trust Token)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-muted/50">
                      Custom Domain
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Use your persistent Cloudflare Tunnel Token to bind to your own custom domain (e.g. mcp.company.com).
                  </p>
                </div>
              </div>

              {mode === "token" && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-medium text-foreground">
                    Cloudflare Tunnel Token:
                  </label>
                  <Input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={status.isRunning}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Local Service:</span>
                  <code className="font-mono text-foreground font-semibold bg-muted px-2 py-0.5 rounded">
                    http://127.0.0.1:8080
                  </code>
                </div>

                <div className="flex items-center gap-2">
                  {status.isRunning ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={loading}
                      onClick={handleStop}
                      className="cursor-pointer gap-1.5 text-xs h-8"
                    >
                      <SquareIcon className="size-3.5" />
                      <span>Stop Tunnel</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={loading || !status.isInstalled}
                      onClick={handleStart}
                      className="cursor-pointer gap-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs h-8"
                    >
                      <PlayIcon className="size-3.5" />
                      <span>Start Cloudflare Tunnel</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Remote Ingress Card */}
          {status.isRunning && status.publicUrl && (
            <Card className="border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-emerald-400 flex items-center gap-2">
                    <GlobeIcon className="size-4" />
                    Live Remote Ingress Endpoint
                  </CardTitle>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                    HTTPS Encrypted
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Copy this public endpoint and paste it into your laptop's Cursor or Antigravity configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border/80 bg-background/80 gap-3">
                  <div className="space-y-0.5 overflow-hidden">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Public Tunnel Endpoint (Remote Ingress)
                    </span>
                    <p className="font-mono text-xs sm:text-sm font-bold text-foreground truncate">
                      {publicEndpoint}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(publicEndpoint, "url")}
                      className="cursor-pointer gap-1 text-xs h-7"
                    >
                      {copiedUrl ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                      <span>Copy URL</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => status.publicUrl && window.open(status.publicUrl, "_blank")}
                      className="size-7 cursor-pointer"
                      title="Open Tunnel in Browser"
                    >
                      <ExternalLinkIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Direct Remote JSON Snippet */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <TerminalIcon className="size-3.5 text-primary" />
                      Remote MCP Client JSON:
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(cursorSnippet, "config")}
                      className="cursor-pointer gap-1 text-xs h-7"
                    >
                      {copiedConfig ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                      <span>Copy JSON</span>
                    </Button>
                  </div>
                  <pre className="rounded-lg border border-border/80 bg-muted/60 p-3 font-mono text-xs text-foreground/90 overflow-x-auto">
                    {cursorSnippet}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cloudflared Not Installed Card (if CLI missing) */}
          {!status.isInstalled && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-500">
                  <AlertTriangleIcon className="size-4" />
                  cloudflared CLI Required
                </CardTitle>
                <CardDescription className="text-xs">
                  Install the official Cloudflare tunnel daemon on this Mac to enable automatic tunnel orchestration.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/50">
                  <code className="font-mono text-xs text-foreground">
                    brew install cloudflared
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy("brew install cloudflared", "install")}
                    className="cursor-pointer gap-1 text-xs h-7"
                  >
                    {copiedInstall ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                    <span>Copy Command</span>
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Once installed via Homebrew, click <strong>Refresh</strong> above to detect the binary and start your tunnel immediately.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Remote Laptop IDE Quick Setup Guides */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <LaptopIcon className="size-4 text-primary" />
                Laptop IDE Setup Guide (Remote Connection)
              </CardTitle>
              <CardDescription className="text-xs">
                Select your remote IDE on your laptop to view the exact config file and code to paste
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="cursor" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="cursor" className="text-xs">
                    Cursor IDE
                  </TabsTrigger>
                  <TabsTrigger value="antigravity" className="text-xs">
                    Antigravity
                  </TabsTrigger>
                  <TabsTrigger value="claude" className="text-xs">
                    Claude Desktop
                  </TabsTrigger>
                </TabsList>

                {/* Cursor IDE Tab */}
                <TabsContent value="cursor" className="space-y-3 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Config File: <code className="font-mono text-foreground font-semibold">~/.cursor/mcp.json</code> or Settings &gt; Features &gt; MCP
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyIdeSnippet("cursor", cursorSnippet)}
                      className="cursor-pointer gap-1 text-xs h-7"
                    >
                      {copiedIdeTab === "cursor" ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                      <span>Copy Config</span>
                    </Button>
                  </div>
                  <pre className="rounded-lg border border-border/80 bg-muted/60 p-3 font-mono text-xs text-foreground/90 overflow-x-auto">
                    {cursorSnippet}
                  </pre>
                </TabsContent>

                {/* Google Antigravity Tab */}
                <TabsContent value="antigravity" className="space-y-3 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Config File: <code className="font-mono text-foreground font-semibold">~/.gemini/config/mcp_config.json</code>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyIdeSnippet("antigravity", antigravitySnippet)}
                      className="cursor-pointer gap-1 text-xs h-7"
                    >
                      {copiedIdeTab === "antigravity" ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                      <span>Copy Config</span>
                    </Button>
                  </div>
                  <pre className="rounded-lg border border-border/80 bg-muted/60 p-3 font-mono text-xs text-foreground/90 overflow-x-auto">
                    {antigravitySnippet}
                  </pre>
                </TabsContent>

                {/* Claude Desktop Tab */}
                <TabsContent value="claude" className="space-y-3 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Config File: <code className="font-mono text-foreground font-semibold">claude_desktop_config.json</code>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyIdeSnippet("claude", claudeSnippet)}
                      className="cursor-pointer gap-1 text-xs h-7"
                    >
                      {copiedIdeTab === "claude" ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                      <span>Copy Config</span>
                    </Button>
                  </div>
                  <pre className="rounded-lg border border-border/80 bg-muted/60 p-3 font-mono text-xs text-foreground/90 overflow-x-auto">
                    {claudeSnippet}
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols): Architecture Topology, Hybrid Guardrails, and Network Specs */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {/* Visual Architecture & Topology Card */}
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <LayersIcon className="size-4 text-sky-400" />
                  Remote Ingress Topology
                </CardTitle>
                <Badge variant="outline" className="text-[10px] text-sky-400 border-sky-400/30">
                  Zero Router Ports
                </Badge>
              </div>
              <CardDescription className="text-xs">
                How external requests flow from your laptop into this Gateway securely
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Topology Steps */}
              <div className="relative space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3.5 text-xs">
                {/* Step 1: Remote Laptop */}
                <div className="flex items-center gap-3 p-2 rounded-md bg-background/80 border border-border/60">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
                    <LaptopIcon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">Remote Laptop (Outside Home)</p>
                    <p className="text-[10px] text-muted-foreground truncate">Cursor / Antigravity Agent calls MCP</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">Client</Badge>
                </div>

                <div className="flex justify-center text-muted-foreground/60 py-0.5">
                  <ArrowDownIcon className="size-3.5 animate-bounce" />
                </div>

                {/* Step 2: Cloudflare Edge */}
                <div className="flex items-center gap-3 p-2 rounded-md bg-background/80 border border-orange-500/30 bg-orange-500/5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20">
                    <GlobeIcon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">Cloudflare Global Edge</p>
                    <p className="text-[10px] text-muted-foreground truncate">TLS 1.3 Termination & DDoS Shield</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-orange-500 border-orange-500/30 shrink-0">Edge</Badge>
                </div>

                <div className="flex justify-center text-muted-foreground/60 py-0.5">
                  <ArrowDownIcon className="size-3.5" />
                </div>

                {/* Step 3: Desktop Gateway Core */}
                <div className="flex items-center gap-3 p-2 rounded-md bg-background/80 border border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                    <ServerIcon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">This Mac Gateway Core (:8080)</p>
                    <p className="text-[10px] text-muted-foreground truncate">HITL Guardrails & Circuit Breaker</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30 shrink-0">Gateway</Badge>
                </div>

                <div className="flex justify-center text-muted-foreground/60 py-0.5">
                  <ArrowDownIcon className="size-3.5" />
                </div>

                {/* Step 4: Downstream Servers */}
                <div className="flex items-center gap-3 p-2 rounded-md bg-background/80 border border-border/60">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
                    <CpuIcon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">Downstream MCP Services</p>
                    <p className="text-[10px] text-muted-foreground truncate">Coolify, Easypanel, Docker, DBs</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-400/30 shrink-0">Target</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zero Trust & Hybrid Guardrails Card */}
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                <ShieldCheckIcon className="size-4" />
                Zero Trust & Hybrid Guardrails
              </CardTitle>
              <CardDescription className="text-xs">
                Active defense layers protecting your home desktop from malicious or runaway agent executions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 p-2 rounded-lg border border-border/40 bg-muted/20">
                <ShieldAlertIcon className="size-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">In-Band Chat Challenge (#SEC-XXXX)</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Destructive tool calls from your remote laptop pause immediately and generate a one-time approval ticket directly in your IDE chat.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-lg border border-border/40 bg-muted/20">
                <ActivityIcon className="size-4 text-sky-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">Circuit Breaker & Anti-Loop</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Stops recursive loops at 5 calls / 10s. Automatically trips and isolates downstream servers if 3 consecutive failures occur.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-lg border border-border/40 bg-muted/20">
                <LockIcon className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">Zero Secrets In Logs</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Bearer tokens, private keys, passwords, and sensitive headers are redacted in real-time before entering traffic records.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingress Network Telemetry */}
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <NetworkIcon className="size-4 text-muted-foreground" />
                Ingress Network Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded border border-border/40 bg-muted/20">
                  <span className="text-muted-foreground block text-[10px]">Ingress Protocol</span>
                  <span className="font-mono font-semibold text-foreground">QUIC / HTTP2</span>
                </div>
                <div className="p-2 rounded border border-border/40 bg-muted/20">
                  <span className="text-muted-foreground block text-[10px]">Edge Encryption</span>
                  <span className="font-mono font-semibold text-emerald-400">TLS 1.3</span>
                </div>
                <div className="p-2 rounded border border-border/40 bg-muted/20">
                  <span className="text-muted-foreground block text-[10px]">Router Port Exposure</span>
                  <span className="font-mono font-semibold text-emerald-400">0 Ports (Closed)</span>
                </div>
                <div className="p-2 rounded border border-border/40 bg-muted/20">
                  <span className="text-muted-foreground block text-[10px]">HITL Protection</span>
                  <span className="font-mono font-semibold text-amber-400">Hybrid Active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
