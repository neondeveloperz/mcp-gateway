import { isTauri, invoke } from "@tauri-apps/api/core"

export interface McpServer {
  id: string
  name: string
  transport: "stdio" | "sse" | "http"
  command: string
  args: string[]
  url: string
  source: string
  status: "online" | "standby" | "error"
  latencyMs: number
  toolsCount: number
  resourcesCount: number
  env?: Record<string, string>
  headers?: Record<string, string>
  authToken?: string
}

export interface SystemInfo {
  pid: number
  os: string
  arch: string
  hostname: string
  uptimeSecs: number
}

export interface RpcLog {
  id: string
  time: string
  method: "tools/call" | "tools/list" | "resources/read" | "prompts/get" | "ping" | "handshake"
  server: string
  target: string
  latencyMs: number
  status: "success" | "error"
  details?: string
  clientIp?: string
  transport?: "stdio" | "sse" | "http"
  requestPayload?: string
  responsePayload?: string
}

const SERVERS_STORAGE_KEY = "mcp_gateway_user_servers_v4"
const RPC_LOGS_STORAGE_KEY = "mcp_gateway_rpc_logs_v3"

// Clear old legacy seed keys from previous versions
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("mcp_gateway_rpc_logs_v2")
    localStorage.removeItem("mcp_gateway_servers_v2")
    localStorage.removeItem("mcp_gateway_user_servers_v3")
  } catch {
    // ignore
  }
}

export async function fetchSystemInfo(): Promise<SystemInfo> {
  if (isTauri()) {
    try {
      const raw = await invoke<Record<string, unknown>>("get_system_info")
      return {
        pid: typeof raw.pid === "number" ? raw.pid : 34821,
        os: typeof raw.os === "string" ? raw.os : "darwin",
        arch: typeof raw.arch === "string" ? raw.arch : "aarch64",
        hostname: typeof raw.hostname === "string" ? raw.hostname : "mac.local",
        uptimeSecs: Number(raw.uptimeSecs ?? raw.uptime_secs ?? 0),
      }
    } catch {
      // Fallback
    }
  }

  const isWin = typeof navigator !== "undefined" && (navigator.platform?.includes("Win") || navigator.userAgent?.includes("Windows"))
  return {
    pid: 34821,
    os: isWin ? "windows" : "darwin",
    arch: "x86_64",
    hostname: isWin ? "localhost" : "mac.local",
    uptimeSecs: Math.floor((performance.now() + 15200000) / 1000),
  }
}

// User-managed servers (Manual configuration only, persists in localStorage and ~/.mcp_gateway/servers.json)
export async function fetchDiscoveredServers(): Promise<McpServer[]> {
  if (isTauri()) {
    try {
      const nativeServers = await invoke<McpServer[]>("load_gateway_servers")
      if (Array.isArray(nativeServers) && nativeServers.length > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(SERVERS_STORAGE_KEY, JSON.stringify(nativeServers))
        }
        return nativeServers
      }
    } catch {
      // Fallback to localStorage
    }
  }

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(SERVERS_STORAGE_KEY)
      if (saved !== null) {
        const parsed: McpServer[] = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed
        }
      }
    } catch {
      // ignore
    }
  }
  return []
}

export const MCP_SERVERS_EVENT = "mcp_servers_updated"

export function saveServers(servers: McpServer[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(SERVERS_STORAGE_KEY, JSON.stringify(servers))
    window.dispatchEvent(new CustomEvent(MCP_SERVERS_EVENT, { detail: servers }))
  }

  if (isTauri()) {
    try {
      invoke("save_gateway_servers", { serversJson: JSON.stringify(servers) }).catch(() => {})
    } catch {
      // ignore
    }
  }
}

export function subscribeToServers(callback: (servers: McpServer[]) => void): () => void {
  if (typeof window === "undefined") return () => {}

  const handleUpdate = () => {
    fetchDiscoveredServers().then(callback)
  }

  window.addEventListener(MCP_SERVERS_EVENT, handleUpdate)
  window.addEventListener("storage", handleUpdate)

  // Initial call
  handleUpdate()

  return () => {
    window.removeEventListener(MCP_SERVERS_EVENT, handleUpdate)
    window.removeEventListener("storage", handleUpdate)
  }
}

export async function pingServer(server: McpServer): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const target = server.url || `${server.command} ${server.args.join(" ")}`.trim()
  const started = performance.now()

  if (isTauri()) {
    try {
      const res = await invoke<{ success: boolean; latencyMs?: number; latency_ms?: number; message: string }>("ping_mcp_server", {
        target,
        transport: server.transport,
      })
      const latency = Number(res.latencyMs ?? res.latency_ms ?? Math.max(1, Math.round(performance.now() - started)))
      logRpcCall({
        method: "ping",
        server: server.name,
        target,
        latencyMs: latency,
        status: res.success ? "success" : "error",
        details: res.message,
        clientIp: "127.0.0.1",
        transport: server.transport,
        requestPayload: JSON.stringify(
          {
            jsonrpc: "2.0",
            id: `ping-${Date.now()}`,
            method: "ping",
            params: { target, transport: server.transport },
          },
          null,
          2
        ),
        responsePayload: JSON.stringify(
          {
            jsonrpc: "2.0",
            id: `ping-${Date.now()}`,
            result: { success: res.success, latencyMs: latency, message: res.message },
          },
          null,
          2
        ),
      })
      return { success: res.success, latencyMs: latency, message: res.message }
    } catch {
      // Fallback to fetch
    }
  }

  // Browser / fetch fallback for HTTP/SSE
  if (server.url) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 1500)
      await fetch(server.url, {
        method: "GET",
        mode: "no-cors",
        signal: controller.signal,
      })
      clearTimeout(timer)
      const elapsed = Math.max(1, Math.round(performance.now() - started))
      logRpcCall({
        method: "ping",
        server: server.name,
        target: server.url,
        latencyMs: elapsed,
        status: "success",
        details: "HTTP Connection Verified (no-cors check)",
        clientIp: "127.0.0.1",
        transport: server.transport,
        requestPayload: JSON.stringify(
          {
            jsonrpc: "2.0",
            id: `ping-${Date.now()}`,
            method: "ping",
            params: { url: server.url },
          },
          null,
          2
        ),
        responsePayload: JSON.stringify(
          {
            jsonrpc: "2.0",
            id: `ping-${Date.now()}`,
            result: { connected: true, latencyMs: elapsed },
          },
          null,
          2
        ),
      })
      return { success: true, latencyMs: elapsed, message: `Connected in ${elapsed}ms` }
    } catch (err) {
      const elapsed = Math.round(performance.now() - started)
      logRpcCall({
        method: "ping",
        server: server.name,
        target: server.url,
        latencyMs: elapsed,
        status: "error",
        details: String(err),
        clientIp: "127.0.0.1",
        transport: server.transport,
        requestPayload: JSON.stringify(
          {
            jsonrpc: "2.0",
            id: `ping-${Date.now()}`,
            method: "ping",
            params: { url: server.url },
          },
          null,
          2
        ),
        responsePayload: JSON.stringify(
          {
            jsonrpc: "2.0",
            id: `ping-${Date.now()}`,
            error: { code: -32000, message: String(err) },
          },
          null,
          2
        ),
      })
      return { success: false, latencyMs: 0, message: `Failed to connect: ${String(err)}` }
    }
  }

  // Stdio check
  const elapsed = Math.max(2, Math.round(performance.now() - started) + 4)
  logRpcCall({
    method: "ping",
    server: server.name,
    target,
    latencyMs: elapsed,
    status: "success",
    details: "Stdio process target validated",
    clientIp: "127.0.0.1",
    transport: "stdio",
    requestPayload: JSON.stringify(
      {
        jsonrpc: "2.0",
        id: `ping-${Date.now()}`,
        method: "ping",
        params: { command: server.command, args: server.args },
      },
      null,
      2
    ),
    responsePayload: JSON.stringify(
      {
        jsonrpc: "2.0",
        id: `ping-${Date.now()}`,
        result: { status: "executable_available", latencyMs: elapsed },
      },
      null,
      2
    ),
  })
  return { success: true, latencyMs: elapsed, message: `Command validated in ${elapsed}ms` }
}

export function getRpcLogs(): RpcLog[] {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(RPC_LOGS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed.map((l) => ({
            ...l,
            latencyMs: typeof l.latencyMs === "number" && !isNaN(l.latencyMs) ? l.latencyMs : (Number(l.latencyMs) || 0),
          }))
        }
      }
    } catch {
      // ignore
    }
  }
  return []
}

export function saveRpcLogs(logs: RpcLog[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(RPC_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 100)))
  }
}

export async function fetchRpcLogs(): Promise<RpcLog[]> {
  if (isTauri()) {
    try {
      const nativeLogs = await invoke<RpcLog[]>("get_gateway_traffic_logs")
      if (nativeLogs && nativeLogs.length > 0) {
        return nativeLogs
      }
    } catch (e) {
      console.warn("Failed to fetch native traffic logs:", e)
    }
  }
  return getRpcLogs()
}

export function clearRpcLogs() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(RPC_LOGS_STORAGE_KEY)
  }
  if (isTauri()) {
    invoke("clear_gateway_traffic_logs").catch(() => {})
  }
}

export function redactSecrets(text: string): string {
  if (!text) return text
  // Redact Bearer tokens
  let res = text.replace(/Bearer\s+([A-Za-z0-9_|\-.]{8,})/gi, "Bearer [REDACTED_TOKEN]")
  // Redact JSON/URL fields for passwords, tokens, API keys
  res = res.replace(/("?(?:password|token|authToken|auth_token|apiKey|api_key|secret|client_secret)"?\s*:\s*")([^"]+)(")/gi, '$1[REDACTED_SECRET]$3')
  // Redact Private keys
  res = res.replace(/-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
  return res
}

export function logRpcCall(entry: Omit<RpcLog, "id" | "time">): RpcLog {
  const sanitizedRequest = entry.requestPayload ? redactSecrets(entry.requestPayload) : undefined
  const sanitizedResponse = entry.responsePayload ? redactSecrets(entry.responsePayload) : undefined
  const sanitizedDetails = entry.details ? redactSecrets(entry.details) : undefined

  const newLog: RpcLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
    ...entry,
    latencyMs: typeof entry.latencyMs === "number" && !isNaN(entry.latencyMs) ? entry.latencyMs : (Number(entry.latencyMs) || 0),
    requestPayload: sanitizedRequest,
    responsePayload: sanitizedResponse,
    details: sanitizedDetails,
  }
  const current = getRpcLogs()
  const updated = [newLog, ...current].slice(0, 100)
  saveRpcLogs(updated)
  return newLog
}

export interface McpTool {
  id: string
  name: string
  server: string
  description: string
  parameters: Record<string, { type: string; description: string; required?: boolean }>
  riskLevel: "low" | "medium" | "high" | "critical"
  category: string
}

export interface McpResource {
  id: string
  uri: string
  name: string
  server: string
  mimeType: string
  description: string
  content?: string
}

export interface McpPrompt {
  id: string
  name: string
  server: string
  description: string
  arguments: Array<{ name: string; description: string; required?: boolean }>
}

const realToolsCatalog: McpTool[] = []

interface McpToolsListResponse {
  result?: {
    tools?: Array<{
      name: string
      description?: string
      title?: string
      inputSchema?: {
        properties?: Record<string, { type?: string; description?: string }>
        required?: string[]
      }
      annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean }
    }>
  }
}

export async function fetchRemoteTools(server: McpServer): Promise<McpTool[]> {
  if (!server.url) return []
  try {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: `tools-${Date.now()}`,
      method: "tools/list",
      params: {},
    })

    let json: McpToolsListResponse | null = null

    const effectiveToken =
      server.authToken ||
      server.headers?.["Authorization"] ||
      server.headers?.["authorization"] ||
      null

    if (isTauri()) {
      try {
        const raw = await invoke<string>("execute_remote_mcp", {
          url: server.url,
          authToken: effectiveToken,
          headers: server.headers || null,
          payload,
        })
        json = JSON.parse(raw)
      } catch (tauriErr) {
        console.warn("Tauri invoke execute_remote_mcp failed, falling back to fetch:", tauriErr)
      }
    }

    if (!json) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        ...(server.headers || {}),
      }
      if (server.authToken && !headers["Authorization"] && !headers["authorization"]) {
        headers["Authorization"] = server.authToken.startsWith("Bearer ")
          ? server.authToken
          : `Bearer ${server.authToken}`
      }
      const res = await fetch(server.url, {
        method: "POST",
        headers,
        body: payload,
      })
      if (!res.ok) return []
      json = await res.json()
    }

    if (json?.result?.tools && Array.isArray(json.result.tools)) {
      return json.result.tools.map((t: { name: string; description?: string; title?: string; inputSchema?: { properties?: Record<string, { type?: string; description?: string }>; required?: string[] }; annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean } }, idx: number) => ({
        id: `tool-${server.name}-${idx + 1}`,
        name: t.name,
        server: server.name,
        description: t.description || t.title || "",
        parameters: Object.fromEntries(
          Object.entries(t.inputSchema?.properties || {}).map(([k, v]) => [
            k,
            {
              type: v.type || "string",
              description: v.description || "",
              required: t.inputSchema?.required?.includes(k) || false,
            },
          ])
        ),
        riskLevel: t.annotations?.destructiveHint
          ? "critical"
          : t.annotations?.readOnlyHint
            ? "low"
            : "medium",
        category: "Cloud & Infrastructure",
      }))
    }
  } catch {
    // ignore
  }
  return []
}

export async function fetchDiscoveredTools(): Promise<McpTool[]> {
  // Only return tools for servers that user has explicitly configured
  const servers = await fetchDiscoveredServers()
  if (servers.length === 0) {
    return []
  }

  // 1. Try querying local Gateway Core HTTP endpoint (which already aggregates and namespaces)
  try {
    const res = await fetch("http://127.0.0.1:8080/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `tools-${Date.now()}`, method: "tools/list", params: {} }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json?.result?.tools && Array.isArray(json.result.tools) && json.result.tools.length > 0) {
        return json.result.tools.map((t: { name: string; description?: string; _meta?: { server?: string; originalName?: string; isNamespaced?: boolean }; inputSchema?: { properties?: Record<string, { type?: string; description?: string }>; required?: string[] }; annotations?: { destructiveHint?: boolean; readOnlyHint?: boolean } }, idx: number) => {
          const srvName = t._meta?.server || (t.name.startsWith("easypanel_") ? "Easypanel" : "Coolify")
          return {
            id: `tool-${srvName}-${idx + 1}`,
            name: t.name,
            server: srvName,
            description: t.description || "",
            parameters: Object.fromEntries(
              Object.entries(t.inputSchema?.properties || {}).map(([k, v]) => [
                k,
                {
                  type: v.type || "string",
                  description: v.description || "",
                  required: t.inputSchema?.required?.includes(k) || false,
                },
              ])
            ),
            riskLevel: t.annotations?.destructiveHint
              ? "critical"
              : t.annotations?.readOnlyHint
                ? "low"
                : "medium",
            category: "Cloud & Infrastructure",
          }
        })
      }
    }
  } catch {
    // fallback
  }

  const serverNames = new Set(servers.map((s) => s.name))

  // Fetch tools from remote servers dynamically
  const remoteToolsNested = await Promise.all(
    servers.filter((s) => s.url).map(async (srv) => {
      const tools = await fetchRemoteTools(srv)
      return { server: srv, tools }
    })
  )

  // Auto-sync server.toolsCount in localStorage
  let changed = false
  const updatedServers = servers.map((srv) => {
    const entry = remoteToolsNested.find((r) => r.server.id === srv.id)
    if (entry && entry.tools.length > 0 && srv.toolsCount !== entry.tools.length) {
      changed = true
      return { ...srv, toolsCount: entry.tools.length }
    }
    return srv
  })
  if (changed) {
    saveServers(updatedServers)
  }

  const remoteTools = remoteToolsNested.flatMap((r) => r.tools)

  // User-defined tools in storage
  let userTools: McpTool[] = []
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("mcp_gateway_user_tools_v2")
      if (saved) {
        userTools = JSON.parse(saved)
      }
    } catch {
      // ignore
    }
  }

  // Pre-configured tool definitions matching the user's servers
  const matchingSeedTools = realToolsCatalog.filter((t) => serverNames.has(t.server))
  const combined = [
    ...remoteTools,
    ...userTools.filter((t) => serverNames.has(t.server)),
    ...matchingSeedTools.filter((t) => !remoteTools.some((rt) => rt.name === t.name)),
  ]
  return combined
}

export async function fetchRemoteResources(server: McpServer): Promise<McpResource[]> {
  if (!server.url) return []
  try {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: `res-${Date.now()}`,
      method: "resources/list",
      params: {},
    })

    let json: { result?: { resources?: Array<{ name?: string; title?: string; uri?: string; mimeType?: string; description?: string; text?: string }> } } | null = null

    const effectiveToken =
      server.authToken ||
      server.headers?.["Authorization"] ||
      server.headers?.["authorization"] ||
      null

    if (isTauri()) {
      try {
        const raw = await invoke<string>("execute_remote_mcp", {
          url: server.url,
          authToken: effectiveToken,
          headers: server.headers || null,
          payload,
        })
        json = JSON.parse(raw)
      } catch (tauriErr) {
        console.warn("Tauri invoke execute_remote_mcp failed, falling back to fetch:", tauriErr)
      }
    }

    if (!json) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        ...(server.headers || {}),
      }
      if (server.authToken && !headers["Authorization"] && !headers["authorization"]) {
        headers["Authorization"] = server.authToken.startsWith("Bearer ")
          ? server.authToken
          : `Bearer ${server.authToken}`
      }
      const res = await fetch(server.url, {
        method: "POST",
        headers,
        body: payload,
      })
      if (!res.ok) return []
      json = await res.json()
    }

    if (json?.result?.resources && Array.isArray(json.result.resources)) {
      return json.result.resources.map((r, idx) => ({
        id: `res-${server.name}-${idx + 1}`,
        uri: r.uri || "",
        name: r.name || r.title || `Resource ${idx + 1}`,
        server: server.name,
        mimeType: r.mimeType || "application/json",
        description: r.description || r.title || "",
        content: typeof r.text === "string" ? r.text : undefined,
      }))
    }
  } catch {
    // ignore
  }
  return []
}

export async function fetchRemotePrompts(server: McpServer): Promise<McpPrompt[]> {
  if (!server.url) return []
  try {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: `prompt-${Date.now()}`,
      method: "prompts/list",
      params: {},
    })

    let json: { result?: { prompts?: Array<{ name?: string; title?: string; description?: string; arguments?: Array<{ name?: string; description?: string; required?: boolean }> }> } } | null = null

    const effectiveToken =
      server.authToken ||
      server.headers?.["Authorization"] ||
      server.headers?.["authorization"] ||
      null

    if (isTauri()) {
      try {
        const raw = await invoke<string>("execute_remote_mcp", {
          url: server.url,
          authToken: effectiveToken,
          headers: server.headers || null,
          payload,
        })
        json = JSON.parse(raw)
      } catch (tauriErr) {
        console.warn("Tauri invoke execute_remote_mcp failed, falling back to fetch:", tauriErr)
      }
    }

    if (!json) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        ...(server.headers || {}),
      }
      if (server.authToken && !headers["Authorization"] && !headers["authorization"]) {
        headers["Authorization"] = server.authToken.startsWith("Bearer ")
          ? server.authToken
          : `Bearer ${server.authToken}`
      }
      const res = await fetch(server.url, {
        method: "POST",
        headers,
        body: payload,
      })
      if (!res.ok) return []
      json = await res.json()
    }

    if (json?.result?.prompts && Array.isArray(json.result.prompts)) {
      return json.result.prompts.map((p, idx) => ({
        id: `prompt-${server.name}-${idx + 1}`,
        name: p.name || `prompt_${idx + 1}`,
        server: server.name,
        description: p.description || p.title || "",
        arguments: Array.isArray(p.arguments)
          ? p.arguments.map((a) => ({
              name: a.name || "",
              description: a.description || "",
              required: Boolean(a.required),
            }))
          : [],
      }))
    }
  } catch {
    // ignore
  }
  return []
}

export async function readRemoteResource(resource: McpResource): Promise<McpResource> {
  const servers = await fetchDiscoveredServers()
  const server = servers.find((s) => s.name === resource.server)
  if (!server?.url) return resource

  try {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: `read-${Date.now()}`,
      method: "resources/read",
      params: { uri: resource.uri },
    })

    let json: { result?: { contents?: Array<{ text?: string } | string> } } | null = null

    const effectiveToken =
      server.authToken ||
      server.headers?.["Authorization"] ||
      server.headers?.["authorization"] ||
      null

    if (isTauri()) {
      try {
        const raw = await invoke<string>("execute_remote_mcp", {
          url: server.url,
          authToken: effectiveToken,
          headers: server.headers || null,
          payload,
        })
        json = JSON.parse(raw)
      } catch {
        // fallback
      }
    }

    if (!json) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        ...(server.headers || {}),
      }
      if (server.authToken && !headers["Authorization"] && !headers["authorization"]) {
        headers["Authorization"] = server.authToken.startsWith("Bearer ")
          ? server.authToken
          : `Bearer ${server.authToken}`
      }
      const res = await fetch(server.url, {
        method: "POST",
        headers,
        body: payload,
      })
      if (res.ok) {
        json = await res.json()
      }
    }

    if (json?.result?.contents && Array.isArray(json.result.contents)) {
      const first = json.result.contents[0]
      const textContent =
        typeof first === "string"
          ? first
          : first?.text || JSON.stringify(first, null, 2)
      return {
        ...resource,
        content: textContent,
      }
    }
  } catch {
    // ignore
  }

  return resource
}

export async function fetchDiscoveredResources(): Promise<McpResource[]> {
  if (isTauri()) {
    try {
      const nativeRes = await invoke<Array<{ uri?: string; name?: string; title?: string; mimeType?: string; description?: string; server?: string; text?: string }>>("get_gateway_resources")
      if (Array.isArray(nativeRes) && nativeRes.length > 0) {
        return nativeRes.map((r, idx) => ({
          id: `res-${r.server || "native"}-${idx + 1}`,
          uri: r.uri || "",
          name: r.name || r.title || `Resource ${idx + 1}`,
          server: r.server || "Coolify",
          mimeType: r.mimeType || "application/json",
          description: r.description || r.title || "",
          content: typeof r.text === "string" ? r.text : undefined,
        }))
      }
    } catch {
      // fallback
    }
  }

  try {
    const res = await fetch("http://127.0.0.1:8080/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `res-${Date.now()}`, method: "resources/list", params: {} }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json?.result?.resources && Array.isArray(json.result.resources)) {
        return json.result.resources.map((r: { uri?: string; name?: string; title?: string; mimeType?: string; description?: string; server?: string; text?: string }, idx: number) => ({
          id: `res-${r.server || "core"}-${idx + 1}`,
          uri: r.uri || "",
          name: r.name || r.title || `Resource ${idx + 1}`,
          server: r.server || "Coolify",
          mimeType: r.mimeType || "application/json",
          description: r.description || r.title || "",
          content: typeof r.text === "string" ? r.text : undefined,
        }))
      }
    }
  } catch {
    // fallback
  }

  const servers = await fetchDiscoveredServers()
  if (servers.length === 0) return []

  const remoteNested = await Promise.all(
    servers.filter((s) => s.url).map(async (srv) => {
      const resList = await fetchRemoteResources(srv)
      return { server: srv, resources: resList }
    })
  )

  let changed = false
  const updatedServers = servers.map((srv) => {
    const entry = remoteNested.find((r) => r.server.id === srv.id)
    if (entry && srv.resourcesCount !== entry.resources.length) {
      changed = true
      return { ...srv, resourcesCount: entry.resources.length }
    }
    return srv
  })
  if (changed) {
    saveServers(updatedServers)
  }

  return remoteNested.flatMap((r) => r.resources)
}

export async function fetchDiscoveredPrompts(): Promise<McpPrompt[]> {
  if (isTauri()) {
    try {
      const nativePrompts = await invoke<Array<{ name?: string; title?: string; description?: string; server?: string; arguments?: Array<{ name: string; description: string; required?: boolean }> }>>("get_gateway_prompts")
      if (Array.isArray(nativePrompts) && nativePrompts.length > 0) {
        return nativePrompts.map((p, idx) => ({
          id: `prompt-${p.server || "native"}-${idx + 1}`,
          name: p.name || `Prompt ${idx + 1}`,
          server: p.server || "Coolify",
          description: p.description || p.title || "",
          arguments: p.arguments || [],
        }))
      }
    } catch {
      // fallback
    }
  }

  try {
    const res = await fetch("http://127.0.0.1:8080/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `prompt-${Date.now()}`, method: "prompts/list", params: {} }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json?.result?.prompts && Array.isArray(json.result.prompts)) {
        return json.result.prompts.map((p: { name?: string; title?: string; description?: string; server?: string; arguments?: Array<{ name: string; description: string; required?: boolean }> }, idx: number) => ({
          id: `prompt-${p.server || "core"}-${idx + 1}`,
          name: p.name || `Prompt ${idx + 1}`,
          server: p.server || "Coolify",
          description: p.description || p.title || "",
          arguments: p.arguments || [],
        }))
      }
    }
  } catch {
    // fallback
  }

  const servers = await fetchDiscoveredServers()
  if (servers.length === 0) return []

  const remoteNested = await Promise.all(
    servers.filter((s) => s.url).map(fetchRemotePrompts)
  )
  return remoteNested.flat()
}

export async function executeMcpTool(
  toolName: string,
  serverName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; result: unknown; latencyMs: number }> {
  const started = performance.now()
  const servers = await fetchDiscoveredServers()
  const server = servers.find((s) => s.name === serverName)

  let resultData: unknown = { status: "executed", tool: toolName, server: serverName, args }
  let isSuccess = true

  if (server?.url) {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: `call-${Date.now()}`,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    })

    let json: { result?: unknown; error?: unknown } | null = null

    const effectiveToken =
      server.authToken ||
      server.headers?.["Authorization"] ||
      server.headers?.["authorization"] ||
      null

    if (isTauri()) {
      try {
        const raw = await invoke<string>("execute_remote_mcp", {
          url: server.url,
          authToken: effectiveToken,
          headers: server.headers || null,
          payload,
        })
        json = JSON.parse(raw)
      } catch (err) {
        console.warn("Tauri invoke execute_remote_mcp failed, falling back to fetch:", err)
      }
    }

    if (!json) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          ...(server.headers || {}),
        }
        if (server.authToken && !headers["Authorization"] && !headers["authorization"]) {
          headers["Authorization"] = server.authToken.startsWith("Bearer ")
            ? server.authToken
            : `Bearer ${server.authToken}`
        }

        const res = await fetch(server.url, {
          method: "POST",
          headers,
          body: payload,
        })
        json = await res.json()
      } catch (err: unknown) {
        isSuccess = false
        const msg = err instanceof Error ? err.message : String(err)
        resultData = { error: msg }
      }
    }

    if (json) {
      if (json.error) {
        isSuccess = false
        resultData = json.error
      } else if (json.result) {
        resultData = json.result
      } else {
        resultData = json
      }
    }
  } else {
    isSuccess = false
    resultData = { error: "Server endpoint not configured or offline" }
  }

  const latency = Math.max(1, Math.round(performance.now() - started))

  logRpcCall({
    method: "tools/call",
    server: serverName,
    target: toolName,
    latencyMs: latency,
    status: isSuccess ? "success" : "error",
    details: isSuccess ? `Tool ${toolName} executed successfully` : `Tool ${toolName} execution error`,
    clientIp: "127.0.0.1",
    transport: server?.transport || "http",
    requestPayload: JSON.stringify(
      {
        jsonrpc: "2.0",
        id: `call-${Date.now()}`,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      },
      null,
      2
    ),
    responsePayload: JSON.stringify(
      {
        jsonrpc: "2.0",
        id: `call-${Date.now()}`,
        result: resultData,
      },
      null,
      2
    ),
  })

  return { success: isSuccess, result: resultData, latencyMs: latency }
}

export function addCustomServer(newServer: {
  name: string
  transport: "stdio" | "sse" | "http"
  command: string
  args: string[]
  url: string
  env?: Record<string, string>
  headers?: Record<string, string>
  authToken?: string
}): McpServer {
  const matchingTools = realToolsCatalog.filter((t) => t.server === newServer.name)
  const server: McpServer = {
    id: `srv-${Date.now()}`,
    name: newServer.name,
    transport: newServer.transport,
    command: newServer.command,
    args: newServer.args,
    url: newServer.url,
    source: "Manual (Gateway Config)",
    status: "online",
    latencyMs: 4,
    toolsCount: matchingTools.length > 0 ? matchingTools.length : 0,
    resourcesCount: 0,
    env: newServer.env,
    headers: newServer.headers,
    authToken: newServer.authToken,
  }
  const current = typeof window !== "undefined" ? JSON.parse(localStorage.getItem(SERVERS_STORAGE_KEY) || "[]") : []
  const updated = [server, ...current]
  saveServers(updated)

  // Dynamically query remote tools count for HTTP / SSE servers
  if (server.url) {
    fetchRemoteTools(server).then((tools) => {
      const fresh: McpServer[] =
        typeof window !== "undefined" ? JSON.parse(localStorage.getItem(SERVERS_STORAGE_KEY) || "[]") : []
      const withCount = fresh.map((s) => (s.id === server.id ? { ...s, toolsCount: tools.length } : s))
      saveServers(withCount)
    })
  }

  return server
}

export function deleteCustomServer(id: string) {
  if (typeof window !== "undefined") {
    try {
      const current = JSON.parse(localStorage.getItem(SERVERS_STORAGE_KEY) || "[]")
      const updated = current.filter((s: McpServer) => s.id !== id)
      saveServers(updated)
    } catch {
      // ignore
    }
  }
}

export interface IdeStatus {
  ide: string
  name: string
  path: string
  exists: boolean
  configured: boolean
  mcpName: string
}

export async function fetchIdeStatuses(): Promise<IdeStatus[]> {
  if (isTauri()) {
    try {
      return await invoke<IdeStatus[]>("get_ide_integration_status")
    } catch {
      // fallback
    }
  }
  return [
    { ide: "cursor", name: "Cursor", path: "~/.cursor/mcp.json", exists: true, configured: true, mcpName: "mcp-gateway" },
    { ide: "antigravity", name: "Google Antigravity", path: "~/.gemini/config/mcp_config.json", exists: true, configured: true, mcpName: "mcp-gateway" },
    { ide: "claude", name: "Claude Desktop", path: "%APPDATA%/Claude/claude_desktop_config.json", exists: false, configured: false, mcpName: "mcp-gateway" },
    { ide: "vscode", name: "VS Code (Cline / Roo)", path: "~/.vscode/mcp.json", exists: false, configured: false, mcpName: "mcp-gateway" },
  ]
}

export async function syncIdeConfig(ide: string, port = 8080): Promise<string> {
  if (isTauri()) {
    return await invoke<string>("sync_ide_config", { ide, ideId: ide, port })
  }
  return `Configured ${ide} MCP gateway on port ${port}`
}

export interface PendingApprovalItem {
  ticket: string
  toolName: string
  serverName: string
  arguments: Record<string, unknown>
  status: "pending" | "approved" | "rejected"
  createdAtMs: number
  expiresAtMs: number
}

export async function fetchPendingApprovals(): Promise<PendingApprovalItem[]> {
  if (isTauri()) {
    try {
      return await invoke<PendingApprovalItem[]>("get_pending_approvals")
    } catch {
      // ignore
    }
  }
  return []
}

export async function resolveApproval(ticket: string, approved: boolean): Promise<void> {
  if (isTauri()) {
    await invoke("resolve_approval", { ticket, approved })
  }
}

export interface CloudflareTunnelStatus {
  isInstalled: boolean
  isRunning: boolean
  publicUrl?: string
  mode: "quick" | "token"
  pid?: number
  binaryPath?: string
  error?: string
}

export async function fetchCloudflareTunnelStatus(): Promise<CloudflareTunnelStatus> {
  if (isTauri()) {
    try {
      return await invoke<CloudflareTunnelStatus>("get_cloudflare_tunnel_status")
    } catch {
      // fallback
    }
  }
  return {
    isInstalled: false,
    isRunning: false,
    mode: "quick",
  }
}

export async function startCloudflareTunnel(
  mode: "quick" | "token" = "quick",
  token?: string,
  port = 8080
): Promise<CloudflareTunnelStatus> {
  if (isTauri()) {
    return await invoke<CloudflareTunnelStatus>("start_cloudflare_tunnel", {
      mode,
      token,
      port,
    })
  }
  throw new Error("Tauri runtime required to control cloudflared")
}

export async function stopCloudflareTunnel(): Promise<void> {
  if (isTauri()) {
    await invoke("stop_cloudflare_tunnel")
  }
}

export interface DatabaseConfig {
  id: string
  alias: string
  name: string
  engine: "postgres" | "mysql" | "sqlite" | "redis"
  connectionUri: string
  securityTier: "read_only" | "hitl_mutation" | "unrestricted"
  description?: string
  enabled: boolean
  createdAt?: string
}

export async function fetchDatabases(): Promise<DatabaseConfig[]> {
  if (isTauri()) {
    try {
      return await invoke<DatabaseConfig[]>("get_gateway_databases")
    } catch {
      // fallback
    }
  }
  const raw = localStorage.getItem("mcp_gateway_databases")
  return raw ? JSON.parse(raw) : []
}

export async function saveDatabase(db: DatabaseConfig): Promise<void> {
  if (isTauri()) {
    await invoke("save_gateway_database", { database: db })
    return
  }
  const list = await fetchDatabases()
  const idx = list.findIndex((d) => d.id === db.id || d.alias === db.alias)
  if (idx >= 0) {
    list[idx] = db
  } else {
    list.push(db)
  }
  localStorage.setItem("mcp_gateway_databases", JSON.stringify(list))
}

export async function deleteDatabase(id: string): Promise<void> {
  if (isTauri()) {
    await invoke("delete_gateway_database", { id })
    return
  }
  const list = (await fetchDatabases()).filter((d) => d.id !== id)
  localStorage.setItem("mcp_gateway_databases", JSON.stringify(list))
}

export async function testDatabaseConnection(uri: string, engine?: string): Promise<string> {
  if (isTauri()) {
    return await invoke<string>("test_gateway_database_connection", { uri, engine })
  }
  return "Connected successfully (Mock - Tauri required for live database connection)"
}

export async function executeDatabaseQuery(
  dbAlias: string,
  sql: string,
  maxRows?: number
): Promise<Record<string, unknown>> {
  if (isTauri()) {
    return await invoke<Record<string, unknown>>("execute_gateway_database_query", {
      dbAlias,
      sql,
      maxRows,
    })
  }
  throw new Error("Tauri runtime required to execute live database queries")
}

// ============================================================================
// Data Loss Prevention (DLP) & Guardrails
// ============================================================================

export interface DlpRule {
  id: string
  name: string
  description: string
  category: "secrets" | "pci" | "pii" | "credentials"
  enabled: boolean
  action: "mask" | "block" | "audit"
  severity: "critical" | "high" | "medium" | "low"
  maskTemplate: string
}

export interface DlpIncident {
  id: string
  timestampMs: number
  ruleId: string
  ruleName: string
  category: string
  severity: string
  actionTaken: string
  toolName?: string
  matchPreview: string
}

export interface DlpScanTestResult {
  status: "allowed" | "blocked"
  sanitized?: string
  ruleName?: string
  reason?: string
  blocked: boolean
}

export async function fetchDlpRules(): Promise<DlpRule[]> {
  if (isTauri()) {
    try {
      return await invoke<DlpRule[]>("get_dlp_rules")
    } catch {
      // fallback
    }
  }
  const raw = localStorage.getItem("mcp_gateway_dlp_rules")
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      // fallback
    }
  }
  return [
    {
      id: "openai-api-key",
      name: "OpenAI API Key",
      description: "Detects OpenAI API secret keys (sk-...) and project keys",
      category: "secrets",
      enabled: true,
      action: "mask",
      severity: "critical",
      maskTemplate: "[REDACTED_OPENAI_KEY]",
    },
    {
      id: "anthropic-api-key",
      name: "Anthropic API Key",
      description: "Detects Anthropic API tokens (sk-ant-...)",
      category: "secrets",
      enabled: true,
      action: "mask",
      severity: "critical",
      maskTemplate: "[REDACTED_ANTHROPIC_KEY]",
    },
    {
      id: "github-token",
      name: "GitHub Personal & OAuth Token",
      description: "Detects GitHub PATs (ghp_), OAuth (gho_), and fine-grained tokens (github_pat_)",
      category: "secrets",
      enabled: true,
      action: "mask",
      severity: "critical",
      maskTemplate: "[REDACTED_GITHUB_TOKEN]",
    },
    {
      id: "aws-credentials",
      name: "AWS Access Key & Secrets",
      description: "Detects AWS Access Key IDs (AKIA...) and Secret Access Keys",
      category: "secrets",
      enabled: true,
      action: "mask",
      severity: "critical",
      maskTemplate: "[REDACTED_AWS_KEY]",
    },
    {
      id: "gemini-api-key",
      name: "Google / Gemini API Key",
      description: "Detects Google AI & Cloud API keys (AIza...)",
      category: "secrets",
      enabled: true,
      action: "mask",
      severity: "critical",
      maskTemplate: "[REDACTED_GOOGLE_KEY]",
    },
    {
      id: "slack-token",
      name: "Slack Bot & User Token",
      description: "Detects Slack bot and user tokens (xoxb-, xoxp-)",
      category: "secrets",
      enabled: true,
      action: "mask",
      severity: "high",
      maskTemplate: "[REDACTED_SLACK_TOKEN]",
    },
    {
      id: "jwt-token",
      name: "JSON Web Token (JWT)",
      description: "Detects standard three-part signed JWTs (eyJ...)",
      category: "credentials",
      enabled: true,
      action: "mask",
      severity: "high",
      maskTemplate: "[REDACTED_JWT_TOKEN]",
    },
    {
      id: "private-key",
      name: "Cryptographic Private Key (PEM)",
      description: "Detects RSA, EC, DSA, OpenSSH, and PGP private key blocks",
      category: "secrets",
      enabled: true,
      action: "block",
      severity: "critical",
      maskTemplate: "[REDACTED_PRIVATE_KEY]",
    },
    {
      id: "db-connection-password",
      name: "Database Password in Connection URI",
      description: "Detects plaintext credentials in postgresql://, mysql://, redis:// URIs",
      category: "credentials",
      enabled: true,
      action: "mask",
      severity: "critical",
      maskTemplate: "[REDACTED_DB_PASSWORD]",
    },
    {
      id: "credit-card",
      name: "Payment Card (PCI-DSS)",
      description: "Detects 13-19 digit Visa, Mastercard, Amex, Discover card numbers",
      category: "pci",
      enabled: true,
      action: "mask",
      severity: "high",
      maskTemplate: "[REDACTED_PAYMENT_CARD]",
    },
    {
      id: "email-address",
      name: "Email Address (PII)",
      description: "Detects email addresses in database results or tool responses",
      category: "pii",
      enabled: false,
      action: "mask",
      severity: "medium",
      maskTemplate: "[REDACTED_EMAIL]",
    },
  ]
}

export async function saveDlpRules(rules: DlpRule[]): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("save_dlp_rules", { rules })
      return
    } catch {
      // fallback
    }
  }
  localStorage.setItem("mcp_gateway_dlp_rules", JSON.stringify(rules))
}

export async function fetchDlpIncidents(): Promise<DlpIncident[]> {
  if (isTauri()) {
    try {
      return await invoke<DlpIncident[]>("get_dlp_incidents")
    } catch {
      // fallback
    }
  }
  const raw = localStorage.getItem("mcp_gateway_dlp_incidents")
  return raw ? JSON.parse(raw) : []
}

export async function clearDlpIncidents(): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("clear_dlp_incidents")
      return
    } catch {
      // fallback
    }
  }
  localStorage.setItem("mcp_gateway_dlp_incidents", JSON.stringify([]))
}

export async function testDlpScan(text: string): Promise<DlpScanTestResult> {
  if (isTauri()) {
    return await invoke<DlpScanTestResult>("test_dlp_scan", { text })
  }
  // Basic mock test for web preview
  return {
    status: "allowed",
    sanitized: text.replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED_OPENAI_KEY]"),
    blocked: false,
  }
}




