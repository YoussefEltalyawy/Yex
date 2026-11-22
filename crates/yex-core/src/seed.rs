use crate::crud;
use crate::Result;
use rusqlite::Connection;
use serde_json::{json, Value};

/// Default subjects for an Egyptian Thanaweya Amma student. Runs once.
pub fn seed_defaults(conn: &Connection) -> Result<()> {
    if crud::get_setting(conn, "seeded")?.is_some() {
        return Ok(());
    }
    let subjects = [
        ("Math", "📐", "sky"),
        ("Physics", "⚛️", "lilac"),
        ("Chemistry", "🧪", "mint"),
        ("Arabic", "📜", "butter"),
        ("English", "🔤", "peach"),
    ];
    for (i, (name, icon, color)) in subjects.iter().enumerate() {
        let v = json!({ "name": name, "icon": icon, "color": color, "position": i });
        if let Value::Object(m) = v {
            crud::create(conn, "subject", m)?;
        }
    }
    crud::set_setting(conn, "seeded", &json!(true))?;
    Ok(())
}
