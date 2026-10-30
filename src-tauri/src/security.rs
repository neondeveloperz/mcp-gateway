use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug)]
pub struct CircuitBreakerState {
    pub consecutive_failures: u32,
    pub tripped_until: Option<Instant>,
}

pub static CIRCUIT_BREAKERS: std::sync::LazyLock<Mutex<HashMap<String, CircuitBreakerState>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn check_circuit_breaker(server_name: &str) -> Result<(), String> {
    if let Ok(cb) = CIRCUIT_BREAKERS.lock() {
        if let Some(state) = cb.get(server_name) {
            if let Some(tripped) = state.tripped_until {
                if Instant::now() < tripped {
                    let secs_left = tripped.duration_since(Instant::now()).as_secs();
                    return Err(format!(
                        "⚡ Circuit breaker tripped for '{}' due to consecutive downstream failures. Cooldown active for {}s.",
                        server_name, secs_left
                    ));
                }
            }
        }
    }
    Ok(())
}

pub fn record_circuit_outcome(server_name: &str, is_success: bool) {
    if let Ok(mut cb) = CIRCUIT_BREAKERS.lock() {
        let entry = cb.entry(server_name.to_string()).or_insert(CircuitBreakerState {
            consecutive_failures: 0,
            tripped_until: None,
        });

        if is_success {
            entry.consecutive_failures = 0;
            entry.tripped_until = None;
        } else {
            entry.consecutive_failures += 1;
            if entry.consecutive_failures >= 3 {
                entry.tripped_until = Some(Instant::now() + Duration::from_secs(30));
            }
        }
    }
}

pub static ANTI_LOOP_CALLS: std::sync::LazyLock<Mutex<Vec<(u64, Instant)>>> =
    std::sync::LazyLock::new(|| Mutex::new(Vec::new()));

pub fn is_sql_mutation(sql: &str) -> bool {
    let lower = sql.to_lowercase();
    let re = Regex::new(r"(?i)\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|vacuum|copy)\b").unwrap();
    re.is_match(&lower)
}

pub fn is_redis_mutation(query: &str) -> bool {
    let trimmed = query.trim();
    let first_word = trimmed.split_whitespace().next().unwrap_or("").to_lowercase();
    matches!(
        first_word.as_str(),
        "set"
            | "setnx"
            | "setex"
            | "mset"
            | "msetnx"
            | "del"
            | "unlink"
            | "expire"
            | "pexpire"
            | "expireat"
            | "persist"
            | "rename"
            | "renamenx"
            | "hset"
            | "hsetnx"
            | "hmset"
            | "hdel"
            | "hincrby"
            | "hincrbyfloat"
            | "lpush"
            | "rpush"
            | "lpushx"
            | "rpushx"
            | "lpop"
            | "rpop"
            | "lrem"
            | "lset"
            | "ltrim"
            | "rpoplpush"
            | "sadd"
            | "srem"
            | "spop"
            | "smove"
            | "zadd"
            | "zrem"
            | "zincrby"
            | "zremrangebyrank"
            | "zremrangebyscore"
            | "incr"
            | "decr"
            | "incrby"
            | "decrby"
            | "incrbyfloat"
            | "flushall"
            | "flushdb"
            | "restore"
            | "migrate"
            | "copy"
    )
}

pub fn is_high_risk_tool(tool_name: &str, arguments: &serde_json::Value) -> bool {
    let lower_name = tool_name.to_lowercase();

    if lower_name == "db_query" {
        if let Some(sql) = arguments.get("sql").and_then(|s| s.as_str()) {
            return is_sql_mutation(sql) || is_redis_mutation(sql);
        }
    }

    if lower_name.contains("destructive")
        || lower_name.contains("delete")
        || lower_name.contains("drop")
        || lower_name.contains("destroy")
        || lower_name.contains("cleanup")
        || lower_name.contains("kill")
        || lower_name.contains("truncate")
        || lower_name.contains("rollback")
    {
        return true;
    }

    if lower_name == "execute_destructive" || lower_name.ends_with("_execute_destructive") {
        return true;
    }

    if let Some(proc) = arguments.get("procedure").and_then(|p| p.as_str()) {
        let p_lower = proc.to_lowercase();
        if p_lower.contains("delete")
            || p_lower.contains("destroy")
            || p_lower.contains("drop")
            || p_lower.contains("remove")
        {
            return true;
        }
    }

    false
}

pub fn check_anti_loop(tool_name: &str, arguments: &serde_json::Value) -> Result<(), String> {
    let mut hasher = DefaultHasher::new();
    tool_name.hash(&mut hasher);
    arguments.to_string().hash(&mut hasher);
    let call_hash = hasher.finish();

    let now = Instant::now();
    let window = Duration::from_secs(10);

    if let Ok(mut history) = ANTI_LOOP_CALLS.lock() {
        history.retain(|(_, timestamp)| now.duration_since(*timestamp) < window);

        let identical_count = history.iter().filter(|(h, _)| *h == call_hash).count();
        if identical_count >= 5 {
            return Err(format!(
                "🛑 Anti-Loop Guard: Tool '{}' called with identical arguments {} times in 10s. Runaway loop halted to protect backend systems.",
                tool_name, identical_count + 1
            ));
        }

        history.push((call_hash, now));
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PendingApprovalInternal {
    pub ticket: String,
    pub tool_name: String,
    pub server_name: String,
    pub arguments: serde_json::Value,
    pub status: String,
    pub created_at_ms: u64,
    pub expires_at_ms: u64,
    #[serde(skip, default = "Instant::now")]
    pub expires_at: Instant,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PendingApproval {
    pub ticket: String,
    #[serde(rename = "toolName")]
    pub tool_name: String,
    #[serde(rename = "serverName")]
    pub server_name: String,
    pub arguments: serde_json::Value,
    pub status: String,
    #[serde(rename = "createdAtMs")]
    pub created_at_ms: u64,
    #[serde(rename = "expiresAtMs")]
    pub expires_at_ms: u64,
}

pub static PENDING_APPROVALS: std::sync::LazyLock<Mutex<Vec<PendingApprovalInternal>>> =
    std::sync::LazyLock::new(|| Mutex::new(Vec::new()));

#[tauri::command]
pub fn get_pending_approvals() -> Vec<PendingApproval> {
    if let Ok(mut approvals) = PENDING_APPROVALS.lock() {
        let now = Instant::now();
        approvals.retain(|item| item.expires_at > now);

        return approvals
            .iter()
            .map(|i| PendingApproval {
                ticket: i.ticket.clone(),
                tool_name: i.tool_name.clone(),
                server_name: i.server_name.clone(),
                arguments: i.arguments.clone(),
                status: i.status.clone(),
                created_at_ms: i.created_at_ms,
                expires_at_ms: i.expires_at_ms,
            })
            .collect();
    }
    Vec::new()
}

#[tauri::command]
pub fn resolve_approval(ticket: String, action: String) -> Result<(), String> {
    if let Ok(mut approvals) = PENDING_APPROVALS.lock() {
        if let Some(pos) = approvals.iter().position(|i| i.ticket.eq_ignore_ascii_case(&ticket)) {
            if action == "approve" {
                approvals[pos].status = "approved".to_string();
                log::info!("Security ticket #{} approved by desktop human operator", ticket);
                return Ok(());
            } else {
                approvals[pos].status = "rejected".to_string();
                log::warn!("Security ticket #{} rejected by desktop human operator", ticket);
                return Ok(());
            }
        }
    }
    Err(format!("Ticket '{}' not found or expired", ticket))
}

pub fn redact_secrets(input: &str) -> String {
    // 1. Redact Bearer tokens
    let re_bearer = Regex::new(r"(?i)Bearer\s+([A-Za-z0-9_\-\|\.]{8,})").unwrap();
    let res = re_bearer.replace_all(input, "Bearer [REDACTED_TOKEN]");

    // 2. Redact password, auth_token, token, apiKey in JSON/key-value
    let re_json = Regex::new(r#"(?i)("?(?:password|token|authToken|auth_token|apiKey|api_key|secret|client_secret)"?\s*:\s*")([^"]+)(")"#).unwrap();
    let res = re_json.replace_all(&res, "${1}[REDACTED_SECRET]${3}");

    // 3. Redact PEM private keys
    let re_pem = Regex::new(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----").unwrap();
    let res = re_pem.replace_all(&res, "[REDACTED_PRIVATE_KEY]");

    // 4. Redact database passwords in connection URIs (postgres://..., mysql://..., redis://...)
    let re_db_uri = Regex::new(r#"(?i)((?:postgres(?:ql)?|mysql|mariadb|redis|rediss)://[^:]*:)([^@]+)(@)"#).unwrap();
    let res = re_db_uri.replace_all(&res, "${1}[REDACTED_PASSWORD]${3}");

    res.into_owned()
}

#[tauri::command]
pub fn redact_secrets_text(input: String) -> String {
    redact_secrets(&input)
}
