use crate::schema::{Field, ENTITIES};
use crate::Result;
pub use rusqlite::Connection;
use serde_json::Value;
use std::path::{Path, PathBuf};

pub const APP_IDENTIFIER: &str = "app.yex.desktop";

/// `YEX_DB` env var, otherwise `%APPDATA%/app.yex.desktop/yex.db` (same dir Tauri uses).
pub fn default_db_path() -> PathBuf {
    if let Ok(p) = std::env::var("YEX_DB") {
        return PathBuf::from(p);
    }
    let base = std::env::var("APPDATA")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("HOME").map(|h| PathBuf::from(h).join(".config")))
        .unwrap_or_else(|_| PathBuf::from("."));
    base.join(APP_IDENTIFIER).join("yex.db")
}

pub fn open(path: &Path) -> Result<Connection> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let conn = Connection::open(path)?;
    configure(&conn)?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn open_in_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    configure(&conn)?;
    migrate(&conn)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> Result<()> {
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = OFF; PRAGMA temp_store = MEMORY;",
    )?;
    Ok(())
}

/// Changes whenever *another* connection commits. Cheap to poll.
pub fn data_version(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row("PRAGMA data_version", [], |r| r.get(0))?)
}

fn sql_default(f: &Field) -> Option<String> {
    let v: Value = serde_json::from_str(f.default?).ok()?;
    Some(match v {
        Value::Bool(b) => (b as i32).to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => format!("'{}'", s.replace('\'', "''")),
        other => format!("'{}'", other.to_string().replace('\'', "''")),
    })
}

fn column_def(f: &Field) -> String {
    let mut s = format!("\"{}\" {}", f.name, f.kind.sql_type());
    if let Some(d) = sql_default(f) {
        s.push_str(" DEFAULT ");
        s.push_str(&d);
    }
    s
}

/// Creates missing tables / columns / indexes from the entity registry.
pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);",
    )?;
    for e in ENTITIES {
        let mut cols = vec![
            "id TEXT PRIMARY KEY".to_string(),
            "created_at TEXT NOT NULL".into(),
            "updated_at TEXT NOT NULL".into(),
            "deleted_at TEXT".into(),
        ];
        cols.extend(e.fields.iter().map(column_def));
        conn.execute_batch(&format!("CREATE TABLE IF NOT EXISTS {} ({});", e.table, cols.join(", ")))?;

        let existing: Vec<String> = conn
            .prepare(&format!("PRAGMA table_info({})", e.table))?
            .query_map([], |r| r.get::<_, String>(1))?
            .collect::<std::result::Result<_, _>>()?;
        for f in e.fields.iter().filter(|f| !existing.iter().any(|c| c == f.name)) {
            conn.execute_batch(&format!("ALTER TABLE {} ADD COLUMN {};", e.table, column_def(f)))?;
        }
        conn.execute_batch(&format!(
            "CREATE INDEX IF NOT EXISTS idx_{t}_deleted ON {t}(deleted_at);",
            t = e.table
        ))?;
        for f in e.fields.iter().filter(|f| f.refs.is_some()) {
            conn.execute_batch(&format!(
                "CREATE INDEX IF NOT EXISTS idx_{t}_{c} ON {t}({c});",
                t = e.table,
                c = f.name
            ))?;
        }
    }
    crate::seed::seed_defaults(conn)?;
    Ok(())
}
