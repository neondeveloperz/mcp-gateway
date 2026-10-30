use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

pub fn home_dir() -> Option<PathBuf> {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        return Some(PathBuf::from(profile));
    }
    if let Ok(home) = std::env::var("HOME") {
        return Some(PathBuf::from(home));
    }
    if let (Ok(drive), Ok(path)) = (std::env::var("HOMEDRIVE"), std::env::var("HOMEPATH")) {
        return Some(PathBuf::from(format!("{}{}", drive, path)));
    }
    None
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredMcpServer {
    pub id: String,
    pub name: String,
    pub transport: String, // "stdio" | "sse" | "http"
    pub command: String,
    pub args: Vec<String>,
    pub url: String,
    pub source: String,
    pub status: String,
    #[serde(alias = "latency_ms")]
    pub latency_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SystemRuntimeInfo {
    pub pid: u32,
    pub os: String,
    pub arch: String,
    pub hostname: String,
    pub uptime_secs: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
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

#[derive(Serialize, Deserialize, Clone, Debug)]
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
    #[serde(rename = "latencyMs")]
    pub latency_ms: Option<u64>,
    #[serde(rename = "toolsCount")]
    pub tools_count: Option<usize>,
    #[serde(rename = "resourcesCount")]
    pub resources_count: Option<usize>,
    pub source: Option<String>,
}

pub fn get_gateway_servers_path() -> Option<PathBuf> {
    home_dir().map(|h| h.join(".mcp_gateway").join("servers.json"))
}

pub fn load_configured_servers() -> Vec<GatewayServerConfig> {
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
pub fn load_gateway_servers() -> Vec<GatewayServerConfig> {
    load_configured_servers()
}

#[tauri::command]
pub fn save_gateway_servers(servers_json: String) -> Result<(), String> {
    if let Some(path) = get_gateway_servers_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&path, servers_json).map_err(|e| format!("Failed to write servers file: {}", e))?;
    }
    Ok(())
}
