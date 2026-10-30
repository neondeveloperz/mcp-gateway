use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudflareTunnelStatus {
    #[serde(rename = "isInstalled")]
    pub is_installed: bool,
    #[serde(rename = "isRunning")]
    pub is_running: bool,
    #[serde(rename = "publicUrl")]
    pub public_url: Option<String>,
    pub mode: String,
    pub pid: Option<u32>,
    #[serde(rename = "binaryPath")]
    pub binary_path: Option<String>,
    pub error: Option<String>,
}

pub static TUNNEL_CHILD: std::sync::LazyLock<Mutex<Option<Child>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));
pub static TUNNEL_URL: std::sync::LazyLock<Mutex<Option<String>>> =
    std::sync::LazyLock::new(|| Mutex::new(None));
pub static TUNNEL_MODE: std::sync::LazyLock<Mutex<String>> =
    std::sync::LazyLock::new(|| Mutex::new("quick".to_string()));

pub fn find_cloudflared_binary() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let mut candidates = Vec::new();
        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(PathBuf::from(pf86).join("cloudflared").join("cloudflared.exe"));
        }
        if let Ok(pf) = std::env::var("ProgramFiles") {
            candidates.push(PathBuf::from(pf).join("cloudflared").join("cloudflared.exe"));
        }
        if let Ok(pd) = std::env::var("ProgramData") {
            candidates.push(PathBuf::from(pd).join("chocolatey").join("bin").join("cloudflared.exe"));
        }
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(&local_app_data).join("bin").join("cloudflared.exe"));
            candidates.push(PathBuf::from(&local_app_data).join("cloudflared").join("cloudflared.exe"));
        }

        for p in candidates {
            if p.exists() {
                return Some(p);
            }
        }

        if let Ok(output) = Command::new("where").arg("cloudflared").output() {
            if output.status.success() {
                if let Some(first_line) = String::from_utf8_lossy(&output.stdout).lines().next() {
                    let trimmed = first_line.trim();
                    if !trimmed.is_empty() {
                        let p = PathBuf::from(trimmed);
                        if p.exists() {
                            return Some(p);
                        }
                    }
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        let candidates = [
            "/opt/homebrew/bin/cloudflared",
            "/usr/local/bin/cloudflared",
            "/usr/bin/cloudflared",
        ];
        for path in &candidates {
            let p = PathBuf::from(path);
            if p.exists() {
                return Some(p);
            }
        }
        if let Ok(output) = Command::new("which").arg("cloudflared").output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !s.is_empty() {
                    return Some(PathBuf::from(s));
                }
            }
        }
    }

    None
}

#[tauri::command]
pub fn get_cloudflare_tunnel_status() -> CloudflareTunnelStatus {
    let bin = find_cloudflared_binary();
    let is_installed = bin.is_some();
    let binary_path = bin.map(|b| b.to_string_lossy().to_string());

    let mut is_running = false;
    let mut pid: Option<u32> = None;

    if let Ok(mut lock) = TUNNEL_CHILD.lock() {
        if let Some(ref mut child) = *lock {
            match child.try_wait() {
                Ok(None) => {
                    is_running = true;
                    pid = Some(child.id());
                }
                _ => {
                    *lock = None;
                    if let Ok(mut url_lock) = TUNNEL_URL.lock() {
                        *url_lock = None;
                    }
                }
            }
        }
    }

    let public_url = TUNNEL_URL.lock().ok().and_then(|u| u.clone());
    let mode = TUNNEL_MODE.lock().map(|m| m.clone()).unwrap_or_else(|_| "quick".to_string());

    CloudflareTunnelStatus {
        is_installed,
        is_running,
        public_url,
        mode,
        pid,
        binary_path,
        error: None,
    }
}

#[tauri::command]
pub fn stop_cloudflare_tunnel() -> Result<(), String> {
    if let Ok(mut lock) = TUNNEL_CHILD.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
    if let Ok(mut url_lock) = TUNNEL_URL.lock() {
        *url_lock = None;
    }
    Ok(())
}

#[tauri::command]
pub fn start_cloudflare_tunnel(mode: String, token: Option<String>, port: Option<u16>) -> Result<CloudflareTunnelStatus, String> {
    let Some(bin_path) = find_cloudflared_binary() else {
        return Err("cloudflared binary not found. Please install it using 'brew install cloudflared'".to_string());
    };

    let _ = stop_cloudflare_tunnel();

    let target_port = port.unwrap_or(8080);
    let mut cmd = Command::new(&bin_path);

    if mode == "token" {
        let Some(t) = token else {
            return Err("Tunnel token is required for Named Tunnel mode".to_string());
        };
        if t.trim().is_empty() {
            return Err("Tunnel token cannot be empty".to_string());
        }
        cmd.arg("tunnel").arg("run").arg("--token").arg(t.trim());
    } else {
        cmd.arg("tunnel")
            .arg("--url")
            .arg(format!("http://127.0.0.1:{}", target_port));
    }

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn cloudflared: {}", e))?;
    let child_pid = child.id();

    let stderr = child.stderr.take();
    let re_url = Regex::new(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com").unwrap();

    let mut discovered_url: Option<String> = None;

    if let Some(err_stream) = stderr {
        let reader = BufReader::new(err_stream);
        let (tx, rx) = std::sync::mpsc::channel();

        std::thread::spawn(move || {
            for line in reader.lines().map_while(Result::ok) {
                if let Some(matched) = re_url.find(&line) {
                    let _ = tx.send(matched.as_str().to_string());
                }
            }
        });

        if let Ok(url) = rx.recv_timeout(Duration::from_secs(8)) {
            discovered_url = Some(url);
        }
    }

    if let Ok(mut mode_lock) = TUNNEL_MODE.lock() {
        *mode_lock = mode.clone();
    }
    if let Ok(mut url_lock) = TUNNEL_URL.lock() {
        *url_lock = discovered_url.clone();
    }
    if let Ok(mut child_lock) = TUNNEL_CHILD.lock() {
        *child_lock = Some(child);
    }

    Ok(CloudflareTunnelStatus {
        is_installed: true,
        is_running: true,
        public_url: discovered_url,
        mode,
        pid: Some(child_pid),
        binary_path: Some(bin_path.to_string_lossy().to_string()),
        error: None,
    })
}

