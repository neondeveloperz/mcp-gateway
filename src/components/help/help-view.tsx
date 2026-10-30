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
import {
  CircleHelpIcon,
  DownloadIcon,
  ExternalLinkIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  LifeBuoyIcon,
} from "lucide-react"
import { toast } from "sonner"
import { fetchSystemInfo, fetchDiscoveredServers } from "@/lib/mcp-service"

export function HelpView() {
  const [isExporting, setIsExporting] = React.useState(false)

  const handleExportDiagnostics = async () => {
    setIsExporting(true)
    const [sys, srvs] = await Promise.all([fetchSystemInfo(), fetchDiscoveredServers()])

    const sanitizedBundle = {
      app: "MCP Gateway Desktop Core",
      version: "0.1.0",
      generatedAt: new Date().toISOString(),
      system: {
        os: sys.os,
        arch: sys.arch,
        pid: sys.pid,
        uptimeSecs: sys.uptimeSecs,
      },
      servers: srvs.map((s) => ({
        name: s.name,
        transport: s.transport,
        status: s.status,
        latencyMs: s.latencyMs,
        toolsCount: s.toolsCount,
      })),
      gatewayPort: 8080,
      protocol: "JSON-RPC 2.0 / SSE",
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sanitizedBundle, null, 2))
    const downloadAnchor = document.createElement("a")
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `mcp_gateway_diagnostics_${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    setIsExporting(false)
    toast.success("Diagnostics Bundle Exported", {
      description: "Sanitized telemetry file saved to Downloads",
    })
  }

  const troubleshootingItems = [
    {
      title: "Port 8080 is already bound or in use",
      symptom: "Gateway server cannot start listening on 127.0.0.1:8080",
      solution: "Change the SSE/HTTP Port in Gateway Settings, or terminate the existing process using `lsof -i :8080` followed by `kill -9 <PID>`.",
    },
    {
      title: "Stdio child process failed to start (ENOENT)",
      symptom: "Tools show status error when launching Stdio servers (e.g. npx, uvx, python3)",
      solution: "Ensure the executable binary is accessible within your user PATH. On macOS, specify absolute paths or ensure node/bun is linked in `/usr/local/bin` or `/opt/homebrew/bin`.",
    },
    {
      title: "401 Unauthorized / Invalid Bearer Token",
      symptom: "Cursor or AI agent receives HTTP 401 when connecting to /sse",
      solution: "Generate a new cryptographic bearer token in 'API Keys & Tokens' page and pass it in the `Authorization: Bearer <TOKEN>` request header.",
    },
    {
      title: "Docker container daemon unreachable",
      symptom: "Docker MCP server fails with socket connection refused",
      solution: "Ensure Docker Desktop is launched and running. Verify socket access at `/var/run/docker.sock`.",
    },
  ]

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <CircleHelpIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Support & Troubleshooting Hub</h2>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-semibold text-xs">
                Self-Healing Diagnostics
              </Badge>
              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                Sanitized Log Export
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Diagnose common connection hurdles, export sanitised crash logs, and access developer documentation
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleExportDiagnostics}
            disabled={isExporting}
            className="cursor-pointer gap-1.5 bg-primary text-primary-foreground font-medium text-xs h-8"
          >
            <DownloadIcon className="size-3.5" />
            <span>{isExporting ? "Exporting..." : "Export Diagnostic Bundle"}</span>
          </Button>
        </div>
      </div>

      {/* Troubleshooting Guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {troubleshootingItems.map((item, idx) => (
          <Card key={idx} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <AlertTriangleIcon className="size-4 text-amber-500 shrink-0" />
                <span>{item.title}</span>
              </div>
              <CardDescription className="text-xs pt-1">
                <strong>Symptom:</strong> {item.symptom}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2Icon className="size-3 text-emerald-400" />
                  Recommended Resolution
                </span>
                <p className="text-[11px] leading-relaxed">{item.solution}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Resources & Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <LifeBuoyIcon className="size-4 text-primary" />
            Official Specifications & Documentation Links
          </CardTitle>
          <CardDescription className="text-xs">
            Standard references for Model Context Protocol development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3.5 space-y-2 bg-muted/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">MCP Specification</span>
                <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Official protocol reference for JSON-RPC 2.0 schema, tools, and resources.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Opening modelcontextprotocol.io")}
                className="w-full text-xs h-7 cursor-pointer"
              >
                modelcontextprotocol.io
              </Button>
            </div>

            <div className="rounded-lg border p-3.5 space-y-2 bg-muted/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Cursor MCP Guide</span>
                <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Instructions on connecting Cursor AI editor to remote and SSE MCP servers.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Opening docs.cursor.com/context/model-context-protocol")}
                className="w-full text-xs h-7 cursor-pointer"
              >
                Cursor Documentation
              </Button>
            </div>

            <div className="rounded-lg border p-3.5 space-y-2 bg-muted/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Claude Desktop Config</span>
                <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Setup guide for Anthropic Claude Desktop and stdio/SSE bridging.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Opening support.anthropic.com")}
                className="w-full text-xs h-7 cursor-pointer"
              >
                Anthropic Support
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
          <span>Diagnostics bundle does not contain private keys or bearer tokens</span>
          <span>Version: 0.1.0-alpha</span>
        </CardFooter>
      </Card>
    </div>
  )
}
