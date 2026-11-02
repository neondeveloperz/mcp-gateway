pub mod discovery;
pub mod dlp;
pub mod gateway;
pub mod ide;
pub mod security;
pub mod tunnel;
pub mod types;

use tauri::menu::MenuBuilder;
use tauri::menu::MenuItemBuilder;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::PageLoadEvent;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_opener::OpenerExt;

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

fn setup_system_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItemBuilder::with_id("show", "Open MCP Gateway").build(app)?;
    let status_item = MenuItemBuilder::with_id("status", "● Core Active (Port 8080)").enabled(false).build(app)?;
    let copy_item = MenuItemBuilder::with_id("copy_sse", "Copy SSE Endpoint (8080)").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit MCP Gateway").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .separator()
        .item(&show_item)
        .item(&copy_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let mut builder = TrayIconBuilder::new().menu(&menu).show_menu_on_left_click(false);

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "copy_sse" => {
                log::info!("SSE Endpoint: http://127.0.0.1:8080/sse");
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

pub fn run_headless(args: &[String]) {
    println!("============================================================");
    println!("   🚀 MCP Gateway Core (Headless Daemon Mode)");
    println!("   Protocol: Model Context Protocol (MCP) 2024-11-05");
    println!("============================================================");

    let mut port = 8080u16;
    let mut host = "127.0.0.1".to_string();

    let mut i = 0;
    while i < args.len() {
        if (args[i] == "--port" || args[i] == "-p") && i + 1 < args.len() {
            if let Ok(p) = args[i + 1].parse::<u16>() {
                port = p;
            }
            i += 1;
        } else if (args[i] == "--host" || args[i] == "-h") && i + 1 < args.len() {
            host = args[i + 1].clone();
            i += 1;
        }
        i += 1;
    }

    if let Ok(env_p) = std::env::var("MCP_GATEWAY_PORT") {
        if let Ok(p) = env_p.parse::<u16>() {
            port = p;
        }
    }
    if let Ok(env_h) = std::env::var("MCP_GATEWAY_HOST") {
        host = env_h;
    }

    println!("📍 Gateway Core SSE Endpoint: http://{}:{}/sse", host, port);
    println!("🛡️  Zero-Trust DLP & Security Guardrails: Active");
    println!("✨ Press Ctrl+C to terminate daemon.\n");

    let h = host.clone();
    std::thread::spawn(move || {
        gateway::start_embedded_gateway_with_host(&h, port);
    });

    loop {
        std::thread::sleep(std::time::Duration::from_secs(3600));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Err(err) = setup_system_tray(app) {
                log::warn!("Failed to setup system tray: {}", err);
            }

            std::thread::spawn(|| {
                gateway::start_embedded_gateway(8080);
            });
            std::thread::spawn(|| {
                gateway::start_embedded_gateway(4444);
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Background daemon: keep gateway running and hide window to tray
                api.prevent_close();
                let _ = window.hide();
                log::info!("Window minimized to system tray. MCP Gateway Core remains active in background.");
            }
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
            discovery::greet,
            discovery::get_system_info,
            discovery::discover_mcp_servers,
            discovery::ping_mcp_server,
            discovery::get_system_mcp_tools,
            discovery::execute_remote_mcp,
            discovery::get_gateway_resources,
            discovery::get_gateway_prompts,
            types::save_gateway_servers,
            types::load_gateway_servers,
            ide::get_ide_integration_status,
            ide::sync_ide_config,
            security::redact_secrets_text,
            security::get_pending_approvals,
            security::resolve_approval,
            dlp::get_dlp_rules,
            dlp::save_dlp_rules,
            dlp::get_dlp_incidents,
            dlp::clear_dlp_incidents,
            dlp::test_dlp_scan,
            tunnel::get_cloudflare_tunnel_status,
            tunnel::start_cloudflare_tunnel,
            tunnel::stop_cloudflare_tunnel,
            gateway::get_gateway_traffic_logs,
            gateway::clear_gateway_traffic_logs
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
