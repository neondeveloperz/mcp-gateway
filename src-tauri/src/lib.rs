pub mod database;
pub mod discovery;
pub mod gateway;
pub mod ide;
pub mod security;
pub mod tunnel;
pub mod types;

use tauri::webview::PageLoadEvent;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            std::thread::spawn(|| {
                gateway::start_embedded_gateway(8080);
            });
            std::thread::spawn(|| {
                gateway::start_embedded_gateway(4444);
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
            tunnel::get_cloudflare_tunnel_status,
            tunnel::start_cloudflare_tunnel,
            tunnel::stop_cloudflare_tunnel,
            database::get_gateway_databases,
            database::save_gateway_database,
            database::delete_gateway_database,
            database::test_gateway_database_connection,
            database::execute_gateway_database_query
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
