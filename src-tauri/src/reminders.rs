//! Background exam reminders (day before from 18:00, day of from 07:00).
use chrono::{Duration, Local, Timelike};
use serde_json::{json, Value};
use tauri_plugin_notification::NotificationExt;
use yex_core::crud::{self, ListQuery};
use yex_core::{db, hooks};

pub fn spawn(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(5));
        let Ok(conn) = db::open(&db::default_db_path()) else { return };
        loop {
            let _ = tick(&app, &conn);
            std::thread::sleep(std::time::Duration::from_secs(60));
        }
    });
}

fn tick(app: &tauri::AppHandle, conn: &db::Connection) -> yex_core::Result<()> {
    let now = Local::now();
    let today = hooks::fmt_date(now.date_naive());
    let tomorrow = hooks::fmt_date(now.date_naive() + Duration::days(1));
    let q = ListQuery {
        filter: json!({"status": "upcoming", "remind": true, "date": {"in": [today, tomorrow]}})
            .as_object()
            .cloned()
            .unwrap_or_default(),
        ..Default::default()
    };
    for exam in crud::list(conn, "exam", &q)? {
        let date = exam["date"].as_str().unwrap_or_default();
        let (slot, ready, when) = if date == today {
            ("day-of", now.hour() >= 7, "Today")
        } else {
            ("day-before", now.hour() >= 18, "Tomorrow")
        };
        let key = format!("notified:{}:{}:{}", exam["id"].as_str().unwrap_or_default(), date, slot);
        if !ready || crud::get_setting(conn, &key)?.is_some() {
            continue;
        }
        let kind = exam["kind"].as_str().unwrap_or("exam");
        let at = exam["time"].as_str().map(|t| format!(" at {t}")).unwrap_or_default();
        let _ = app
            .notification()
            .builder()
            .title(format!("{when}: {}", exam["title"].as_str().unwrap_or("Exam")))
            .body(format!("{}{at}. {}", capitalize(kind), scope(&exam)))
            .show();
        crud::set_setting(conn, &key, &json!(true))?;
    }
    Ok(())
}

fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
}

fn scope(exam: &Value) -> String {
    exam["scope"].as_str().map(|s| format!("Covers: {s}")).unwrap_or_else(|| "Good luck!".into())
}
