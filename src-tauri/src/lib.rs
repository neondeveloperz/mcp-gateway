use std::collections::HashMap;
use std::fs;
use std::net::{TcpStream, ToSocketAddrs};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    APP_START.get_or_init(Instant::now);

    tauri::Builder::default()
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
            ping_mcp_server
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
