fn main() {
    let args: Vec<String> = std::env::args().collect();
    tauri_native_lib::run_headless(&args);
}
