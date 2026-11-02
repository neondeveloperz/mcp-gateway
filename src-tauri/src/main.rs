// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--headless" || a == "-H" || a == "serve" || a == "daemon") {
        tauri_native_lib::run_headless(&args);
    } else {
        tauri_native_lib::run();
    }
}
