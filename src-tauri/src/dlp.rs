use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::types::home_dir;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DlpRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String, // "secrets", "pci", "pii", "credentials"
    pub enabled: bool,
    pub action: String, // "mask", "block", "audit"
    pub severity: String, // "critical", "high", "medium", "low"
    pub mask_template: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DlpIncident {
    pub id: String,
    pub timestamp_ms: u64,
    pub rule_id: String,
    pub rule_name: String,
    pub category: String,
    pub severity: String,
    pub action_taken: String,
    pub tool_name: Option<String>,
    pub match_preview: String,
}

pub fn get_default_dlp_rules() -> Vec<DlpRule> {
    vec![
        DlpRule {
            id: "openai-api-key".to_string(),
            name: "OpenAI API Key".to_string(),
            description: "Detects OpenAI API secret keys (sk-...) and project keys".to_string(),
            category: "secrets".to_string(),
            enabled: true,
            action: "mask".to_string(),
            severity: "critical".to_string(),
            mask_template: "[REDACTED_OPENAI_KEY]".to_string(),
        },
        DlpRule {
            id: "anthropic-api-key".to_string(),
            name: "Anthropic API Key".to_string(),
            description: "Detects Anthropic API tokens (sk-ant-...)".to_string(),
            category: "secrets".to_string(),
            enabled: true,
            action: "mask".to_string(),
            severity: "critical".to_string(),
            mask_template: "[REDACTED_ANTHROPIC_KEY]".to_string(),
        },
        DlpRule {
            id: "github-token".to_string(),
            name: "GitHub Personal & OAuth Token".to_string(),
            description: "Detects GitHub PATs (ghp_), OAuth (gho_), and fine-grained tokens (github_pat_)".to_string(),
            category: "secrets".to_string(),
            enabled: true,
            action: "mask".to_string(),
            severity: "critical".to_string(),
            mask_template: "[REDACTED_GITHUB_TOKEN]".to_string(),
        },
        DlpRule {
            id: "aws-credentials".to_string(),
            name: "AWS Access Key & Secrets".to_string(),
            description: "Detects AWS Access Key IDs (AKIA...) and Secret Access Keys".to_string(),
            category: "secrets".to_string(),
            enabled: true,
            action: "mask".to_string(),
            severity: "critical".to_string(),
            mask_template: "[REDACTED_AWS_KEY]".to_string(),
        },
        DlpRule {
            id: "gemini-api-key".to_string(),
            name: "Google / Gemini API Key".to_string(),
            description: "Detects Google AI & Cloud API keys (AIza...)".to_string(),
            category: "secrets".to_string(),
            enabled: true,
            action: "mask".to_string(),
            severity: "critical".to_string(),
            mask_template: "[REDACTED_GOOGLE_KEY]".to_string(),
        },
        DlpRule {
            id: "slack-token".to_string(),
            name: "Slack Bot & User Token".to_string(),
            description: "Detects Slack bot and user tokens (xoxb-, xoxp-)".to_string(),
            category: "secrets".to_string(),
            enabled: true,
            action: "mask".to_string(),
            severity: "high".to_string(),
            mask_template: "[REDACTED_SLACK_TOKEN]".to_string(),
        },
        DlpRule {
            id: "jwt-token".to_string(),
            name: "JSON Web Token (JWT)".to_string(),
            description: "Detects standard three-part signed JWTs (eyJ...)".to_string(),
            category: "credentials".to_string(),
            enabled: true,
            action: "mask".to_string(),
            severity: "high".to_string(),
            mask_template: "[REDACTED_JWT_TOKEN]".to_string(),
        },
        DlpRule {
            id: "private-key".to_string(),
            name: "Cryptographic Private Key (PEM)".to_string(),
            description: "Detects RSA, EC, DSA, OpenSSH, and PGP private key blocks".to_string(),
            category: "secrets".to_string(),
            enabled: true,
            action: "block".to_string(),
            severity: "critical".to_string(),
            mask_template: "[REDACTED_PRIVATE_KEY]".to_string(),
        },
        DlpRule {
            id: "db-connection-password".to_string(),
            name: "Database Password in Connection URI".to_string(),
            description: "Detects plaintext credentials in postgresql://, mysql://, redis:// URIs".to_string(),
            category: "credentials".to_string(),
            enabled: true,
            action: "mask".to_string(),
            severity: "critical".to_string(),
            mask_template: "[REDACTED_DB_PASSWORD]".to_string(),
        },
        DlpRule {
            id: "credit-card".to_string(),
            name: "Payment Card (PCI-DSS)".to_string(),
            description: "Detects 13-19 digit Visa, Mastercard, Amex, Discover card numbers".to_string(),
            category: "pci".to_string(),
            enabled: true,
            action: "mask".to_string(),
            severity: "high".to_string(),
            mask_template: "[REDACTED_PAYMENT_CARD]".to_string(),
        },
        DlpRule {
            id: "email-address".to_string(),
            name: "Email Address (PII)".to_string(),
            description: "Detects email addresses in database results or tool responses".to_string(),
            category: "pii".to_string(),
            enabled: false,
            action: "mask".to_string(),
            severity: "medium".to_string(),
            mask_template: "[REDACTED_EMAIL]".to_string(),
        },
    ]
}

pub fn get_dlp_rules_path() -> Option<PathBuf> {
    home_dir().map(|h| h.join(".mcp_gateway").join("dlp_rules.json"))
}

pub fn get_dlp_incidents_path() -> Option<PathBuf> {
    home_dir().map(|h| h.join(".mcp_gateway").join("dlp_incidents.json"))
}

pub static DLP_RULES: std::sync::LazyLock<Mutex<Vec<DlpRule>>> = std::sync::LazyLock::new(|| {
    let mut list = get_default_dlp_rules();
    if let Some(path) = get_dlp_rules_path() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(saved) = serde_json::from_str::<Vec<DlpRule>>(&content) {
                list = saved;
            }
        }
    }
    Mutex::new(list)
});

pub static DLP_INCIDENTS: std::sync::LazyLock<Mutex<Vec<DlpIncident>>> = std::sync::LazyLock::new(|| {
    let mut list = Vec::new();
    if let Some(path) = get_dlp_incidents_path() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(saved) = serde_json::from_str::<Vec<DlpIncident>>(&content) {
                list = saved;
            }
        }
    }
    Mutex::new(list)
});

pub fn record_dlp_incident(incident: DlpIncident) {
    if let Ok(mut list) = DLP_INCIDENTS.lock() {
        list.insert(0, incident);
        list.truncate(200);
        if let Some(path) = get_dlp_incidents_path() {
            if let Ok(json) = serde_json::to_string_pretty(&*list) {
                let _ = std::fs::write(&path, json);
            }
        }
    }
}

// Luhn check for card numbers
fn is_valid_luhn(number: &str) -> bool {
    let digits: Vec<u32> = number.chars().filter_map(|c| c.to_digit(10)).collect();
    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }
    let mut sum = 0;
    let mut alternate = false;
    for &digit in digits.iter().rev() {
        if alternate {
            let doubled = digit * 2;
            sum += if doubled > 9 { doubled - 9 } else { doubled };
        } else {
            sum += digit;
        }
        alternate = !alternate;
    }
    sum % 10 == 0
}

#[derive(Clone, Debug)]
pub enum DlpEnforceResult {
    Allowed(String),
    Blocked {
        rule_name: String,
        reason: String,
    },
}

pub fn scan_and_enforce_dlp(input: &str, tool_name: Option<&str>) -> DlpEnforceResult {
    let rules = if let Ok(r) = DLP_RULES.lock() {
        r.clone()
    } else {
        get_default_dlp_rules()
    };

    let mut current_text = input.to_string();
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    for rule in rules.iter().filter(|r| r.enabled) {
        match rule.id.as_str() {
            "openai-api-key" => {
                let re = Regex::new(r"sk-(?:proj-)?[A-Za-z0-9_-]{20,}").unwrap();
                if let Some(mat) = re.find(&current_text) {
                    let preview = format!("sk-***{}", &mat.as_str()[mat.as_str().len().saturating_sub(4)..]);
                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: preview,
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains sensitive OpenAI API credentials".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            "anthropic-api-key" => {
                let re = Regex::new(r"sk-ant-[A-Za-z0-9_-]{20,}").unwrap();
                if let Some(mat) = re.find(&current_text) {
                    let preview = format!("sk-ant-***{}", &mat.as_str()[mat.as_str().len().saturating_sub(4)..]);
                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: preview,
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains sensitive Anthropic API credentials".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            "github-token" => {
                let re = Regex::new(r"(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})").unwrap();
                if let Some(mat) = re.find(&current_text) {
                    let preview = format!("gh***{}", &mat.as_str()[mat.as_str().len().saturating_sub(4)..]);
                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: preview,
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains sensitive GitHub access token".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            "aws-credentials" => {
                let re = Regex::new(r"AKIA[0-9A-Z]{16}").unwrap();
                if let Some(mat) = re.find(&current_text) {
                    let preview = format!("AKIA***{}", &mat.as_str()[mat.as_str().len().saturating_sub(4)..]);
                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: preview,
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains AWS access credentials".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            "gemini-api-key" => {
                let re = Regex::new(r"AIza[0-9A-Za-z\-_]{35}").unwrap();
                if let Some(mat) = re.find(&current_text) {
                    let preview = format!("AIza***{}", &mat.as_str()[mat.as_str().len().saturating_sub(4)..]);
                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: preview,
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains Google / Gemini API key".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            "slack-token" => {
                let re = Regex::new(r"xox[baprs]-[0-9A-Za-z-]{10,}").unwrap();
                if let Some(mat) = re.find(&current_text) {
                    let preview = format!("xox***{}", &mat.as_str()[mat.as_str().len().saturating_sub(4)..]);
                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: preview,
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains Slack authentication token".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            "jwt-token" => {
                let re = Regex::new(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}").unwrap();
                if let Some(mat) = re.find(&current_text) {
                    let preview = format!("eyJ***.***.{}", &mat.as_str()[mat.as_str().len().saturating_sub(6)..]);
                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: preview,
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains signed JSON Web Token".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            "private-key" => {
                let re = Regex::new(r"-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----").unwrap();
                if re.is_match(&current_text) {
                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: "-----BEGIN PRIVATE KEY----- [MASKED]".to_string(),
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains raw cryptographic private key".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            "db-connection-password" => {
                let re = Regex::new(r#"(?i)((?:postgres(?:ql)?|mysql|mariadb|redis|rediss|mongodb(?:\+srv)?)://[^:]+:)([^@]+)(@)"#).unwrap();
                if let Some(_) = re.find(&current_text) {
                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: "db://user:****@host".to_string(),
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains database connection URI with plaintext password".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, format!("${{1}}{}${{3}}", rule.mask_template).as_str()).into_owned();
                    }
                }
            }
            "credit-card" => {
                let re = Regex::new(r"\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{13,19}\b").unwrap();
                let mut found_card = false;
                for mat in re.find_iter(&current_text) {
                    let cleaned = mat.as_str().replace([' ', '-'], "");
                    if is_valid_luhn(&cleaned) {
                        found_card = true;
                        let preview = format!("**** **** **** {}", &cleaned[cleaned.len().saturating_sub(4)..]);
                        record_dlp_incident(DlpIncident {
                            id: format!("inc-{}", now_ms),
                            timestamp_ms: now_ms,
                            rule_id: rule.id.clone(),
                            rule_name: rule.name.clone(),
                            category: rule.category.clone(),
                            severity: rule.severity.clone(),
                            action_taken: rule.action.clone(),
                            tool_name: tool_name.map(|s| s.to_string()),
                            match_preview: preview,
                        });
                        break;
                    }
                }

                if found_card {
                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains sensitive Payment Card details (PCI-DSS violation)".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            "email-address" => {
                let re = Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b").unwrap();
                if let Some(mat) = re.find(&current_text) {
                    let email = mat.as_str();
                    let parts: Vec<&str> = email.split('@').collect();
                    let preview = if parts.len() == 2 {
                        format!("{}***@{}", &parts[0][..1.min(parts[0].len())], parts[1])
                    } else {
                        "***@***".to_string()
                    };

                    record_dlp_incident(DlpIncident {
                        id: format!("inc-{}", now_ms),
                        timestamp_ms: now_ms,
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        category: rule.category.clone(),
                        severity: rule.severity.clone(),
                        action_taken: rule.action.clone(),
                        tool_name: tool_name.map(|s| s.to_string()),
                        match_preview: preview,
                    });

                    if rule.action == "block" {
                        return DlpEnforceResult::Blocked {
                            rule_name: rule.name.clone(),
                            reason: "Response contains personal identifiable email address (PII)".to_string(),
                        };
                    } else if rule.action == "mask" {
                        current_text = re.replace_all(&current_text, &rule.mask_template).into_owned();
                    }
                }
            }
            _ => {}
        }
    }

    DlpEnforceResult::Allowed(current_text)
}

#[tauri::command]
pub fn get_dlp_rules() -> Vec<DlpRule> {
    if let Ok(r) = DLP_RULES.lock() {
        r.clone()
    } else {
        get_default_dlp_rules()
    }
}

#[tauri::command]
pub fn save_dlp_rules(rules: Vec<DlpRule>) -> Result<(), String> {
    if let Some(path) = get_dlp_rules_path() {
        if let Ok(json) = serde_json::to_string_pretty(&rules) {
            let _ = std::fs::write(&path, json);
        }
    }
    if let Ok(mut r) = DLP_RULES.lock() {
        *r = rules;
    }
    Ok(())
}

#[tauri::command]
pub fn get_dlp_incidents() -> Vec<DlpIncident> {
    if let Ok(list) = DLP_INCIDENTS.lock() {
        list.clone()
    } else {
        Vec::new()
    }
}

#[tauri::command]
pub fn clear_dlp_incidents() -> Result<(), String> {
    if let Ok(mut list) = DLP_INCIDENTS.lock() {
        list.clear();
        if let Some(path) = get_dlp_incidents_path() {
            let _ = std::fs::write(&path, "[]");
        }
    }
    Ok(())
}

#[tauri::command]
pub fn test_dlp_scan(text: String) -> serde_json::Value {
    let result = scan_and_enforce_dlp(&text, Some("test_tool"));
    match result {
        DlpEnforceResult::Allowed(sanitized) => {
            serde_json::json!({
                "status": "allowed",
                "sanitized": sanitized,
                "blocked": false
            })
        }
        DlpEnforceResult::Blocked { rule_name, reason } => {
            serde_json::json!({
                "status": "blocked",
                "ruleName": rule_name,
                "reason": reason,
                "blocked": true
            })
        }
    }
}

