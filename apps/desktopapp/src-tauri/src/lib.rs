use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopShellStatus {
    product_name: &'static str,
    mode: &'static str,
    storage_strategy: &'static str,
    sync_strategy: &'static str,
    rust_boundary: Vec<&'static str>,
    frontend_boundary: Vec<&'static str>,
}

#[tauri::command]
fn load_shell_status() -> DesktopShellStatus {
    // Placeholder command boundary for the future desktop-first stack.
    // Local persistence should move behind Rust-owned services:
    // - SQLite for durable local state
    // - OS keychain / secure enclave for secrets
    // - background tasks and file access through explicit commands
    DesktopShellStatus {
        product_name: "tenra Assembly",
        mode: "desktop-shell",
        storage_strategy: "Local-first is planned; SQLite is the likely first durable store.",
        sync_strategy: "Cloud sync stays deferred until the local model is stable and auditable.",
        rust_boundary: vec![
            "Secure file handling",
            "Local database access",
            "Secret storage",
            "Background tasks",
            "OS integrations",
        ],
        frontend_boundary: vec![
            "Editing flows",
            "Human approvals",
            "Settings forms",
            "Review surfaces",
            "Presentation and navigation",
        ],
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_shell_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
