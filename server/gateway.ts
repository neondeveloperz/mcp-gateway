/**
 * MCP Gateway Core Server
 *
 * Multiplexes downstream MCP servers into a single unified MCP endpoint.
 * Supports SSE transport (GET /sse + POST /messages?sessionId=...)
 * and direct HTTP transport (POST /mcp or POST /).
 */

import { existsSync, readFileSync, appendFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

interface ServerConfig {
  url?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
}

interface ServersFile {
  mcpServers?: Record<string, ServerConfig>
}

interface JsonRpcRequest {
  jsonrpc: string
  id?: string | number
  method: string
  params?: {
    name?: string
    arguments?: Record<string, unknown>
    [key: string]: unknown
  }
}

interface ToolDefinition {
  name: string
  title?: string
  description?: string
  inputSchema?: Record<string, unknown>
  _server?: string
  [key: string]: unknown
}

interface DownstreamListResult {
  result?: {
    tools?: ToolDefinition[]
  }
}

interface ToolCallResponse {
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

const PORT = Number(process.env.PORT || 8080)
const HOST = process.env.HOST || "127.0.0.1"
const CONFIG_PATH = join(homedir(), ".mcp-gateway", "servers.json")
const LOG_PATH = join(homedir(), ".mcp-gateway", "logs", "gateway.log")

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try {
    appendFileSync(LOG_PATH, line + "\n")
  } catch {
    // ignore
  }
}

// Load downstream servers from ~/.mcp-gateway/servers.json
function loadServers(): Record<string, ServerConfig> {
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, "utf-8")
      const parsed: ServersFile = JSON.parse(raw)
      if (parsed.mcpServers) {
        return parsed.mcpServers
      }
    } catch (e) {
      log(`Failed to read ${CONFIG_PATH}: ${e}`)
    }
  }

  // Fallback default: Coolify
  return {
    Coolify: {
      url: "http://45.136.237.171:8000/mcp",
      headers: {
        Authorization: "Bearer 6|MCACWwGmqtm54HnQSXbDVD8g9NoI29qREODfpi6t926a1ded",
      },
    },
  }
}

// Active SSE client sessions
interface SseSession {
  id: string
  controller: ReadableStreamDefaultController<Uint8Array>
}
const activeSessions = new Map<string, SseSession>()

// Fetch tools from downstream server
async function fetchDownstreamTools(serverName: string, config: ServerConfig): Promise<ToolDefinition[]> {
  if (!config.url) return []
  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.headers || {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `list-${Date.now()}`,
        method: "tools/list",
        params: {},
      }),
    })
    if (!res.ok) {
      log(`Downstream ${serverName} returned ${res.status}`)
      return []
    }
    const json = (await res.json()) as DownstreamListResult
    const tools = json?.result?.tools || []
    log(`Fetched ${tools.length} tools from downstream '${serverName}'`)
    return tools.map((t) => ({
      ...t,
      _server: serverName,
    }))
  } catch (err) {
    log(`Error fetching tools from ${serverName}: ${err}`)
    return []
  }
}

// Call tool on downstream server
async function callDownstreamTool(
  toolName: string,
  args: Record<string, unknown>,
  servers: Record<string, ServerConfig>
): Promise<ToolCallResponse> {
  // Direct attempt on each server
  for (const [name, config] of Object.entries(servers)) {
    if (!config.url) continue
    try {
      log(`Forwarding tool call '${toolName}' to downstream server '${name}'`)
      const res = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `call-${Date.now()}`,
          method: "tools/call",
          params: {
            name: toolName,
            arguments: args,
          },
        }),
      })
      const json = (await res.json()) as ToolCallResponse
      if (json.result || json.error) {
        return json
      }
    } catch (err) {
      log(`Error calling tool on ${name}: ${err}`)
    }
  }

  return {
    error: {
      code: -32601,
      message: `Tool '${toolName}' not found on any downstream server`,
    },
  }
}

// Handle JSON-RPC Message
async function handleJsonRpc(
  body: JsonRpcRequest,
  servers: Record<string, ServerConfig>
): Promise<unknown> {
  const { id, method, params } = body

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: true },
            resources: { listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: "mcp-gateway",
            version: "1.0.0",
          },
        },
      }

    case "notifications/initialized":
      return null // notification, no reply needed

    case "ping":
      return {
        jsonrpc: "2.0",
        id,
        result: {},
      }

    case "tools/list": {
      const allTools: ToolDefinition[] = []
      for (const [name, cfg] of Object.entries(servers)) {
        const tools = await fetchDownstreamTools(name, cfg)
        allTools.push(...tools)
      }
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: allTools,
        },
      }
    }

    case "tools/call": {
      const toolName = params?.name || ""
      const args = params?.arguments || {}
      const res = await callDownstreamTool(toolName, args, servers)
      return {
        jsonrpc: "2.0",
        id,
        ...res,
      }
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method '${method}' not implemented in Gateway Core`,
        },
      }
  }
}

export const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url)
    const method = req.method

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      })
    }

    // Health check / Root
    if (url.pathname === "/" && method === "GET") {
      const servers = loadServers()
      return Response.json({
        status: "healthy",
        gateway: "mcp-gateway",
        version: "1.0.0",
        port: PORT,
        activeDownstreamServers: Object.keys(servers),
        sseEndpoint: `http://${HOST}:${PORT}/sse`,
      })
    }

    // SSE Transport: GET /sse
    if (url.pathname === "/sse" && method === "GET") {
      const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      log(`New SSE client connected: sessionId=${sessionId}`)

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          activeSessions.set(sessionId, { id: sessionId, controller })

          // Send endpoint event according to MCP specification
          const endpointEvent = `event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`
          controller.enqueue(new TextEncoder().encode(endpointEvent))

          // Heartbeat keep-alive every 15 seconds
          const interval = setInterval(() => {
            if (activeSessions.has(sessionId)) {
              try {
                controller.enqueue(new TextEncoder().encode(": keep-alive\n\n"))
              } catch {
                clearInterval(interval)
                activeSessions.delete(sessionId)
              }
            } else {
              clearInterval(interval)
            }
          }, 15000)
        },
        cancel() {
          log(`SSE client disconnected: sessionId=${sessionId}`)
          activeSessions.delete(sessionId)
        },
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    // SSE Message endpoint: POST /messages?sessionId=...
    if (url.pathname === "/messages" && method === "POST") {
      const sessionId = url.searchParams.get("sessionId")
      const session = sessionId ? activeSessions.get(sessionId) : undefined

      let body: JsonRpcRequest
      try {
        body = (await req.json()) as JsonRpcRequest
      } catch {
        return new Response("Invalid JSON", { status: 400 })
      }

      const servers = loadServers()
      const reply = await handleJsonRpc(body, servers)

      // If SSE session exists, send reply down the SSE pipe
      if (session && reply) {
        const sseData = `event: message\ndata: ${JSON.stringify(reply)}\n\n`
        session.controller.enqueue(new TextEncoder().encode(sseData))
        return new Response("Accepted", {
          status: 202,
          headers: { "Access-Control-Allow-Origin": "*" },
        })
      }

      // Fallback: return JSON directly
      return Response.json(reply || { status: "ok" }, {
        headers: { "Access-Control-Allow-Origin": "*" },
      })
    }

    // Direct HTTP JSON-RPC endpoint: POST /mcp or POST /
    if ((url.pathname === "/mcp" || url.pathname === "/") && method === "POST") {
      let body: JsonRpcRequest
      try {
        body = (await req.json()) as JsonRpcRequest
      } catch {
        return new Response("Invalid JSON", { status: 400 })
      }

      const servers = loadServers()
      const reply = await handleJsonRpc(body, servers)
      return Response.json(reply || { status: "ok" }, {
        headers: { "Access-Control-Allow-Origin": "*" },
      })
    }

    return new Response("Not Found", { status: 404 })
  },
})

log(`🚀 MCP Gateway Core running on http://${HOST}:${PORT}`)
log(`📡 Local SSE Listener: http://${HOST}:${PORT}/sse`)
log(`📋 Downstream servers: ${Object.keys(loadServers()).join(", ")}`)
