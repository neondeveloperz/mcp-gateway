use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, Instant};

use crate::database::{
    execute_db_describe_table, execute_db_explain, execute_db_list_databases, execute_db_list_tables,
    execute_db_query, get_builtin_database_tools,
};
use crate::discovery::execute_remote_mcp;
use crate::security::{
    check_anti_loop, check_circuit_breaker, is_high_risk_tool, record_circuit_outcome,
    PendingApprovalInternal, PENDING_APPROVALS,
};
use crate::types::{load_configured_servers, GatewayServerConfig};

pub fn handle_json_rpc(body_str: &str) -> serde_json::Value {
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
                        "resources": { "listChanged": true },
                        "prompts": { "listChanged": true }
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
            let mut server_tools: Vec<(String, String, serde_json::Value)> = Vec::new();
            let mut tool_name_counts: HashMap<String, usize> = HashMap::new();

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
                                let slug = srv.name.to_lowercase().replace([' ', '-'], "_");
                                for t in tools_arr {
                                    if let Some(name) = t.get("name").and_then(|n| n.as_str()) {
                                        *tool_name_counts.entry(name.to_string()).or_insert(0) += 1;
                                    }
                                    server_tools.push((srv.name.clone(), slug.clone(), t.clone()));
                                }
                            }
                        }
                    }
                }
            }

            let mut all_tools: Vec<serde_json::Value> = Vec::new();
            for (srv_name, srv_slug, mut t) in server_tools {
                let orig_name = t.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                let has_collision = tool_name_counts.get(&orig_name).copied().unwrap_or(0) > 1;

                if let Some(obj) = t.as_object_mut() {
                    if has_collision {
                        let namespaced_name = format!("{}_{}", srv_slug, orig_name);
                        obj.insert("name".to_string(), serde_json::json!(namespaced_name));
                        let orig_desc = obj.get("description").and_then(|d| d.as_str()).unwrap_or("");
                        obj.insert(
                            "description".to_string(),
                            serde_json::json!(format!("[{}] {}", srv_name, orig_desc)),
                        );
                    }
                    let mut meta = obj.get("_meta").cloned().unwrap_or(serde_json::json!({}));
                    if let Some(meta_obj) = meta.as_object_mut() {
                        meta_obj.insert("server".to_string(), serde_json::json!(srv_name));
                        meta_obj.insert("originalName".to_string(), serde_json::json!(orig_name));
                        meta_obj.insert("isNamespaced".to_string(), serde_json::json!(has_collision));
                    }
                    obj.insert("_meta".to_string(), meta);
                }
                all_tools.push(t);
            }

            // Inject Built-in Database Universal Tools
            all_tools.extend(get_builtin_database_tools());

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
            let mut arguments = params.get("arguments").cloned().unwrap_or(serde_json::json!({}));

            // 1. Anti-Loop Guard Check (5 identical calls / 10s window)
            if let Err(loop_err) = check_anti_loop(tool_name, &arguments) {
                return serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": { "code": -32009, "message": loop_err }
                });
            }

            let servers = load_configured_servers();

            // 2. Intelligent Routing: check if tool_name has namespacing prefix (e.g. "coolify_xyz")
            let mut target_server: Option<GatewayServerConfig> = None;
            let mut target_tool_name = tool_name;

            for srv in &servers {
                let slug = srv.name.to_lowercase().replace([' ', '-'], "_");
                let prefix = format!("{}_", slug);
                if tool_name.starts_with(&prefix) {
                    target_server = Some(srv.clone());
                    target_tool_name = &tool_name[prefix.len()..];
                    break;
                }
            }

            let srv_name = target_server.as_ref().map(|s| s.name.clone()).unwrap_or_else(|| {
                if target_tool_name.starts_with("db_") {
                    let db_alias = arguments.get("database").and_then(|d| d.as_str()).unwrap_or("Database");
                    format!("Database ({})", db_alias)
                } else if target_tool_name.contains("procedure") || target_tool_name.contains("easypanel") {
                    "Easypanel".to_string()
                } else {
                    "Coolify".to_string()
                }
            });

            // 3. Hybrid Human-in-the-Loop (HITL) Guard
            if is_high_risk_tool(target_tool_name, &arguments) {
                let mut clean_args = arguments.clone();
                let ticket_provided = clean_args.get("security_ticket")
                    .or_else(|| clean_args.get("approval_ticket"))
                    .or_else(|| clean_args.get("_approval_ticket"))
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string());

                if let Some(obj) = clean_args.as_object_mut() {
                    obj.remove("security_ticket");
                    obj.remove("approval_ticket");
                    obj.remove("_approval_ticket");
                }

                let mut is_approved = false;
                let mut rejection_err: Option<String> = None;

                {
                    if let Ok(mut approvals) = PENDING_APPROVALS.lock() {
                        let now = Instant::now();
                        approvals.retain(|item| item.expires_at > now);

                        if let Some(ref ticket_code) = ticket_provided {
                            if let Some(pos) = approvals.iter().position(|i| i.ticket.eq_ignore_ascii_case(ticket_code)) {
                                if approvals[pos].status == "rejected" {
                                    rejection_err = Some("Security ticket was explicitly REJECTED by human operator on Desktop Gateway.".into());
                                } else {
                                    is_approved = true;
                                    approvals.remove(pos); // consume one-time token
                                }
                            } else {
                                rejection_err = Some(format!("Invalid or expired security ticket '{}'.", ticket_code));
                            }
                        } else {
                            // Check if previously approved on desktop UI for this tool & arguments
                            if let Some(pos) = approvals.iter().position(|i| {
                                i.tool_name == target_tool_name && i.status == "approved"
                            }) {
                                is_approved = true;
                                approvals.remove(pos);
                            }
                        }
                    }
                }

                if let Some(err_msg) = rejection_err {
                    return serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": { "code": -32001, "message": err_msg }
                    });
                }

                if !is_approved {
                    let now_millis = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
                    let rand_code = 1000 + (now_millis % 9000) as u32;
                    let ticket_code = format!("SEC-{}", rand_code);

                    let now = Instant::now();
                    let expires = now + Duration::from_secs(120);

                    if let Ok(mut approvals) = PENDING_APPROVALS.lock() {
                        approvals.push(PendingApprovalInternal {
                            ticket: ticket_code.clone(),
                            tool_name: target_tool_name.to_string(),
                            server_name: srv_name.clone(),
                            arguments: clean_args.clone(),
                            status: "pending".to_string(),
                            created_at_ms: now_millis,
                            expires_at_ms: now_millis + 120_000,
                            expires_at: expires,
                        });
                    }

                    let args_pretty = serde_json::to_string_pretty(&clean_args).unwrap_or_else(|_| clean_args.to_string());
                    return serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "isError": true,
                            "content": [
                                {
                                    "type": "text",
                                    "text": format!(
                                        "⚠️ [MCP GATEWAY SECURITY GUARD] HUMAN APPROVAL REQUIRED\n\nThis is a high-risk / destructive operation on server '{}'.\nTool: '{}'\nTarget Arguments:\n{}\n\n🔒 SECURITY TICKET: #{}\n\n👉 INSTRUCTIONS FOR AGENT:\n1. You MUST ask the human user for explicit approval in chat right now.\n2. When the user explicitly confirms (e.g. says 'yes', 'confirm', 'approve'), call this tool again with the additional argument: {{\"security_ticket\": \"{}\"}}.\n(Alternatively, the operator can click 'Approve' directly in the Desktop MCP Gateway UI).",
                                        srv_name, target_tool_name, args_pretty, ticket_code, ticket_code
                                    )
                                }
                            ]
                        }
                    });
                }

                // If approved, use clean_args (ticket stripped)
                arguments = clean_args;
            }

            // Built-in Database Universal Tools execution
            if target_tool_name.starts_with("db_") {
                let db_result = match target_tool_name {
                    "db_list_databases" => Ok(execute_db_list_databases()),
                    "db_list_tables" => {
                        let db_alias = arguments.get("database").and_then(|d| d.as_str()).unwrap_or("");
                        let schema = arguments.get("schema").and_then(|s| s.as_str());
                        execute_db_list_tables(db_alias, schema)
                    }
                    "db_describe_table" => {
                        let db_alias = arguments.get("database").and_then(|d| d.as_str()).unwrap_or("");
                        let table = arguments.get("table").and_then(|t| t.as_str()).unwrap_or("");
                        let schema = arguments.get("schema").and_then(|s| s.as_str());
                        execute_db_describe_table(db_alias, table, schema)
                    }
                    "db_query" => {
                        let db_alias = arguments.get("database").and_then(|d| d.as_str()).unwrap_or("");
                        let sql = arguments.get("sql").and_then(|s| s.as_str()).unwrap_or("");
                        let max_rows = arguments.get("max_rows").and_then(|m| m.as_u64()).map(|m| m as usize);
                        execute_db_query(db_alias, sql, max_rows)
                    }
                    "db_explain_query" => {
                        let db_alias = arguments.get("database").and_then(|d| d.as_str()).unwrap_or("");
                        let sql = arguments.get("sql").and_then(|s| s.as_str()).unwrap_or("");
                        execute_db_explain(db_alias, sql)
                    }
                    _ => Err(format!("Unknown database tool '{}'", target_tool_name)),
                };

                return match db_result {
                    Ok(val) => serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "content": [
                                {
                                    "type": "text",
                                    "text": serde_json::to_string_pretty(&val).unwrap_or_default()
                                }
                            ]
                        }
                    }),
                    Err(err_msg) => serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "isError": true,
                            "content": [
                                {
                                    "type": "text",
                                    "text": format!("Database Error: {}", err_msg)
                                }
                            ]
                        }
                    }),
                };
            }

            // Route directly to targeted server if namespaced
            if let Some(srv) = target_server {
                if srv.status.as_deref() == Some("standby") {
                    return serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": { "code": -32000, "message": format!("Server '{}' is in standby", srv.name) }
                    });
                }

                // Downstream Circuit Breaker Check
                if let Err(cb_err) = check_circuit_breaker(&srv.name) {
                    return serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": { "code": -32008, "message": cb_err }
                    });
                }

                if let Some(url) = srv.url {
                    let payload = serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": format!("call-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)),
                        "method": "tools/call",
                        "params": {
                            "name": target_tool_name,
                            "arguments": arguments
                        }
                    }).to_string();

                    match execute_remote_mcp(url, srv.auth_token, srv.headers, payload) {
                        Ok(res_str) => {
                            if let Ok(downstream_json) = serde_json::from_str::<serde_json::Value>(&res_str) {
                                if let Some(res) = downstream_json.get("result") {
                                    record_circuit_outcome(&srv.name, true);
                                    return serde_json::json!({
                                        "jsonrpc": "2.0",
                                        "id": id,
                                        "result": res
                                    });
                                } else if let Some(err) = downstream_json.get("error") {
                                    record_circuit_outcome(&srv.name, false);
                                    return serde_json::json!({
                                        "jsonrpc": "2.0",
                                        "id": id,
                                        "error": err
                                    });
                                }
                            }
                            record_circuit_outcome(&srv.name, false);
                        }
                        Err(e) => {
                            record_circuit_outcome(&srv.name, false);
                            return serde_json::json!({
                                "jsonrpc": "2.0",
                                "id": id,
                                "error": { "code": -32603, "message": format!("Downstream execution failed: {}", e) }
                            });
                        }
                    }
                }
            }

            // Fallback: Probe active servers
            let payload = serde_json::json!({
                "jsonrpc": "2.0",
                "id": format!("call-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)),
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            }).to_string();

            let mut last_error: Option<serde_json::Value> = None;

            for srv in servers {
                if srv.status.as_deref() == Some("standby") {
                    continue;
                }
                if check_circuit_breaker(&srv.name).is_err() {
                    continue;
                }
                if let Some(url) = srv.url {
                    if url.is_empty() {
                        continue;
                    }
                    if let Ok(res_str) = execute_remote_mcp(url, srv.auth_token, srv.headers, payload.clone()) {
                        if let Ok(downstream_json) = serde_json::from_str::<serde_json::Value>(&res_str) {
                            if let Some(res) = downstream_json.get("result") {
                                record_circuit_outcome(&srv.name, true);
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
        "resources/list" => {
            let servers = load_configured_servers();
            let mut all_resources: Vec<serde_json::Value> = Vec::new();

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

            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "resources": all_resources
                }
            })
        }
        "resources/read" => {
            let uri = params.get("uri").and_then(|u| u.as_str()).unwrap_or("");
            let payload = serde_json::json!({
                "jsonrpc": "2.0",
                "id": format!("read-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)),
                "method": "resources/read",
                "params": {
                    "uri": uri
                }
            }).to_string();

            let servers = load_configured_servers();
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
                            }
                        }
                    }
                }
            }

            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32002, "message": format!("Resource '{}' not found", uri) }
            })
        }
        "prompts/list" => {
            let servers = load_configured_servers();
            let mut all_prompts: Vec<serde_json::Value> = Vec::new();

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

            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "prompts": all_prompts
                }
            })
        }
        "prompts/get" => {
            let prompt_name = params.get("name").and_then(|n| n.as_str()).unwrap_or("");
            let arguments = params.get("arguments").cloned().unwrap_or(serde_json::json!({}));
            let payload = serde_json::json!({
                "jsonrpc": "2.0",
                "id": format!("prompt-get-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)),
                "method": "prompts/get",
                "params": {
                    "name": prompt_name,
                    "arguments": arguments
                }
            }).to_string();

            let servers = load_configured_servers();
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
                            }
                        }
                    }
                }
            }

            serde_json::json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32602, "message": format!("Prompt '{}' not found", prompt_name) }
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

pub fn handle_gateway_client(mut stream: TcpStream) {
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

pub fn start_embedded_gateway(port: u16) {
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

