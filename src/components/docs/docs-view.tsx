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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  BookOpenIcon,
  CopyIcon,
  CheckCircle2Icon,
  Code2Icon,
  RadioIcon,
  KeyRoundIcon,
  LockIcon,
} from "lucide-react"
import { toast } from "sonner"

export function DocsView() {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  const handleCopy = (code: string, key: string) => {
    navigator.clipboard.writeText(code)
    setCopiedKey(key)
    toast.success("Code Snippet Copied to Clipboard")
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const cursorJson = JSON.stringify(
    {
      mcpServers: {
        "mcp-gateway": {
          url: "http://127.0.0.1:8080/sse",
          headers: {
            Authorization: "Bearer <YOUR_GATEWAY_TOKEN>",
          },
        },
      },
    },
    null,
    2
  )

  const claudeDesktopJson = JSON.stringify(
    {
      mcpServers: {
        "mcp-gateway": {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-sse-client", "http://127.0.0.1:8080/sse"],
        },
      },
    },
    null,
    2
  )

  const pythonSnippet = `import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    headers = {"Authorization": "Bearer <YOUR_GATEWAY_TOKEN>"}
    async with sse_client("http://127.0.0.1:8080/sse", headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # List all tools aggregated by gateway
            tools = await session.list_tools()
            print(f"Connected to MCP Gateway. Available tools: {len(tools.tools)}")
            
            # Execute tool through gateway
            result = await session.call_tool("read_query", arguments={"query": "SELECT 1;"})
            print("Tool result:", result)

asyncio.run(main())`

  const tsSnippet = `import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("http://127.0.0.1:8080/sse"),
  {
    eventSourceInit: {
      headers: {
        Authorization: "Bearer <YOUR_GATEWAY_TOKEN>",
      },
    },
  }
);

const client = new Client(
  { name: "custom-agent", version: "1.0.0" },
  { capabilities: {} }
);

await client.connect(transport);
const tools = await client.listTools();
console.log("Connected to MCP Gateway tools:", tools);`

  const curlSnippet = `curl -X POST http://127.0.0.1:8080/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $GATEWAY_TOKEN" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "req-1",
    "method": "tools/call",
    "params": {
      "name": "list_tables",
      "arguments": {}
    }
  }'`

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <BookOpenIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">MCP Gateway Integration Guide</h2>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold text-xs">
                Protocol v1.0 Ready
              </Badge>
              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                Local SSE Listener: http://127.0.0.1:8080/sse
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Connect Cursor, Claude Desktop, Antigravity IDE, Python, and TypeScript agents to your unified MCP Gateway
            </p>
          </div>
        </div>
      </div>

      {/* Architecture Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <RadioIcon className="size-4 text-primary" />
              1. Unified SSE Hub
            </CardTitle>
            <CardDescription className="text-xs">
              Single SSE HTTP endpoint on port 8080 multiplexing all downstream MCP servers into one connection
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <LockIcon className="size-4 text-emerald-400" />
              2. Sandboxed Security
            </CardTitle>
            <CardDescription className="text-xs">
              Enforces RBAC tool permission matrix, filesystem path boundaries, and command injection defenses
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <KeyRoundIcon className="size-4 text-sky-400" />
              3. Bearer Guarded
            </CardTitle>
            <CardDescription className="text-xs">
              192-bit cryptographic bearer token validation for incoming client connections over loopback and LAN
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Client Setup Guides Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Code2Icon className="size-4 text-primary" />
            Client Configuration & Code Snippets
          </CardTitle>
          <CardDescription className="text-xs">
            Copy and paste integration configs directly into your LLM client or agent code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="cursor" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-9">
              <TabsTrigger value="cursor" className="cursor-pointer text-xs">
                Cursor
              </TabsTrigger>
              <TabsTrigger value="claude" className="cursor-pointer text-xs">
                Claude Desktop
              </TabsTrigger>
              <TabsTrigger value="python" className="cursor-pointer text-xs">
                Python SDK
              </TabsTrigger>
              <TabsTrigger value="typescript" className="cursor-pointer text-xs">
                TypeScript / Node
              </TabsTrigger>
              <TabsTrigger value="curl" className="cursor-pointer text-xs">
                cURL / HTTP
              </TabsTrigger>
            </TabsList>

            {/* Cursor */}
            <TabsContent value="cursor" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Paste into <code>~/.cursor/mcp.json</code>:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(cursorJson, "cursor")}
                  className="h-7 text-xs cursor-pointer gap-1"
                >
                  {copiedKey === "cursor" ? <CheckCircle2Icon className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                  <span>{copiedKey === "cursor" ? "Copied" : "Copy JSON"}</span>
                </Button>
              </div>
              <pre className="p-4 rounded-lg border bg-muted/40 font-mono text-xs overflow-x-auto text-foreground">
                {cursorJson}
              </pre>
            </TabsContent>

            {/* Claude Desktop */}
            <TabsContent value="claude" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Paste into <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(claudeDesktopJson, "claude")}
                  className="h-7 text-xs cursor-pointer gap-1"
                >
                  {copiedKey === "claude" ? <CheckCircle2Icon className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                  <span>{copiedKey === "claude" ? "Copied" : "Copy JSON"}</span>
                </Button>
              </div>
              <pre className="p-4 rounded-lg border bg-muted/40 font-mono text-xs overflow-x-auto text-foreground">
                {claudeDesktopJson}
              </pre>
            </TabsContent>

            {/* Python SDK */}
            <TabsContent value="python" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Requires <code>pip install mcp</code>:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(pythonSnippet, "python")}
                  className="h-7 text-xs cursor-pointer gap-1"
                >
                  {copiedKey === "python" ? <CheckCircle2Icon className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                  <span>{copiedKey === "python" ? "Copied" : "Copy Python"}</span>
                </Button>
              </div>
              <pre className="p-4 rounded-lg border bg-muted/40 font-mono text-xs overflow-x-auto text-foreground">
                {pythonSnippet}
              </pre>
            </TabsContent>

            {/* TypeScript */}
            <TabsContent value="typescript" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Requires <code>npm install @modelcontextprotocol/sdk</code>:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(tsSnippet, "typescript")}
                  className="h-7 text-xs cursor-pointer gap-1"
                >
                  {copiedKey === "typescript" ? <CheckCircle2Icon className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                  <span>{copiedKey === "typescript" ? "Copied" : "Copy TypeScript"}</span>
                </Button>
              </div>
              <pre className="p-4 rounded-lg border bg-muted/40 font-mono text-xs overflow-x-auto text-foreground">
                {tsSnippet}
              </pre>
            </TabsContent>

            {/* cURL */}
            <TabsContent value="curl" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Direct HTTP JSON-RPC 2.0 invocation via terminal:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(curlSnippet, "curl")}
                  className="h-7 text-xs cursor-pointer gap-1"
                >
                  {copiedKey === "curl" ? <CheckCircle2Icon className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                  <span>{copiedKey === "curl" ? "Copied" : "Copy cURL"}</span>
                </Button>
              </div>
              <pre className="p-4 rounded-lg border bg-muted/40 font-mono text-xs overflow-x-auto text-foreground">
                {curlSnippet}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
