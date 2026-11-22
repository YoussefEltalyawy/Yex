//! Entity-specific behaviour layered on the generic CRUD.
use crate::crud::{self, now_iso};
use crate::error::{invalid, Result};
use crate::schema::Entity;
use chrono::{Datelike, Duration, Local, NaiveDate, Weekday};
use rusqlite::Connection;
use serde_json::{json, Map, Value};

pub fn today() -> NaiveDate {
    Local::now().date_naive()
}

pub fn fmt_date(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

fn parse_date(v: &Value) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(v.as_str()?.get(..10)?, "%Y-%m-%d").ok()
}

pub fn before_write(_conn: &Connection, e: &Entity, data: &mut Map<String, Value>, before: Option<&Map<String, Value>>) -> Result<()> {
    match e.name {
        "task" => {
            if let Some(done) = data.get("done").and_then(Value::as_bool) {
                let was = before.and_then(|b| b.get("done")).and_then(Value::as_bool).unwrap_or(false);
                if done && !was && !data.contains_key("done_at") {
                    data.insert("done_at".into(), json!(now_iso()));
                } else if !done {
                    data.insert("done_at".into(), Value::Null);
                }
            }
        }
        "lesson" => {
            if data.contains_key("notes") && !data.contains_key("notes_updated_at") {
                data.insert("notes_updated_at".into(), json!(now_iso()));
            }
        }
        "exam" => {
            let has_score = data.get("score").is_some_and(|v| !v.is_null());
            let status_given = data.contains_key("status");
            let upcoming = before.map_or(true, |b| b.get("status").and_then(Value::as_str) == Some("upcoming"));
            if has_score && !status_given && upcoming {
                data.insert("status".into(), json!("done"));
            }
        }
        "mistake" => {
            if before.is_none() && !data.contains_key("next_review_at") {
                data.insert("next_review_at".into(), json!(fmt_date(today() + Duration::days(1))));
            }
        }
        _ => {}
    }
    Ok(())
}

pub fn next_occurrence(repeat: &str, from: NaiveDate) -> Option<NaiveDate> {
    match repeat {
        "daily" => Some(from + Duration::days(1)),
        "weekly" => Some(from + Duration::days(7)),
        "weekdays" => {
            let mut d = from + Duration::days(1);
            // Egyptian week: Friday (and optionally Saturday) off; skip Friday only.
            while d.weekday() == Weekday::Fri {
                d += Duration::days(1);
            }
            Some(d)
        }
        _ => None,
    }
}

pub fn after_update(conn: &Connection, e: &Entity, before: &Value, after: &Value) -> Result<()> {
    if e.name == "task" && after["done"] == json!(true) && before["done"] != json!(true) {
        let repeat = after["repeat"].as_str().unwrap_or("none");
        let base = parse_date(&after["due_date"]).unwrap_or_else(today);
        if let Some(mut next) = next_occurrence(repeat, base) {
            while next < today() {
                next = next_occurrence(repeat, next).unwrap();
            }
            let mut data = Map::new();
            for k in ["title", "notes", "priority", "estimate_min", "repeat", "subject_id", "lesson_id", "position"] {
                if !after[k].is_null() {
                    data.insert(k.into(), after[k].clone());
                }
            }
            data.insert("due_date".into(), json!(fmt_date(next)));
            crud::create(conn, "task", data)?;
        }
    }
    Ok(())
}

/// Spaced-repetition review for a mistake. grade: again | hard | good | easy.
pub fn review_mistake(conn: &Connection, id: &str, grade: &str) -> Result<Value> {
    const LADDER: [i64; 6] = [1, 3, 7, 14, 30, 60];
    let m = crud::get(conn, "mistake", id)?;
    let count = m["review_count"].as_i64().unwrap_or(0);
    let stage = |c: i64| LADDER[(c.max(0) as usize).min(LADDER.len() - 1)];
    let (new_count, days) = match grade {
        "again" => (0, 1),
        "hard" => (count, stage(count).min(3)),
        "good" => (count + 1, stage(count)),
        "easy" => (count + 2, stage(count + 1)),
        other => return invalid(format!("grade must be again|hard|good|easy, got '{other}'")),
    };
    let status = if new_count >= 4 && grade != "again" { "mastered" } else { "reviewing" };
    let mut patch = Map::new();
    patch.insert("review_count".into(), json!(new_count));
    patch.insert("last_reviewed_at".into(), json!(now_iso()));
    patch.insert("next_review_at".into(), json!(fmt_date(today() + Duration::days(days))));
    patch.insert("status".into(), json!(status));
    crud::update(conn, "mistake", id, patch)
}
