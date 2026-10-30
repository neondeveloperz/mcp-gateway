use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::process::Command;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::webview::PageLoadEvent;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_opener::OpenerExt;

static APP_START: OnceLock<Instant> = OnceLock::new();

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiscoveredMcpServer {
    pub id: String,
    pub name: String,
    pub transport: String, // "stdio" | "sse" | "http"
    pub command: String,
    pub args: Vec<String>,
    pub url: String,
    pub source: String,
    pub status: String,
    pub latency_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SystemRuntimeInfo {
    pub pid: u32,
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub uptime_secs: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PingResult {
    pub success: bool,
    pub latency_ms: u64,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NativeMcpTool {
    pub name: String,
    pub server: String,
    pub description: String,
    pub parameters: serde_json::Value,
    pub category: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_system_info() -> SystemRuntimeInfo {
    let start_time = APP_START.get_or_init(Instant::now);
    let uptime = start_time.elapsed().as_secs();

    let hostname = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("HOST"))
        .unwrap_or_else(|_| {
            let output = Command::new("hostname").output();
            if let Ok(out) = output {
                String::from_utf8_lossy(&out.stdout).trim().to_string()
            } else {
                "localhost".to_string()
            }
        });

    SystemRuntimeInfo {
        pid: std::process::id(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        hostname,
        uptime_secs: uptime,
    }
}

fn home_dir() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(PathBuf::from)
}

#[tauri::command]
fn discover_mcp_servers() -> Vec<DiscoveredMcpServer> {
    let mut servers_map: HashMap<String, DiscoveredMcpServer> = HashMap::new();

    let Some(home) = home_dir() else {
        return Vec::new();
    };

    let config_paths = vec![
        (
            home.join(".cursor").join("mcp.json"),
            "Cursor (~/.cursor/mcp.json)",
        ),
        (
            home.join(".gemini").join("config").join("mcp_config.json"),
            "Antigravity/Gemini (~/.gemini/config/mcp_config.json)",
        ),
        (
            home.join(".copilot").join("mcp-config.json"),
            "Copilot (~/.copilot/mcp-config.json)",
        ),
        (
            home.join(".kimi-code").join("mcp.json"),
            "Kimi (~/.kimi-code/mcp.json)",
        ),
        (
            home.join(".factory").join("mcp.json"),
            "Factory (~/.factory/mcp.json)",
        ),
        (
            home.join(".mcp-gateway").join("servers.json"),
            "MCP Gateway (~/.mcp-gateway/servers.json)",
        ),
    ];

    for (path, source_label) in config_paths {
        if !path.exists() {
            continue;
        }

        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(mcp_servers) = json.get("mcpServers").and_then(|v| v.as_object()) {
                    for (name, val) in mcp_servers {
                        let url = val
                            .get("url")
                            .or_else(|| val.get("serverUrl"))
                            .and_then(|u| u.as_str())
                            .unwrap_or("")
                            .to_string();

                        let command = val
                            .get("command")
                            .and_then(|c| c.as_str())
                            .unwrap_or("")
                            .to_string();

                        let args = val
                            .get("args")
                            .and_then(|a| a.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|x| x.as_str().map(|s| s.to_string()))
                                    .collect::<Vec<String>>()
                            })
                            .unwrap_or_default();

                        let transport = if !url.is_empty() {
                            if url.contains("/sse") {
                                "sse".to_string()
                            } else {
                                "http".to_string()
                            }
                        } else {
                            "stdio".to_string()
                        };

                        let server = DiscoveredMcpServer {
                            id: format!("srv-{}", name),
                            name: name.clone(),
                            transport,
                            command,
                            args,
                            url,
                            source: source_label.to_string(),
                            status: "standby".to_string(),
                            latency_ms: 0,
                        };

                        servers_map.entry(name.clone()).or_insert(server);
                    }
                }
            }
        }
    }

    let mut result: Vec<DiscoveredMcpServer> = servers_map.into_values().collect();
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

#[tauri::command]
fn ping_mcp_server(target: &str, transport: &str) -> PingResult {
    let start = Instant::now();

    if transport == "http" || transport == "sse" || target.starts_with("http://") || target.starts_with("https://") {
        // Parse host and port
        let clean_url = target.replace("http://", "").replace("https://", "");
        let host_port_part = clean_url.split('/').next().unwrap_or(&clean_url);

        let socket_addr = if host_port_part.contains(':') {
            host_port_part.to_string()
        } else if target.starts_with("https://") {
            format!("{}:443", host_port_part)
        } else {
            format!("{}:80", host_port_part)
        };

        if let Ok(mut addrs) = socket_addr.to_socket_addrs() {
            if let Some(addr) = addrs.next() {
                match TcpStream::connect_timeout(&addr, Duration::from_millis(1500)) {
                    Ok(_) => {
                        let elapsed = start.elapsed().as_millis() as u64;
                        return PingResult {
                            success: true,
                            latency_ms: elapsed.max(1),
                            message: format!("Connected to {} in {}ms", addr, elapsed),
                        };
                    }
                    Err(e) => {
                        return PingResult {
                            success: false,
                            latency_ms: 0,
                            message: format!("Connection failed: {}", e),
                        };
                    }
                }
            }
        }

        PingResult {
            success: false,
            latency_ms: 0,
            message: format!("Could not resolve address: {}", host_port_part),
        }
    } else {
        // Stdio: verify executable exists in PATH
        let exec_cmd = target.split_whitespace().next().unwrap_or(target);
        let out = Command::new("which").arg(exec_cmd).output();
        let elapsed = start.elapsed().as_millis() as u64;

        match out {
            Ok(output) if output.status.success() => {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                PingResult {
                    success: true,
                    latency_ms: elapsed.max(1),
                    message: format!("Executable verified at {}", path),
                }
            }
            _ => PingResult {
                success: false,
                latency_ms: 0,
                message: format!("Executable '{}' not found in PATH", exec_cmd),
            },
        }
    }
}

#[tauri::command]
fn get_system_mcp_tools() -> Vec<NativeMcpTool> {
    let mut tools = Vec::new();
    let Some(home) = home_dir() else {
        return tools;
    };

    let mcp_dir = home.join(".gemini").join("antigravity").join("mcp");
    if mcp_dir.exists() {
        if let Ok(entries) = fs::read_dir(&mcp_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let server_name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    if let Ok(tool_files) = fs::read_dir(&path) {
                        for tool_file in tool_files.flatten() {
                            let tool_path = tool_file.path();
                            if tool_path.extension().and_then(|e| e.to_str()) == Some("json") {
                                if let Ok(content) = fs::read_to_string(&tool_path) {
                                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                                        let name = val
                                            .get("name")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("")
                                            .to_string();
                                        if !name.is_empty() {
                                            let description = val
                                                .get("description")
                                                .and_then(|v| v.as_str())
                                                .unwrap_or("")
                                                .to_string();
                                            let parameters = val
                                                .get("parameters")
                                                .cloned()
                                                .unwrap_or_else(|| serde_json::json!({}));
                                            let category = if name.contains("inspect") || name.contains("analyze") {
                                                "Analysis".to_string()
                                            } else if name.contains("frida") || name.contains("debug") || name.contains("gdb") {
                                                "Dynamic Hooks".to_string()
                                            } else if name.contains("adb") || name.contains("android") {
                                                "Mobile / ADB".to_string()
                                            } else if name.contains("web") || name.contains("browser") {
                                                "Web / Network".to_string()
                                            } else {
                                                "Reverse Engineering".to_string()
                                            };
                                            tools.push(NativeMcpTool {
                                                name,
                                                server: server_name.clone(),
                                                description,
                                                parameters,
                                                category,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    tools.sort_by(|a, b| a.name.cmp(&b.name));
    tools
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayServerConfig {
    pub id: String,
    pub name: String,
    pub transport: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub url: Option<String>,
    #[serde(rename = "authToken")]
    pub auth_token: Option<String>,
    pub headers: Option<std::collections::HashMap<String, String>>,
    pub status: Option<String>,
}

fn get_gateway_servers_path() -> Option<PathBuf> {
    home_dir().map(|h| h.join(".mcp_gateway").join("servers.json"))
}

fn load_configured_servers() -> Vec<GatewayServerConfig> {
    if let Some(path) = get_gateway_servers_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(servers) = serde_json::from_str::<Vec<GatewayServerConfig>>(&content) {
                    return servers;
                }
            }
        }
    }
    Vec::new()
}

#[tauri::command]
fn save_gateway_servers(servers_json: String) -> Result<(), String> {
    if let Some(path) = get_gateway_servers_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&path, servers_json).map_err(|e| format!("Failed to write servers file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn execute_remote_mcp(
    url: String,
    auth_token: Option<String>,
    headers: Option<std::collections::HashMap<String, String>>,
    payload: String,
) -> Result<String, String> {
    let mut cmd = Command::new("curl");
    cmd.arg("-s")
        .arg("-m")
        .arg("12")
        .arg("-X")
        .arg("POST")
        .arg("-H")
        .arg("Content-Type: application/json");

    let mut has_auth = false;
    if let Some(hdrs) = headers {
        for (k, v) in hdrs {
            if k.eq_ignore_ascii_case("authorization") {
                has_auth = true;
            }
            cmd.arg("-H").arg(format!("{}: {}", k, v));
        }
    }

    if !has_auth {
        if let Some(token) = auth_token {
            if !token.is_empty() {
                let auth_header = if token.starts_with("Bearer ") {
                    token
                } else {
                    format!("Bearer {}", token)
                };
                cmd.arg("-H").arg(format!("Authorization: {}", auth_header));
            }
        }
    }

    cmd.arg("-d").arg(&payload);
    cmd.arg(&url);

    let output = cmd.output().map_err(|e| format!("Failed to spawn curl: {}", e))?;
    if !output.status.success() {
        return Err(format!("curl failed with status code: {:?}", output.status.code()));
    }

    let response_text = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(response_text)
}

fn external_navigation_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::<R>::new("external-navigation")
        .on_navigation(|webview, url| {
            let is_internal_host = matches!(
                url.host_str(),
                Some("localhost") | Some("127.0.0.1") | Some("tauri.localhost") | Some("::1")
            );

            let is_internal = url.scheme() == "tauri" || is_internal_host;

            if is_internal {
                return true;
            }

            let is_external_link = matches!(url.scheme(), "http" | "https" | "mailto" | "tel");

            if is_external_link {
                log::info!("opening external link in system browser: {}", url);
                let _ = webview.opener().open_url(url.as_str(), None::<&str>);
                return false;
            }

            true
        })
        .build()
}

fn handle_json_rpc(body_str: &str) -> serde_json::Value {
    let Ok(val) = serde_json::from_str::<serde_json::Value>(body_str) else {
        return serde_json::json!({
            "jsonrpc": "2.0",
            "error": { "code": -32700, "message": "Parse error" }
        });
    };

    let id = val.get("id").cloned().unwrap_or(serde_json::Value::Null);
    let method = val.get("method").and_then(|m| m.as_str()).unwrap_or("");
    let params = val.get("params").cloned().unwrap_or(serde_json::json!({}));

    match method {
        "initialize" => {
            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": { "listChanged": true },
                        "resources": { "listChanged": false },
                        "prompts": { "listChanged": false }
                    },
                    "serverInfo": {
                        "name": "mcp-gateway-native",
                        "version": "1.0.0"
                    }
                }
            })
        }
        "notifications/initialized" => {
            serde_json::json!({
                "jsonrpc": "2.0",
                "result": {}
            })
        }
        "ping" => {
            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {}
            })
        }
        "tools/list" => {
            let servers = load_configured_servers();
            let mut all_tools: Vec<serde_json::Value> = Vec::new();

            for srv in servers {
                if srv.status.as_deref() == Some("standby") {
                    continue;
                }
                if let Some(url) = srv.url {
                    if url.is_empty() {
                        continue;
                    }
                    let payload = serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": format!("tools-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)),
                        "method": "tools/list",
                        "params": {}
                    }).to_string();

                    if let Ok(res_str) = execute_remote_mcp(url, srv.auth_token, srv.headers, payload) {
                        if let Ok(downstream_json) = serde_json::from_str::<serde_json::Value>(&res_str) {
                            if let Some(tools_arr) = downstream_json.get("result").and_then(|r| r.get("tools")).and_then(|t| t.as_array()) {
                                for t in tools_arr {
                                    all_tools.push(t.clone());
                                }
                            }
                        }
                    }
                }
            }

            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "tools": all_tools
                }
            })
        }
        "tools/call" => {
            let tool_name = params.get("name").and_then(|n| n.as_str()).unwrap_or("");
            let arguments = params.get("arguments").cloned().unwrap_or(serde_json::json!({}));

            let payload = serde_json::json!({
                "jsonrpc": "2.0",
                "id": format!("call-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)),
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            }).to_string();

            let servers = load_configured_servers();
            let mut last_error: Option<serde_json::Value> = None;

            for srv in servers {
                if srv.status.as_deref() == Some("standby") {
                    continue;
                }
                if let Some(url) = srv.url {
                    if url.is_empty() {
                        continue;
                    }
                    if let Ok(res_str) = execute_remote_mcp(url, srv.auth_token, srv.headers, payload.clone()) {
                        if let Ok(downstream_json) = serde_json::from_str::<serde_json::Value>(&res_str) {
                            if let Some(res) = downstream_json.get("result") {
                                return serde_json::json!({
                                    "jsonrpc": "2.0",
                                    "id": id,
                                    "result": res
                                });
                            } else if let Some(err) = downstream_json.get("error") {
                                last_error = Some(err.clone());
                            }
                        }
                    }
                }
            }

            if let Some(err) = last_error {
                return serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": err
                });
            }

            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": format!("Tool '{}' not found or execution failed on downstream servers", tool_name) }
            })
        }
        _ => {
            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32601, "message": format!("Method '{}' not found", method) }
            })
        }
    }
}

fn handle_gateway_client(mut stream: TcpStream) {
    let Ok(clone_stream) = stream.try_clone() else { return; };
    let mut reader = BufReader::new(clone_stream);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line).is_err() || first_line.is_empty() {
        return;
    }

    let parts: Vec<&str> = first_line.trim().split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }
    let method = parts[0];
    let path = parts[1];

    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).is_err() || line == "\r\n" || line == "\n" || line.is_empty() {
            break;
        }
        let lower = line.to_lowercase();
        if lower.starts_with("content-length:") {
            if let Some(val) = line.split(':').nth(1) {
                content_length = val.trim().parse().unwrap_or(0);
            }
        }
    }

    if method == "OPTIONS" {
        let response = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\nConnection: close\r\n\r\n";
        let _ = stream.write_all(response.as_bytes());
        return;
    }

    if method == "GET" && (path == "/" || path == "/health") {
        let servers = load_configured_servers();
        let server_names: Vec<String> = servers
            .into_iter()
            .filter(|s| s.status.as_deref() != Some("standby"))
            .map(|s| s.name)
            .collect();

        let json_body = serde_json::json!({
            "status": "healthy",
            "gateway": "mcp-gateway-native",
            "version": "1.0.0",
            "activeDownstreamServers": server_names,
            "sseEndpoint": "http://127.0.0.1:8080/sse"
        }).to_string();

        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            json_body.len(),
            json_body
        );
        let _ = stream.write_all(response.as_bytes());
        return;
    }

    if method == "GET" && (path.starts_with("/sse") || path.starts_with("/mcp")) {
        let session_id = format!("sess-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0));
        let headers = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: keep-alive\r\nAccess-Control-Allow-Origin: *\r\n\r\n";
        let _ = stream.write_all(headers.as_bytes());
        let _ = stream.flush();

        let endpoint_event = format!("event: endpoint\r\ndata: /messages?sessionId={}\r\n\r\n", session_id);
        let _ = stream.write_all(endpoint_event.as_bytes());
        let _ = stream.flush();

        loop {
            std::thread::sleep(Duration::from_secs(15));
            if stream.write_all(b": keep-alive\r\n\r\n").is_err() {
                break;
            }
            let _ = stream.flush();
        }
        return;
    }

    if method == "POST" && (path.starts_with("/messages") || path.starts_with("/mcp") || path == "/") {
        let mut body = vec![0u8; content_length];
        if content_length > 0 {
            let _ = reader.read_exact(&mut body);
        }
        let body_str = String::from_utf8_lossy(&body).to_string();

        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body_str) {
            let is_notification = val.get("id").is_none()
                || val.get("method").and_then(|m| m.as_str()).map(|m| m.starts_with("notifications/")).unwrap_or(false);
            if is_notification {
                let response = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                let _ = stream.write_all(response.as_bytes());
                let _ = stream.flush();
                return;
            }
        }

        let rpc_result = handle_json_rpc(&body_str);
        let json_res = serde_json::to_string(&rpc_result).unwrap_or_else(|_| "{}".to_string());
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            json_res.len(),
            json_res
        );
        let _ = stream.write_all(response.as_bytes());
        let _ = stream.flush();
        return;
    }

    let not_found = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    let _ = stream.write_all(not_found.as_bytes());
}

fn start_embedded_gateway(port: u16) {
    let addr = format!("127.0.0.1:{}", port);
    match TcpListener::bind(&addr) {
        Ok(listener) => {
            log::info!("🚀 Native Gateway Core listening on http://{}", addr);
            for stream in listener.incoming() {
                if let Ok(stream) = stream {
                    std::thread::spawn(move || {
                        handle_gateway_client(stream);
                    });
                }
            }
        }
        Err(e) => {
            log::warn!("Failed to bind native Gateway Core on {}: {}", addr, e);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    APP_START.get_or_init(Instant::now);

    tauri::Builder::default()
        .setup(|_app| {
            std::thread::spawn(|| {
                start_embedded_gateway(8080);
            });
            std::thread::spawn(|| {
                start_embedded_gateway(4444);
            });
            Ok(())
        })
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(external_navigation_plugin())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_info,
            discover_mcp_servers,
            ping_mcp_server,
            get_system_mcp_tools,
            execute_remote_mcp,
            save_gateway_servers
        ])
        .on_page_load(|webview, payload| {
            if webview.label() == "main" && matches!(payload.event(), PageLoadEvent::Finished) {
                log::info!("main webview finished loading");
                let _ = webview.window().show();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
