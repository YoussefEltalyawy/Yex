use crate::crud::{self, ListQuery};
use crate::{db, hooks, overview};
use serde_json::{json, Map, Value};

fn obj(v: Value) -> Map<String, Value> {
    v.as_object().unwrap().clone()
}

fn setup() -> rusqlite::Connection {
    db::open_in_memory().unwrap()
}

fn first_subject(c: &rusqlite::Connection) -> String {
    crud::list(c, "subject", &ListQuery::default()).unwrap()[0]["id"].as_str().unwrap().to_string()
}

#[test]
fn seeds_default_subjects_once() {
    let c = setup();
    db::migrate(&c).unwrap();
    let subjects = crud::list(&c, "subject", &ListQuery::default()).unwrap();
    assert_eq!(subjects.len(), 5);
    assert_eq!(subjects[0]["name"], "Math");
    assert_eq!(subjects[0]["archived"], false);
}

#[test]
fn inherits_parent_ids_and_validates() {
    let c = setup();
    let sid = first_subject(&c);
    let ch = crud::create(&c, "chapter", obj(json!({"subject_id": sid, "name": "Calculus"}))).unwrap();
    let lesson = crud::create(&c, "lesson", obj(json!({"chapter_id": ch["id"], "name": "Limits"}))).unwrap();
    assert_eq!(lesson["subject_id"], sid);
    let m = crud::create(&c, "mistake", obj(json!({"lesson_id": lesson["id"], "question": "lim x->0 sin x / x"}))).unwrap();
    assert_eq!(m["chapter_id"], ch["id"]);
    assert_eq!(m["subject_id"], sid);
    assert_eq!(m["status"], "open");
    assert_eq!(m["tags"], json!([]));
    assert!(m["next_review_at"].is_string());

    let err = crud::create(&c, "mistake", obj(json!({"question": "x", "kind": "nope"}))).unwrap_err();
    assert!(err.to_string().contains("must be one of"));
    let err = crud::create(&c, "lesson", obj(json!({"name": "x"}))).unwrap_err();
    assert!(err.to_string().contains("required"));
    let err = crud::create(&c, "lesson", obj(json!({"name": "x", "chapter_id": "missing"}))).unwrap_err();
    assert!(err.to_string().contains("not found") || err.to_string().contains("missing"));
    let err = crud::create(&c, "task", obj(json!({"title": "x", "bogus": 1}))).unwrap_err();
    assert!(err.to_string().contains("unknown field"));
}

#[test]
fn filters_ordering_and_search() {
    let c = setup();
    for (t, p, d) in [("A", "high", "2026-01-02"), ("B", "low", "2026-01-01"), ("C", "high", "2026-01-03")] {
        crud::create(&c, "task", obj(json!({"title": t, "priority": p, "due_date": d}))).unwrap();
    }
    let q = ListQuery {
        filter: obj(json!({"priority": "high", "due_date": {"gte": "2026-01-02"}})),
        order_by: Some("-due_date".into()),
        ..Default::default()
    };
    let r = crud::list(&c, "task", &q).unwrap();
    assert_eq!(r.iter().map(|t| t["title"].as_str().unwrap()).collect::<Vec<_>>(), ["C", "A"]);
    let q = ListQuery { search: Some("b".into()), ..Default::default() };
    assert_eq!(crud::list(&c, "task", &q).unwrap().len(), 1);
    let q = ListQuery { filter: obj(json!({"title": {"in": ["A", "B"]}})), ..Default::default() };
    assert_eq!(crud::list(&c, "task", &q).unwrap().len(), 2);
}

#[test]
fn soft_delete_cascades_and_restores() {
    let c = setup();
    let sid = first_subject(&c);
    let ch = crud::create(&c, "chapter", obj(json!({"subject_id": sid, "name": "Ch"}))).unwrap();
    let l = crud::create(&c, "lesson", obj(json!({"chapter_id": ch["id"], "name": "L"}))).unwrap();
    crud::create(&c, "mistake", obj(json!({"lesson_id": l["id"], "question": "q"}))).unwrap();
    let ch_id = ch["id"].as_str().unwrap();
    crud::delete(&c, "chapter", ch_id).unwrap();
    assert!(crud::list(&c, "lesson", &ListQuery::default()).unwrap().is_empty());
    assert!(crud::list(&c, "mistake", &ListQuery::default()).unwrap().is_empty());
    crud::restore(&c, "chapter", ch_id).unwrap();
    assert_eq!(crud::list(&c, "lesson", &ListQuery::default()).unwrap().len(), 1);
    assert_eq!(crud::list(&c, "mistake", &ListQuery::default()).unwrap().len(), 1);
}

#[test]
fn completing_repeating_task_spawns_next() {
    let c = setup();
    let today = hooks::fmt_date(hooks::today());
    let t = crud::create(&c, "task", obj(json!({"title": "Daily review", "repeat": "daily", "due_date": today}))).unwrap();
    let done = crud::update(&c, "task", t["id"].as_str().unwrap(), obj(json!({"done": true}))).unwrap();
    assert!(done["done_at"].is_string());
    let all = crud::list(&c, "task", &ListQuery::default()).unwrap();
    assert_eq!(all.len(), 2);
    let next = all.iter().find(|x| x["done"] == false).unwrap();
    assert!(next["due_date"].as_str().unwrap() > today.as_str());
    let undone = crud::update(&c, "task", t["id"].as_str().unwrap(), obj(json!({"done": false}))).unwrap();
    assert!(undone["done_at"].is_null());
}

#[test]
fn exam_score_marks_done_and_review_ladder() {
    let c = setup();
    let e = crud::create(&c, "exam", obj(json!({"title": "Trial 1", "kind": "trial", "date": "2026-11-20"}))).unwrap();
    let e = crud::update(&c, "exam", e["id"].as_str().unwrap(), obj(json!({"score": 45, "max_score": 50}))).unwrap();
    assert_eq!(e["status"], "done");
    assert_eq!(e["score"], 45.0);

    let m = crud::create(&c, "mistake", obj(json!({"question": "q"}))).unwrap();
    let id = m["id"].as_str().unwrap();
    let m = hooks::review_mistake(&c, id, "good").unwrap();
    assert_eq!(m["review_count"], 1);
    assert_eq!(m["status"], "reviewing");
    for _ in 0..3 {
        hooks::review_mistake(&c, id, "good").unwrap();
    }
    assert_eq!(crud::get(&c, "mistake", id).unwrap()["status"], "mastered");
    assert!(hooks::review_mistake(&c, id, "meh").is_err());
}

#[test]
fn settings_and_overview() {
    let c = setup();
    crud::set_setting(&c, "theme", &json!("dark")).unwrap();
    assert_eq!(crud::get_setting(&c, "theme").unwrap(), Some(json!("dark")));
    let today = hooks::fmt_date(hooks::today());
    crud::create(&c, "task", obj(json!({"title": "Today", "due_date": today}))).unwrap();
    crud::create(
        &c,
        "focus_session",
        obj(json!({"started_at": crud::now_iso(), "duration_sec": 1500})),
    )
    .unwrap();
    let o = overview::overview(&c).unwrap();
    assert_eq!(o["tasks_today"].as_array().unwrap().len(), 1);
    assert_eq!(o["focus_minutes_today"], 25);
}

#[test]
fn auto_migration_adds_columns() {
    let c = rusqlite::Connection::open_in_memory().unwrap();
    c.execute_batch("CREATE TABLE tasks (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, title TEXT);").unwrap();
    db::migrate(&c).unwrap();
    let t = crud::create(&c, "task", obj(json!({"title": "x"}))).unwrap();
    assert_eq!(t["priority"], "none");
}
