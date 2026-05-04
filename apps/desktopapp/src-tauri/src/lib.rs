use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Manager, Runtime,
};

const APP_NAME: &str = "tenra Assembly";
const MENU_SETTINGS: &str = "settings";
const MENU_CLOSE_WINDOW: &str = "close-window";
const MENU_QUIT: &str = "quit";

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
    // Desktop command boundary for local services.
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
    let app = tauri::Builder::default()
        .menu(build_app_menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_SETTINGS => {
                let _ = show_main_window(app);
            }
            MENU_CLOSE_WINDOW => {
                let _ = close_main_window(app);
            }
            MENU_QUIT => app.exit(0),
            _ => {}
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![load_shell_status])
        .build(tauri::generate_context!())
        .expect("error while building tenra Assembly desktop");

    app.run(|app_handle, event| match event {
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } => {
            let _ = show_main_window(app_handle);
        }
        _ => {}
    });
}

fn build_app_menu<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = Submenu::with_items(
        app,
        APP_NAME,
        true,
        &[
            &MenuItem::with_id(app, MENU_SETTINGS, "Settings...", true, Some("CmdOrCtrl+,"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                MENU_CLOSE_WINDOW,
                "Close Window",
                true,
                Some("CmdOrCtrl+W"),
            )?,
            &MenuItem::with_id(app, MENU_QUIT, "Quit", true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu])
}

fn show_main_window<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.set_focus()?;
    }

    Ok(())
}

fn close_main_window<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide()?;
    }

    Ok(())
}
