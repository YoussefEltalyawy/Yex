use crate::server::Server;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicUsize, Ordering};

struct Ctx {
    server: Server,
    path: std::path::PathBuf,
    next: i64,
}

impl Drop for Ctx {
    fn drop(&mut self) {
        for ext in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!("{}{ext}", self.path.display()));
        }
    }
}

fn setup() -> Ctx {
    static N: AtomicUsize = AtomicUsize::new(0);
    let path = std::env::temp_dir().join(format!(
        "yex-mcp-test-{}-{}-{}.db",
        std::process::id(),
        N.fetch_add(1, Ordering::SeqCst),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    let conn = yex_core::db::open(&path).unwrap();
    Ctx { server: Server::new(Ok(conn)), path, next: 0 }
}

impl Ctx {
    fn rpc(&mut self, method: &str, params: Value) -> Value {
        self.next += 1;
        let r = self
            .server
            .handle(json!({"jsonrpc": "2.0", "id": self.next, "method": method, "params": params}))
            .unwrap();
        assert_eq!(r["id"], self.next);
        r
    }

    fn call_raw(&mut self, name: &str, args: Value) -> Value {
        self.rpc("tools/call", json!({"name": name, "arguments": args}))["result"].clone()
    }

    fn call(&mut self, name: &str, args: Value) -> Value {
        let r = self.call_raw(name, args);
        assert_eq!(r["isError"], false, "{name} failed: {}", r["content"][0]["text"]);
        serde_json::from_str(r["content"][0]["text"].as_str().unwrap()).unwrap()
    }
}

#[test]
fn initialize_and_ping() {
    let mut c = setup();
    let r = c.rpc("initialize", json!({"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "t", "version": "1"}}));
    assert_eq!(r["result"]["protocolVersion"], "2025-03-26");
    assert_eq!(r["result"]["serverInfo"]["name"], "yex");
    assert_eq!(r["result"]["capabilities"]["tools"]["listChanged"], false);
    assert!(r["result"]["instructions"].as_str().unwrap().contains("yex_schema"));
    let r = c.rpc("initialize", json!({"protocolVersion": "1999-01-01"}));
    assert_eq!(r["result"]["protocolVersion"], "2025-06-18");
    assert_eq!(c.rpc("ping", json!(null))["result"], json!({}));
    assert!(c.server.handle(json!({"jsonrpc": "2.0", "method": "notifications/initialized"})).is_none());
}

#[test]
fn lists_all_tools() {
    let mut c = setup();
    let r = c.rpc("tools/list", json!({}));
    let tools = r["result"]["tools"].as_array().unwrap();
    let names: Vec<&str> = tools.iter().map(|t| t["name"].as_str().unwrap()).collect();
    for t in [
        "yex_schema", "yex_overview", "yex_list", "yex_get", "yex_create", "yex_update", "yex_delete",
        "yex_restore", "yex_review_mistake", "yex_bulk_create", "yex_find", "yex_settings_get", "yex_settings_set",
    ] {
        assert!(names.contains(&t), "missing tool {t}");
    }
    let list = tools.iter().find(|t| t["name"] == "yex_list").unwrap();
    assert_eq!(list["inputSchema"]["type"], "object");
    assert!(list["inputSchema"]["properties"]["entity"]["enum"].as_array().unwrap().contains(&json!("lesson")));
    assert!(tools.iter().all(|t| t["description"].as_str().is_some_and(|d| !d.is_empty())));
}

#[test]
fn crud_chain_via_tools() {
    let mut c = setup();
    let schema = c.call("yex_schema", json!({}));
    assert!(schema["entities"].as_array().unwrap().iter().any(|e| e["name"] == "mistake"));

    let s = c.call("yex_create", json!({"entity": "subject", "data": {"name": "Biology", "color": "teal"}}));
    let ch = c.call("yex_create", json!({"entity": "chapter", "data": {"subject_id": s["id"], "name": "Genetics"}}));
    let l = c.call("yex_create", json!({"entity": "lesson", "data": {"chapter_id": ch["id"], "name": "DNA", "notes": "# DNA"}}));
    assert_eq!(l["subject_id"], s["id"]);
    let m = c.call("yex_create", json!({"entity": "mistake", "data": {"lesson_id": l["id"], "question": "What pairs with A?", "correct_answer": "T"}}));
    assert_eq!(m["chapter_id"], ch["id"]);
    assert_eq!(m["subject_id"], s["id"]);

    let bulk = c.call("yex_bulk_create", json!({"entity": "lesson", "items": [
        {"chapter_id": ch["id"], "name": "RNA", "position": 1},
        {"chapter_id": ch["id"], "name": "Mutations", "position": 2},
    ]}));
    assert_eq!(bulk["created"], 2);

    let listed = c.call("yex_list", json!({"entity": "lesson", "filter": {"chapter_id": ch["id"]}, "order_by": "-position"}));
    assert_eq!(listed["count"], 3);
    assert_eq!(listed["rows"][0]["name"], "Mutations");
    let listed = c.call("yex_list", json!({"entity": "lesson", "filter": {"position": {"gte": 1}}, "limit": 1}));
    assert_eq!(listed["count"], 1);

    let u = c.call("yex_update", json!({"entity": "lesson", "id": l["id"], "patch": {"status": "done"}}));
    assert_eq!(u["status"], "done");
    assert_eq!(c.call("yex_get", json!({"entity": "lesson", "id": l["id"]}))["status"], "done");

    let found = c.call("yex_find", json!({"query": "pairs"}));
    assert_eq!(found["mistake"][0]["id"], m["id"]);

    c.call("yex_delete", json!({"entity": "chapter", "id": ch["id"]}));
    assert!(c.call_raw("yex_get", json!({"entity": "mistake", "id": m["id"]}))["isError"] == true);
    assert_eq!(c.call("yex_list", json!({"entity": "lesson", "filter": {"chapter_id": ch["id"]}}))["count"], 0);
    c.call("yex_restore", json!({"entity": "chapter", "id": ch["id"]}));
    assert_eq!(c.call("yex_get", json!({"entity": "mistake", "id": m["id"]}))["id"], m["id"]);
    assert_eq!(c.call("yex_list", json!({"entity": "lesson", "filter": {"chapter_id": ch["id"]}}))["count"], 3);

    let r = c.call("yex_review_mistake", json!({"id": m["id"], "grade": "good"}));
    assert_eq!(r["review_count"], 1);
    assert_eq!(r["status"], "reviewing");

    let o = c.call("yex_overview", json!({}));
    assert!(o["today"].is_string());

    c.call("yex_settings_set", json!({"key": "theme", "value": {"dark": true}}));
    assert_eq!(c.call("yex_settings_get", json!({"key": "theme"}))["value"]["dark"], true);
}

#[test]
fn errors_are_reported() {
    let mut c = setup();
    let r = c.call_raw("yex_create", json!({"entity": "subject", "data": {"name": "X", "bogus": 1}}));
    assert_eq!(r["isError"], true);
    assert!(r["content"][0]["text"].as_str().unwrap().contains("unknown field 'bogus'"));

    let r = c.call_raw("yex_bulk_create", json!({"entity": "subject", "items": [{"name": "A"}, {"color": "sky"}]}));
    assert_eq!(r["isError"], true);
    assert!(r["content"][0]["text"].as_str().unwrap().contains("1 of 2"));

    let r = c.call_raw("yex_review_mistake", json!({"id": "nope", "grade": "good"}));
    assert_eq!(r["isError"], true);

    assert_eq!(c.rpc("foo/bar", json!({}))["error"]["code"], -32601);
    assert_eq!(c.rpc("tools/call", json!({"name": "nope"}))["error"]["code"], -32602);
    assert_eq!(c.server.handle(json!([1])).unwrap()["error"]["code"], -32600);
}
