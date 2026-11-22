//! A compact snapshot of "what matters now" for dashboards and agents.
use crate::crud::{list, ListQuery};
use crate::hooks::{fmt_date, today};
use crate::Result;
use chrono::Duration;
use rusqlite::Connection;
use serde_json::{json, Map, Value};

fn q(filter: Value, order: &str, limit: Option<i64>) -> ListQuery {
    ListQuery {
        filter: filter.as_object().cloned().unwrap_or_else(Map::new),
        order_by: Some(order.into()),
        limit,
        ..Default::default()
    }
}

pub fn overview(conn: &Connection) -> Result<Value> {
    let t = today();
    let today_s = fmt_date(t);
    let week_start = t - Duration::days(6);
    let tasks_today = list(conn, "task", &q(json!({"due_date": today_s}), "done, position, created_at", None))?;
    let overdue = list(conn, "task", &q(json!({"done": false, "due_date": {"lt": today_s}}), "due_date", None))?;
    let upcoming = list(
        conn,
        "exam",
        &q(json!({"status": "upcoming", "date": {"gte": today_s, "lte": fmt_date(t + Duration::days(21))}}), "date, time", None),
    )?;
    let due_reviews = list(
        conn,
        "mistake",
        &q(json!({"status": {"ne": "mastered"}, "next_review_at": {"lte": today_s}}), "next_review_at", Some(50)),
    )?;
    let start_local = |d: chrono::NaiveDate| {
        d.and_hms_opt(0, 0, 0)
            .and_then(|n| n.and_local_timezone(chrono::Local).earliest())
            .map(|x| x.with_timezone(&chrono::Utc).to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_default()
    };
    let sessions = list(
        conn,
        "focus_session",
        &q(json!({"kind": "focus", "started_at": {"gte": start_local(week_start)}}), "started_at", None),
    )?;
    let today_start = start_local(t);
    let (mut today_sec, mut week_sec) = (0i64, 0i64);
    for s in &sessions {
        let d = s["duration_sec"].as_i64().unwrap_or(0);
        week_sec += d;
        if s["started_at"].as_str().unwrap_or("") >= today_start.as_str() {
            today_sec += d;
        }
    }
    Ok(json!({
        "today": today_s,
        "tasks_today": tasks_today,
        "overdue_tasks": overdue,
        "upcoming_exams": upcoming,
        "mistakes_due_for_review": due_reviews,
        "focus_minutes_today": today_sec / 60,
        "focus_minutes_last_7_days": week_sec / 60,
    }))
}
