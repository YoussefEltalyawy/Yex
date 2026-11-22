use serde_json::{json, Map, Value};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use yex_core::crud::{self, ListQuery};
use yex_core::{db, hooks, overview, schema, Result};

mod reminders;

pub struct Db(pub Mutex<db::Connection>);

fn with<T>(state: &State<Db>, f: impl FnOnce(&db::Connection) -> Result<T>) -> Result<T> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    f(&conn)
}

#[tauri::command]
fn db_schema() -> Value {
    serde_json::to_value(schema::ENTITIES).unwrap_or(Value::Null)
}

#[tauri::command]
fn db_list(state: State<Db>, entity: String, query: Option<ListQuery>) -> Result<Vec<Value>> {
    with(&state, |c| crud::list(c, &entity, &query.unwrap_or_default()))
}

#[tauri::command]
fn db_get(state: State<Db>, entity: String, id: String) -> Result<Value> {
    with(&state, |c| crud::get(c, &entity, &id))
}

#[tauri::command]
fn db_create(state: State<Db>, entity: String, data: Map<String, Value>) -> Result<Value> {
    with(&state, |c| crud::create(c, &entity, data))
}

#[tauri::command]
fn db_update(state: State<Db>, entity: String, id: String, patch: Map<String, Value>) -> Result<Value> {
    with(&state, |c| crud::update(c, &entity, &id, patch))
}

#[tauri::command]
fn db_delete(state: State<Db>, entity: String, id: String) -> Result<()> {
    with(&state, |c| crud::delete(c, &entity, &id))
}

#[tauri::command]
fn db_restore(state: State<Db>, entity: String, id: String) -> Result<Value> {
    with(&state, |c| crud::restore(c, &entity, &id))
}

#[tauri::command]
fn mistake_review(state: State<Db>, id: String, grade: String) -> Result<Value> {
    with(&state, |c| hooks::review_mistake(c, &id, &grade))
}

#[tauri::command]
fn get_overview(state: State<Db>) -> Result<Value> {
    with(&state, overview::overview)
}

#[tauri::command]
fn settings_all(state: State<Db>) -> Result<Map<String, Value>> {
    with(&state, crud::all_settings)
}

#[tauri::command]
fn setting_set(state: State<Db>, key: String, value: Value) -> Result<()> {
    with(&state, |c| crud::set_setting(c, &key, &value))
}

fn data_dir() -> PathBuf {
    db::default_db_path().parent().map(PathBuf::from).unwrap_or_default()
}

/// Raw-body command: bytes in, relative path (`attachments/<id>.<ext>`) out.
#[tauri::command]
fn save_attachment(request: tauri::ipc::Request) -> std::result::Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    let ext: String = request
        .headers()
        .get("x-ext")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("png")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(8)
        .collect();
    let dir = data_dir().join("attachments");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = format!("{}.{}", crud::new_id(), if ext.is_empty() { "bin" } else { &ext });
    std::fs::write(dir.join(&name), bytes).map_err(|e| e.to_string())?;
    Ok(format!("attachments/{name}"))
}

#[tauri::command]
fn app_info(app: tauri::AppHandle) -> Value {
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(PathBuf::from));
    let mcp = exe_dir.map(|d| d.join(if cfg!(windows) { "yex-mcp.exe" } else { "yex-mcp" }));
    json!({
        "version": app.package_info().version.to_string(),
        "data_dir": data_dir(),
        "db_path": db::default_db_path(),
        "mcp_path": mcp.as_ref().filter(|p| p.exists()),
        "mcp_expected_path": mcp,
    })
}

/// Polls SQLite's data_version on its own connection; fires when another
/// process (e.g. the MCP server) commits, so the UI can refresh.
fn spawn_db_watcher(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let Ok(conn) = db::open(&db::default_db_path()) else { return };
        let mut last = db::data_version(&conn).unwrap_or(0);
        loop {
            std::thread::sleep(Duration::from_millis(700));
            if let Ok(v) = db::data_version(&conn) {
                if v != last {
                    last = v;
                    let _ = app.emit("db-changed", ());
                }
            }
        }
    });
}

/// Ask WebView2 to trim memory while YEX is minimized (keeps RAM low in the background).
#[cfg(windows)]
fn set_low_memory(window: &tauri::WebviewWindow, low: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::*;
    use windows_core::Interface;
    let _ = window.with_webview(move |wv| unsafe {
        let Ok(core) = wv.controller().CoreWebView2() else { return };
        if let Ok(c) = core.cast::<ICoreWebView2_19>() {
            let level = if low { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL };
            let _ = c.SetMemoryUsageTargetLevel(level);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = db::open(&db::default_db_path()).expect("failed to open YEX database");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Db(Mutex::new(conn)))
        .on_window_event(|window, event| {
            #[cfg(windows)]
            if let tauri::WindowEvent::Resized(_) = event {
                if let Some(w) = window.app_handle().get_webview_window(window.label()) {
                    set_low_memory(&w, w.is_minimized().unwrap_or(false));
                }
            }
        })
        .setup(|app| {
            spawn_db_watcher(app.handle().clone());
            reminders::spawn(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_schema,
            db_list,
            db_get,
            db_create,
            db_update,
            db_delete,
            db_restore,
            mistake_review,
            get_overview,
            settings_all,
            setting_set,
            save_attachment,
            app_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running YEX");
}
