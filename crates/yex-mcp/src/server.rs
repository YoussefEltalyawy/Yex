use anyhow::{anyhow, bail, Context, Result};
use serde_json::{json, Map, Value};
use yex_core::crud::{self, ListQuery};
use yex_core::db::Connection;
use yex_core::schema::{entity, ENTITIES};
use yex_core::{hooks, overview};

pub const PROTOCOL_VERSIONS: [&str; 4] = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
const DEFAULT_PROTOCOL: &str = "2025-06-18";

const INSTRUCTIONS: &str = "YEX is a local student life dashboard. Data model: subject > chapter > lesson. \
Each lesson has `notes` (Markdown). Mistakes (wrong-answered questions) attach to a lesson; chapter_id/subject_id are derived \
from the parent when omitted, and mistakes support spaced review via yex_review_mistake. Tasks with due_date = today appear on \
the dashboard; exams are dated quizzes/trials; focus_session rows log timer sessions. Dates are YYYY-MM-DD (local), datetimes \
RFC3339. Deletes are soft (cascade to children) and can be undone with yex_restore. Call yex_schema first to learn the exact \
fields, options and defaults of each entity; yex_overview gives today's date and what matters now. The desktop app shares \
this database and reflects changes live.";

pub struct Server {
    conn: std::result::Result<Connection, String>,
}

fn rpc_result(id: Value, result: Value) -> Value {
    json!({"jsonrpc": "2.0", "id": id, "result": result})
}

pub fn rpc_error(id: Value, code: i64, message: impl Into<String>) -> Value {
    json!({"jsonrpc": "2.0", "id": id, "error": {"code": code, "message": message.into()}})
}

fn tool_result(v: Value) -> Value {
    let text = serde_json::to_string_pretty(&v).unwrap_or_default();
    let mut r = json!({"content": [{"type": "text", "text": text}], "isError": false});
    if v.is_object() {
        r["structuredContent"] = v;
    }
    r
}

fn tool_error(e: anyhow::Error) -> Value {
    json!({"content": [{"type": "text", "text": format!("{e:#}")}], "isError": true})
}

fn str_arg<'a>(a: &'a Value, k: &str) -> Result<&'a str> {
    a.get(k).and_then(Value::as_str).ok_or_else(|| anyhow!("missing string argument '{k}'"))
}

fn obj_arg(a: &Value, k: &str) -> Result<Map<String, Value>> {
    a.get(k).and_then(Value::as_object).cloned().ok_or_else(|| anyhow!("argument '{k}' must be an object"))
}

fn as_obj(v: Value) -> Result<Map<String, Value>> {
    match v {
        Value::Object(m) => Ok(m),
        other => bail!("expected an object, got {other}"),
    }
}

fn entity_names() -> Vec<&'static str> {
    ENTITIES.iter().map(|e| e.name).collect()
}

fn tool(name: &str, description: &str, properties: Value, required: &[&str]) -> Value {
    json!({
        "name": name,
        "description": description,
        "inputSchema": {"type": "object", "properties": properties, "required": required, "additionalProperties": false},
    })
}

pub fn tools() -> Vec<Value> {
    let ent = json!({"type": "string", "enum": entity_names(), "description": "Entity type"});
    let id = json!({"type": "string", "description": "Row id (UUID)"});
    vec![
        tool(
            "yex_schema",
            "Describe all YEX entities and their fields (kind, options, required, default, references, docs). Call this first.",
            json!({"entity": {"type": "string", "enum": entity_names(), "description": "Only describe this entity"}}),
            &[],
        ),
        tool(
            "yex_overview",
            "Snapshot of what matters now: today's date, today's and overdue tasks, upcoming exams (21 days), mistakes due for review, focus minutes today / last 7 days.",
            json!({}),
            &[],
        ),
        tool(
            "yex_list",
            "List rows of an entity with optional filtering, sorting, paging and text search. Soft-deleted rows are excluded unless include_deleted is true.",
            json!({
                "entity": ent,
                "filter": {"type": "object", "additionalProperties": true, "description": "{field: value} for equality, {field: null} for IS NULL, or {field: {\"gte\"|\"gt\"|\"lte\"|\"lt\"|\"ne\"|\"eq\": x, \"in\": [..], \"like\": \"%x%\", \"is_null\": bool}}. Example: {\"chapter_id\": \"...\", \"status\": {\"ne\": \"done\"}}"},
                "order_by": {"type": "string", "description": "Comma separated fields, '-' prefix for descending, e.g. \"due_date,-created_at\". Defaults to the entity's natural order."},
                "limit": {"type": "integer", "minimum": 1, "maximum": 500, "default": 50},
                "offset": {"type": "integer", "minimum": 0, "default": 0},
                "search": {"type": "string", "description": "Case-insensitive substring search over the entity's text fields"},
                "include_deleted": {"type": "boolean", "default": false},
            }),
            &["entity"],
        ),
        tool("yex_get", "Fetch a single row by id.", json!({"entity": ent, "id": id}), &["entity", "id"]),
        tool(
            "yex_create",
            "Create a row. Unknown fields are rejected; omitted fields take their defaults; parent ids are inherited where possible (e.g. lesson.subject_id from chapter_id). Returns the created row.",
            json!({"entity": ent, "data": {"type": "object", "additionalProperties": true, "description": "Field values, see yex_schema"}}),
            &["entity", "data"],
        ),
        tool(
            "yex_update",
            "Patch a row: only the given fields change. Setting task.done = true completes it (repeating tasks spawn the next occurrence). Returns the updated row.",
            json!({"entity": ent, "id": id, "patch": {"type": "object", "additionalProperties": true, "description": "Fields to change"}}),
            &["entity", "id", "patch"],
        ),
        tool(
            "yex_delete",
            "Soft-delete a row (and its cascading children, e.g. a chapter's lessons and their mistakes). Undo with yex_restore.",
            json!({"entity": ent, "id": id}),
            &["entity", "id"],
        ),
        tool(
            "yex_restore",
            "Restore a soft-deleted row together with the children deleted with it. Returns the row.",
            json!({"entity": ent, "id": id}),
            &["entity", "id"],
        ),
        tool(
            "yex_review_mistake",
            "Record a spaced-repetition review of a mistake: again (forgot) | hard | good | easy. Updates review_count, status and next_review_at.",
            json!({"id": id, "grade": {"type": "string", "enum": ["again", "hard", "good", "easy"]}}),
            &["id", "grade"],
        ),
        tool(
            "yex_bulk_create",
            "Create many rows of one entity in order (e.g. all lessons of a chapter, or a batch of mistakes). Stops at the first error, reporting how many were created.",
            json!({"entity": ent, "items": {"type": "array", "minItems": 1, "items": {"type": "object", "additionalProperties": true}}}),
            &["entity", "items"],
        ),
        tool(
            "yex_find",
            "Search text across entities (names, titles, notes, questions...). Returns {entity: [{id, title}]} with up to 10 matches per entity.",
            json!({
                "query": {"type": "string", "minLength": 1},
                "entities": {"type": "array", "items": {"type": "string", "enum": entity_names()}, "description": "Restrict to these entities (default: all)"},
            }),
            &["query"],
        ),
        tool(
            "yex_settings_get",
            "Read an app setting (JSON value) by key. Omit key to get all settings.",
            json!({"key": {"type": "string"}}),
            &[],
        ),
        tool(
            "yex_settings_set",
            "Write an app setting: any JSON value under a key.",
            json!({"key": {"type": "string"}, "value": {"description": "Any JSON value"}}),
            &["key", "value"],
        ),
    ]
}

impl Server {
    pub fn new(conn: std::result::Result<Connection, String>) -> Self {
        Self { conn }
    }

    /// Handle one decoded JSON-RPC message. Returns `None` for notifications and responses.
    pub fn handle(&self, msg: Value) -> Option<Value> {
        let Value::Object(m) = msg else {
            return Some(rpc_error(Value::Null, -32600, "invalid request: expected a JSON object"));
        };
        let id = m.get("id").cloned();
        let Some(method) = m.get("method").and_then(Value::as_str) else {
            return id.filter(|_| !m.contains_key("result") && !m.contains_key("error"))
                .map(|id| rpc_error(id, -32600, "invalid request: missing method"));
        };
        let id = id?;
        let params = m.get("params").cloned().unwrap_or(Value::Null);
        Some(match method {
            "initialize" => {
                let requested = params["protocolVersion"].as_str().unwrap_or_default();
                let version = PROTOCOL_VERSIONS.iter().find(|v| **v == requested).copied().unwrap_or(DEFAULT_PROTOCOL);
                rpc_result(id, json!({
                    "protocolVersion": version,
                    "capabilities": {"tools": {"listChanged": false}},
                    "serverInfo": {"name": "yex", "version": env!("CARGO_PKG_VERSION")},
                    "instructions": INSTRUCTIONS,
                }))
            }
            "ping" => rpc_result(id, json!({})),
            "tools/list" => rpc_result(id, json!({"tools": tools()})),
            "resources/list" => rpc_result(id, json!({"resources": []})),
            "resources/templates/list" => rpc_result(id, json!({"resourceTemplates": []})),
            "prompts/list" => rpc_result(id, json!({"prompts": []})),
            "tools/call" => {
                let Some(name) = params["name"].as_str() else {
                    return Some(rpc_error(id, -32602, "tools/call requires a 'name'"));
                };
                if !tools().iter().any(|t| t["name"] == name) {
                    return Some(rpc_error(id, -32602, format!("unknown tool '{name}'")));
                }
                let args = match &params["arguments"] {
                    Value::Null => json!({}),
                    a => a.clone(),
                };
                rpc_result(id, self.call(name, &args).map_or_else(tool_error, tool_result))
            }
            _ => rpc_error(id, -32601, format!("method not found: {method}")),
        })
    }

    fn call(&self, name: &str, a: &Value) -> Result<Value> {
        if name == "yex_schema" {
            return Ok(match a.get("entity").and_then(Value::as_str) {
                Some(e) => serde_json::to_value(entity(e)?)?,
                None => json!({"entities": ENTITIES}),
            });
        }
        let c = self.conn.as_ref().map_err(|e| anyhow!("database unavailable: {e}"))?;
        Ok(match name {
            "yex_overview" => overview::overview(c)?,
            "yex_list" => {
                let ent = str_arg(a, "entity")?;
                let mut q: ListQuery = serde_json::from_value(json!({
                    "filter": a.get("filter").filter(|f| !f.is_null()).cloned().unwrap_or(json!({})),
                    "order_by": a.get("order_by"),
                    "offset": a.get("offset"),
                    "search": a.get("search"),
                    "include_deleted": a.get("include_deleted").and_then(Value::as_bool).unwrap_or(false),
                }))
                .context("invalid list arguments")?;
                q.limit = Some(a.get("limit").and_then(Value::as_i64).unwrap_or(50).clamp(1, 500));
                let rows = crud::list(c, ent, &q)?;
                json!({"entity": ent, "count": rows.len(), "offset": q.offset.unwrap_or(0), "rows": rows})
            }
            "yex_get" => crud::get(c, str_arg(a, "entity")?, str_arg(a, "id")?)?,
            "yex_create" => crud::create(c, str_arg(a, "entity")?, obj_arg(a, "data")?)?,
            "yex_update" => crud::update(c, str_arg(a, "entity")?, str_arg(a, "id")?, obj_arg(a, "patch")?)?,
            "yex_delete" => {
                let (ent, id) = (str_arg(a, "entity")?, str_arg(a, "id")?);
                crud::delete(c, ent, id)?;
                json!({"deleted": true, "entity": ent, "id": id})
            }
            "yex_restore" => crud::restore(c, str_arg(a, "entity")?, str_arg(a, "id")?)?,
            "yex_review_mistake" => hooks::review_mistake(c, str_arg(a, "id")?, str_arg(a, "grade")?)?,
            "yex_bulk_create" => {
                let ent = str_arg(a, "entity")?;
                let items = a.get("items").and_then(Value::as_array).ok_or_else(|| anyhow!("argument 'items' must be an array"))?;
                let mut created = vec![];
                for (i, item) in items.iter().enumerate() {
                    match as_obj(item.clone()).and_then(|d| Ok(crud::create(c, ent, d)?)) {
                        Ok(row) => created.push(row),
                        Err(e) => bail!(
                            "item {i} failed: {e:#}. {} of {} items were created before the error (ids: {}); fix the item and resend only items[{i}..]",
                            created.len(),
                            items.len(),
                            serde_json::to_string(&created.iter().map(|r| &r["id"]).collect::<Vec<_>>())?
                        ),
                    }
                }
                json!({"entity": ent, "created": created.len(), "rows": created})
            }
            "yex_find" => {
                let query = str_arg(a, "query")?;
                let wanted: Vec<&str> = match a.get("entities").and_then(Value::as_array) {
                    Some(arr) => arr.iter().filter_map(Value::as_str).collect(),
                    None => entity_names(),
                };
                let q = ListQuery { search: Some(query.into()), limit: Some(10), ..Default::default() };
                let mut out = Map::new();
                for name in wanted {
                    let e = entity(name)?;
                    let hits: Vec<Value> = crud::list(c, name, &q)?
                        .iter()
                        .map(|r| {
                            let title = std::iter::once(e.title_field)
                                .chain(e.search.iter().copied())
                                .find_map(|f| r[f].as_str().filter(|s| !s.is_empty()))
                                .map(|s| s.chars().take(100).collect::<String>());
                            json!({"id": r["id"], "title": title})
                        })
                        .collect();
                    if !hits.is_empty() {
                        out.insert(name.into(), hits.into());
                    }
                }
                Value::Object(out)
            }
            "yex_settings_get" => match a.get("key").and_then(Value::as_str) {
                Some(k) => json!({"key": k, "value": crud::get_setting(c, k)?}),
                None => Value::Object(crud::all_settings(c)?),
            },
            "yex_settings_set" => {
                let k = str_arg(a, "key")?;
                let v = a.get("value").ok_or_else(|| anyhow!("missing argument 'value'"))?;
                crud::set_setting(c, k, v)?;
                json!({"key": k, "value": v})
            }
            other => bail!("unknown tool '{other}'"),
        })
    }
}
