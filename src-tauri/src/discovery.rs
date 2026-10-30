use std::collections::HashMap;
use std::fs;
use std::net::{TcpStream, ToSocketAddrs};
use std::process::Command;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use crate::types::{home_dir, load_configured_servers, DiscoveredMcpServer, NativeMcpTool, PingResult, SystemRuntimeInfo};

static APP_START: OnceLock<Instant> = OnceLock::new();

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub fn get_system_info() -> SystemRuntimeInfo {
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

#[tauri::command]
pub fn discover_mcp_servers() -> Vec<DiscoveredMcpServer> {
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
pub fn ping_mcp_server(target: &str, transport: &str) -> PingResult {
    let start = Instant::now();

    if transport == "http" || transport == "sse" || target.starts_with("http://") || target.starts_with("https://") {
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
pub fn get_system_mcp_tools() -> Vec<NativeMcpTool> {
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

#[tauri::command]
pub fn execute_remote_mcp(
    url: String,
    auth_token: Option<String>,
    headers: Option<HashMap<String, String>>,
    payload: String,
) -> Result<String, String> {
    let mut cmd = Command::new("curl");
    cmd.arg("-s")
        .arg("-m")
        .arg("12")
        .arg("-X")
        .arg("POST");

    let mut has_auth = false;
    let mut has_accept = false;
    let mut has_content_type = false;

    if let Some(hdrs) = headers {
        for (k, v) in hdrs {
            if k.eq_ignore_ascii_case("authorization") {
                has_auth = true;
            }
            if k.eq_ignore_ascii_case("accept") {
                has_accept = true;
            }
            if k.eq_ignore_ascii_case("content-type") {
                has_content_type = true;
            }
            cmd.arg("-H").arg(format!("{}: {}", k, v));
        }
    }

    if !has_content_type {
        cmd.arg("-H").arg("Content-Type: application/json");
    }
    if !has_accept {
        cmd.arg("-H").arg("Accept: application/json, text/event-stream");
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

#[tauri::command]
pub fn get_gateway_resources() -> Vec<serde_json::Value> {
    let servers = load_configured_servers();
    let mut all_resources = Vec::new();
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
                "id": format!("res-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)),
                "method": "resources/list",
                "params": {}
            }).to_string();

            if let Ok(res_str) = execute_remote_mcp(url, srv.auth_token, srv.headers, payload) {
                if let Ok(downstream_json) = serde_json::from_str::<serde_json::Value>(&res_str) {
                    if let Some(arr) = downstream_json.get("result").and_then(|r| r.get("resources")).and_then(|t| t.as_array()) {
                        for r in arr {
                            let mut item = r.clone();
                            if item.get("server").is_none() {
                                if let Some(obj) = item.as_object_mut() {
                                    obj.insert("server".to_string(), serde_json::json!(srv.name));
                                }
                            }
                            all_resources.push(item);
                        }
                    }
                }
            }
        }
    }
    all_resources
}

#[tauri::command]
pub fn get_gateway_prompts() -> Vec<serde_json::Value> {
    let servers = load_configured_servers();
    let mut all_prompts = Vec::new();
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
                "id": format!("prompts-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)),
                "method": "prompts/list",
                "params": {}
            }).to_string();

            if let Ok(res_str) = execute_remote_mcp(url, srv.auth_token, srv.headers, payload) {
                if let Ok(downstream_json) = serde_json::from_str::<serde_json::Value>(&res_str) {
                    if let Some(arr) = downstream_json.get("result").and_then(|r| r.get("prompts")).and_then(|t| t.as_array()) {
                        for p in arr {
                            let mut item = p.clone();
                            if item.get("server").is_none() {
                                if let Some(obj) = item.as_object_mut() {
                                    obj.insert("server".to_string(), serde_json::json!(srv.name));
                                }
                            }
                            all_prompts.push(item);
                        }
                    }
                }
            }
        }
    }
    all_prompts
}
