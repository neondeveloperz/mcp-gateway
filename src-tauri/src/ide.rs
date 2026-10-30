use std::fs;
use serde::{Deserialize, Serialize};
use crate::types::home_dir;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IdeIntegrationStatus {
    pub ide: String,
    pub name: String,
    pub path: String,
    pub exists: bool,
    pub configured: bool,
    #[serde(rename = "mcpName")]
    pub mcp_name: String,
}

pub fn get_ide_status_list() -> Vec<IdeIntegrationStatus> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };

    let configs = vec![
        ("cursor", "Cursor", home.join(".cursor").join("mcp.json")),
        ("antigravity", "Google Antigravity", home.join(".gemini").join("config").join("mcp_config.json")),
        ("claude", "Claude Desktop", home.join("Library").join("Application Support").join("Claude").join("claude_desktop_config.json")),
        ("vscode", "VS Code (Cline / Roo)", home.join("Library").join("Application Support").join("Code").join("User").join("globalStorage").join("saoudrizwan.claude-dev").join("settings").join("cline_mcp_settings.json")),
    ];

    configs.into_iter().map(|(id, name, path)| {
        let path_str = path.to_string_lossy().to_string();
        let exists = path.exists();
        let mut configured = false;
        let mut mcp_name = "mcp-gateway".to_string();

        if exists {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(servers) = json.get("mcpServers").and_then(|s| s.as_object()) {
                        if servers.contains_key("mcp-gateway") {
                            configured = true;
                            mcp_name = "mcp-gateway".to_string();
                        } else if servers.contains_key("global-gateway") {
                            configured = true;
                            mcp_name = "global-gateway".to_string();
                        }
                    }
                }
            }
        }

        IdeIntegrationStatus {
            ide: id.to_string(),
            name: name.to_string(),
            path: path_str,
            exists,
            configured,
            mcp_name,
        }
    }).collect()
}

pub fn sync_ide_config_internal(ide: &str, port: u16) -> Result<String, String> {
    let Some(home) = home_dir() else {
        return Err("Could not determine user HOME directory".to_string());
    };

    let target_path = match ide {
        "cursor" => home.join(".cursor").join("mcp.json"),
        "antigravity" => home.join(".gemini").join("config").join("mcp_config.json"),
        "claude" => home.join("Library").join("Application Support").join("Claude").join("claude_desktop_config.json"),
        "vscode" => home.join("Library").join("Application Support").join("Code").join("User").join("globalStorage").join("saoudrizwan.claude-dev").join("settings").join("cline_mcp_settings.json"),
        _ => return Err(format!("Unsupported IDE identifier: {}", ide)),
    };

    if let Some(parent) = target_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let mut root_json: serde_json::Value = if target_path.exists() {
        let content = fs::read_to_string(&target_path).map_err(|e| format!("Failed to read {}: {}", target_path.display(), e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({ "mcpServers": {} }))
    } else {
        serde_json::json!({ "mcpServers": {} })
    };

    if !root_json.is_object() {
        root_json = serde_json::json!({ "mcpServers": {} });
    }

    let root_obj = root_json.as_object_mut().unwrap();
    if !root_obj.contains_key("mcpServers") || !root_obj["mcpServers"].is_object() {
        root_obj.insert("mcpServers".to_string(), serde_json::json!({}));
    }

    let servers_obj = root_obj.get_mut("mcpServers").unwrap().as_object_mut().unwrap();

    let entry = match ide {
        "cursor" => serde_json::json!({
            "url": format!("http://127.0.0.1:{}/sse", port),
            "transport": "sse"
        }),
        _ => serde_json::json!({
            "url": format!("http://127.0.0.1:{}/mcp", port)
        }),
    };

    servers_obj.insert("mcp-gateway".to_string(), entry);

    let formatted = serde_json::to_string_pretty(&root_json)
        .map_err(|e| format!("JSON serialization error: {}", e))?;

    fs::write(&target_path, formatted)
        .map_err(|e| format!("Failed to write {}: {}", target_path.display(), e))?;

    Ok(format!("Successfully configured MCP Gateway in {}", target_path.display()))
}

#[tauri::command]
pub fn get_ide_integration_status() -> Vec<IdeIntegrationStatus> {
    get_ide_status_list()
}

#[tauri::command]
pub fn sync_ide_config(ide_id: String) -> Result<String, String> {
    sync_ide_config_internal(&ide_id, 8080)
}

