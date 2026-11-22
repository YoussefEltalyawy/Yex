//! Generic, schema-validated CRUD over the entity registry.
use crate::error::{invalid, Error, Result};
use crate::hooks;
use crate::schema::{entity, Entity, Field, Kind, ENTITIES};
use rusqlite::types::{Value as Sql, ValueRef};
use rusqlite::{params_from_iter, Connection, OptionalExtension};
use serde::Deserialize;
use serde_json::{Map, Number, Value};

pub const META: [&str; 4] = ["id", "created_at", "updated_at", "deleted_at"];

/// Savepoint-based transaction guard: nests safely, rolls back on drop unless committed.
pub struct Tx<'a> {
    conn: &'a Connection,
    done: bool,
}

impl<'a> Tx<'a> {
    pub fn begin(conn: &'a Connection) -> Result<Self> {
        conn.execute_batch("SAVEPOINT yex_tx")?;
        Ok(Self { conn, done: false })
    }
    pub fn commit(mut self) -> Result<()> {
        self.done = true;
        self.conn.execute_batch("RELEASE yex_tx")?;
        Ok(())
    }
}

impl std::ops::Deref for Tx<'_> {
    type Target = Connection;
    fn deref(&self) -> &Connection {
        self.conn
    }
}

impl Drop for Tx<'_> {
    fn drop(&mut self) {
        if !self.done {
            let _ = self.conn.execute_batch("ROLLBACK TO yex_tx; RELEASE yex_tx");
        }
    }
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn new_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

#[derive(Deserialize, Default, Debug, Clone)]
#[serde(default)]
pub struct ListQuery {
    /// `{field: value}` for equality, `{field: null}` for IS NULL, or
    /// `{field: {"gte": x, "lt": y, "in": [...], "ne": x, "like": "%x%", "is_null": bool}}`.
    pub filter: Map<String, Value>,
    /// Comma separated fields, prefix with `-` for descending. Defaults to the entity's order.
    pub order_by: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub include_deleted: bool,
    /// Case-insensitive substring search over the entity's searchable fields.
    pub search: Option<String>,
}

fn kind_of(e: &Entity, name: &str) -> Result<Kind> {
    match name {
        "id" => Ok(Kind::Text),
        "created_at" | "updated_at" | "deleted_at" => Ok(Kind::DateTime),
        _ => e.field(name).map(|f| f.kind).ok_or_else(|| {
            Error::Invalid(format!(
                "unknown field '{name}' on {}. Fields: {}",
                e.name,
                e.fields.iter().map(|f| f.name).collect::<Vec<_>>().join(", ")
            ))
        }),
    }
}

/// Convert a JSON value into an SQL value for a column of `kind`.
fn convert(name: &str, kind: Kind, v: &Value) -> Result<Sql> {
    let bad = || Error::Invalid(format!("field '{name}' expects {kind:?}, got {v}"));
    Ok(match (kind, v) {
        (_, Value::Null) => Sql::Null,
        (Kind::Text | Kind::LongText | Kind::Ref, Value::String(s)) => Sql::Text(s.clone()),
        (Kind::Text | Kind::LongText, Value::Number(n)) => Sql::Text(n.to_string()),
        (Kind::Date, Value::String(s)) => {
            let d = chrono::NaiveDate::parse_from_str(s.get(..10).unwrap_or(s), "%Y-%m-%d")
                .map_err(|_| Error::Invalid(format!("field '{name}' expects a date YYYY-MM-DD, got '{s}'")))?;
            Sql::Text(d.format("%Y-%m-%d").to_string())
        }
        (Kind::DateTime, Value::String(s)) => {
            let dt = chrono::DateTime::parse_from_rfc3339(s)
                .map_err(|_| Error::Invalid(format!("field '{name}' expects an RFC3339 datetime, got '{s}'")))?;
            Sql::Text(
                dt.with_timezone(&chrono::Utc)
                    .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            )
        }
        (Kind::Int, Value::Number(n)) => Sql::Integer(
            n.as_i64()
                .or_else(|| n.as_f64().filter(|f| f.fract() == 0.0).map(|f| f as i64))
                .ok_or_else(bad)?,
        ),
        (Kind::Int, Value::String(s)) => Sql::Integer(s.trim().parse().map_err(|_| bad())?),
        (Kind::Real, Value::Number(n)) => Sql::Real(n.as_f64().ok_or_else(bad)?),
        (Kind::Real, Value::String(s)) => Sql::Real(s.trim().parse().map_err(|_| bad())?),
        (Kind::Bool, Value::Bool(b)) => Sql::Integer(*b as i64),
        (Kind::Bool, Value::Number(n)) if n.as_i64() == Some(0) || n.as_i64() == Some(1) => {
            Sql::Integer(n.as_i64().unwrap())
        }
        (Kind::Json, v) => Sql::Text(v.to_string()),
        _ => return Err(bad()),
    })
}

fn to_sql(f: &Field, v: &Value) -> Result<Sql> {
    if v.is_null() && f.required {
        return invalid(format!("field '{}' is required", f.name));
    }
    if let (false, Value::String(s)) = (f.options.is_empty(), v) {
        if !f.options.contains(&s.as_str()) {
            return invalid(format!(
                "field '{}' must be one of: {} (got '{s}')",
                f.name,
                f.options.join(", ")
            ));
        }
    }
    convert(f.name, f.kind, v)
}

fn from_sql(kind: Kind, v: ValueRef) -> Value {
    match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) if kind == Kind::Bool => Value::Bool(i != 0),
        ValueRef::Integer(i) => Value::Number(i.into()),
        ValueRef::Real(r) => Number::from_f64(r).map(Value::Number).unwrap_or(Value::Null),
        ValueRef::Text(t) => {
            let s = String::from_utf8_lossy(t).into_owned();
            if kind == Kind::Json {
                serde_json::from_str(&s).unwrap_or(Value::String(s))
            } else {
                Value::String(s)
            }
        }
        ValueRef::Blob(_) => Value::Null,
    }
}

fn columns(e: &Entity) -> String {
    META.iter()
        .copied()
        .chain(e.fields.iter().map(|f| f.name))
        .map(|c| format!("\"{c}\""))
        .collect::<Vec<_>>()
        .join(", ")
}

fn row_to_json(e: &Entity, row: &rusqlite::Row) -> rusqlite::Result<Value> {
    let mut m = Map::new();
    for (i, name) in META.iter().enumerate() {
        m.insert((*name).into(), from_sql(Kind::Text, row.get_ref(i)?));
    }
    for (i, f) in e.fields.iter().enumerate() {
        m.insert(f.name.into(), from_sql(f.kind, row.get_ref(i + META.len())?));
    }
    Ok(Value::Object(m))
}

fn order_clause(e: &Entity, order: &str) -> Result<String> {
    order
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|part| {
            let (name, dir) = match part.strip_prefix('-') {
                Some(n) => (n, "DESC"),
                None => (part, "ASC"),
            };
            kind_of(e, name)?;
            Ok(format!("\"{name}\" {dir}"))
        })
        .collect::<Result<Vec<_>>>()
        .map(|v| v.join(", "))
}

pub fn list(conn: &Connection, entity_name: &str, q: &ListQuery) -> Result<Vec<Value>> {
    let e = entity(entity_name)?;
    let mut sql = format!("SELECT {} FROM {} WHERE 1=1", columns(e), e.table);
    let mut params: Vec<Sql> = vec![];
    if !q.include_deleted {
        sql.push_str(" AND deleted_at IS NULL");
    }
    for (name, v) in &q.filter {
        let kind = kind_of(e, name)?;
        let col = format!("\"{name}\"");
        match v {
            Value::Null => sql.push_str(&format!(" AND {col} IS NULL")),
            Value::Object(ops) => {
                for (op, val) in ops {
                    let sym = match op.as_str() {
                        "eq" => "=",
                        "ne" => "IS NOT",
                        "lt" => "<",
                        "lte" => "<=",
                        "gt" => ">",
                        "gte" => ">=",
                        "like" => "LIKE",
                        "is_null" => {
                            let yes = val.as_bool().unwrap_or(true);
                            sql.push_str(&format!(" AND {col} IS {}NULL", if yes { "" } else { "NOT " }));
                            continue;
                        }
                        "in" => {
                            let arr = val.as_array().ok_or_else(|| Error::Invalid("'in' expects an array".into()))?;
                            if arr.is_empty() {
                                sql.push_str(" AND 0");
                                continue;
                            }
                            sql.push_str(&format!(" AND {col} IN ({})", vec!["?"; arr.len()].join(",")));
                            for a in arr {
                                params.push(convert(name, kind, a)?);
                            }
                            continue;
                        }
                        other => return invalid(format!("unknown filter operator '{other}'")),
                    };
                    let k = if op == "like" { Kind::Text } else { kind };
                    sql.push_str(&format!(" AND {col} {sym} ?"));
                    params.push(convert(name, k, val)?);
                }
            }
            v => {
                sql.push_str(&format!(" AND {col} = ?"));
                params.push(convert(name, kind, v)?);
            }
        }
    }
    if let Some(s) = q.search.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let likes: Vec<String> = e.search.iter().map(|c| format!("\"{c}\" LIKE ?")).collect();
        sql.push_str(&format!(" AND ({})", likes.join(" OR ")));
        for _ in e.search {
            params.push(Sql::Text(format!("%{s}%")));
        }
    }
    sql.push_str(&format!(
        " ORDER BY {}",
        order_clause(e, q.order_by.as_deref().unwrap_or(e.default_order))?
    ));
    sql.push_str(&format!(" LIMIT {} OFFSET {}", q.limit.unwrap_or(-1), q.offset.unwrap_or(0).max(0)));
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(params), |r| row_to_json(e, r))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn get_raw(conn: &Connection, e: &Entity, id: &str, include_deleted: bool) -> Result<Option<Value>> {
    let sql = format!(
        "SELECT {} FROM {} WHERE id = ?{}",
        columns(e),
        e.table,
        if include_deleted { "" } else { " AND deleted_at IS NULL" }
    );
    Ok(conn.query_row(&sql, [id], |r| row_to_json(e, r)).optional()?)
}

pub fn get(conn: &Connection, entity_name: &str, id: &str) -> Result<Value> {
    let e = entity(entity_name)?;
    get_raw(conn, e, id, false)?.ok_or_else(|| Error::NotFound(e.name.into(), id.into()))
}

/// Look up a single column of a live row.
pub(crate) fn lookup(conn: &Connection, entity_name: &str, id: &str, col: &str) -> Result<Value> {
    let e = entity(entity_name)?;
    let kind = kind_of(e, col)?;
    let v = conn
        .query_row(
            &format!("SELECT \"{col}\" FROM {} WHERE id = ? AND deleted_at IS NULL", e.table),
            [id],
            |r| Ok(from_sql(kind, r.get_ref(0)?)),
        )
        .optional()?;
    v.ok_or_else(|| Error::NotFound(e.name.into(), id.into()))
}

fn validate_keys(e: &Entity, data: &Map<String, Value>) -> Result<()> {
    for k in data.keys() {
        if !META.contains(&k.as_str()) {
            kind_of(e, k)?;
        }
    }
    Ok(())
}

/// Fill inherited fields (e.g. lesson.subject_id from its chapter).
fn apply_inherit(conn: &Connection, e: &Entity, data: &mut Map<String, Value>, explicit: &[String]) -> Result<()> {
    for inh in e.inherit {
        let via_changed = data.contains_key(inh.via);
        let target_explicit = explicit.iter().any(|k| k == inh.target);
        let target_empty = data.get(inh.target).map_or(true, Value::is_null);
        if !via_changed || target_explicit && !target_empty {
            continue;
        }
        let Some(via_id) = data.get(inh.via).and_then(Value::as_str).map(str::to_owned) else {
            continue;
        };
        let via_entity = e.field(inh.via).and_then(|f| f.refs).unwrap_or_default();
        let v = lookup(conn, via_entity, &via_id, inh.source)?;
        if !v.is_null() || !target_explicit {
            data.insert(inh.target.into(), v);
        }
    }
    Ok(())
}

fn check_refs(conn: &Connection, e: &Entity, data: &Map<String, Value>) -> Result<()> {
    for f in e.fields.iter().filter(|f| f.refs.is_some()) {
        if let Some(Value::String(id)) = data.get(f.name) {
            lookup(conn, f.refs.unwrap(), id, "id").map_err(|_| {
                Error::Invalid(format!("field '{}' references missing {} '{id}'", f.name, f.refs.unwrap()))
            })?;
        }
    }
    Ok(())
}

pub fn create(conn: &Connection, entity_name: &str, mut data: Map<String, Value>) -> Result<Value> {
    let e = entity(entity_name)?;
    validate_keys(e, &data)?;
    let id = match data.remove("id") {
        Some(Value::String(s)) if !s.is_empty() => s,
        _ => new_id(),
    };
    for m in &META[1..] {
        data.remove(*m);
    }
    let explicit: Vec<String> = data.keys().cloned().collect();
    let tx = Tx::begin(conn)?;
    apply_inherit(&tx, e, &mut data, &explicit)?;
    hooks::before_write(&tx, e, &mut data, None)?;
    for f in e.fields.iter().filter(|f| f.required && f.default.is_none()) {
        if data.get(f.name).map_or(true, Value::is_null) {
            return invalid(format!("field '{}' is required to create a {}", f.name, e.name));
        }
    }
    check_refs(&tx, e, &data)?;
    let now = now_iso();
    let mut cols = vec!["id".to_string(), "created_at".into(), "updated_at".into()];
    let mut vals = vec![Sql::Text(id.clone()), Sql::Text(now.clone()), Sql::Text(now)];
    for (k, v) in &data {
        let f = e.field(k).unwrap();
        if v.is_null() && f.default.is_some() {
            continue;
        }
        cols.push(format!("\"{k}\""));
        vals.push(to_sql(f, v)?);
    }
    tx.execute(
        &format!(
            "INSERT INTO {} ({}) VALUES ({})",
            e.table,
            cols.join(", "),
            vec!["?"; cols.len()].join(", ")
        ),
        params_from_iter(vals),
    )?;
    let out = get(&tx, e.name, &id)?;
    tx.commit()?;
    Ok(out)
}

pub fn update(conn: &Connection, entity_name: &str, id: &str, mut patch: Map<String, Value>) -> Result<Value> {
    let e = entity(entity_name)?;
    validate_keys(e, &patch)?;
    for m in META {
        patch.remove(m);
    }
    let tx = Tx::begin(conn)?;
    let before = get(&tx, e.name, id)?;
    let explicit: Vec<String> = patch.keys().cloned().collect();
    apply_inherit(&tx, e, &mut patch, &explicit)?;
    hooks::before_write(&tx, e, &mut patch, before.as_object())?;
    check_refs(&tx, e, &patch)?;
    let mut sets = vec!["updated_at = ?".to_string()];
    let mut vals = vec![Sql::Text(now_iso())];
    for (k, v) in &patch {
        sets.push(format!("\"{k}\" = ?"));
        vals.push(to_sql(e.field(k).unwrap(), v)?);
    }
    vals.push(Sql::Text(id.into()));
    tx.execute(
        &format!("UPDATE {} SET {} WHERE id = ?", e.table, sets.join(", ")),
        params_from_iter(vals),
    )?;
    let after = get(&tx, e.name, id)?;
    hooks::after_update(&tx, e, &before, &after)?;
    tx.commit()?;
    Ok(after)
}

fn set_deleted(conn: &Connection, e: &Entity, id: &str, ts: Option<&str>, match_ts: Option<&str>) -> Result<usize> {
    let (cond, extra): (&str, Vec<Sql>) = match match_ts {
        Some(t) => ("deleted_at = ?", vec![Sql::Text(t.into())]),
        None => ("deleted_at IS NULL", vec![]),
    };
    let mut params = vec![
        ts.map_or(Sql::Null, |t| Sql::Text(t.into())),
        Sql::Text(now_iso()),
        Sql::Text(id.into()),
    ];
    params.extend(extra);
    let n = conn.execute(
        &format!("UPDATE {} SET deleted_at = ?, updated_at = ? WHERE id = ? AND {cond}", e.table),
        params_from_iter(params),
    )?;
    if n > 0 {
        for child in ENTITIES {
            for f in child.fields.iter().filter(|f| f.cascade && f.refs == Some(e.name)) {
                let ids: Vec<String> = conn
                    .prepare(&format!(
                        "SELECT id FROM {} WHERE \"{}\" = ? AND {cond}",
                        child.table, f.name
                    ))?
                    .query_map(params_from_iter([Sql::Text(id.into())].into_iter().chain(
                        match_ts.map(|t| Sql::Text(t.into())),
                    )), |r| r.get(0))?
                    .collect::<rusqlite::Result<_>>()?;
                for cid in ids {
                    set_deleted(conn, child, &cid, ts, match_ts)?;
                }
            }
        }
    }
    Ok(n)
}

/// Soft delete (cascades to children declared with `cascade`). Restorable.
pub fn delete(conn: &Connection, entity_name: &str, id: &str) -> Result<()> {
    let e = entity(entity_name)?;
    let tx = Tx::begin(conn)?;
    if set_deleted(&tx, e, id, Some(&now_iso()), None)? == 0 {
        return Err(Error::NotFound(e.name.into(), id.into()));
    }
    tx.commit()?;
    Ok(())
}

/// Undo a soft delete, including children deleted in the same operation.
pub fn restore(conn: &Connection, entity_name: &str, id: &str) -> Result<Value> {
    let e = entity(entity_name)?;
    let row = get_raw(conn, e, id, true)?.ok_or_else(|| Error::NotFound(e.name.into(), id.into()))?;
    if let Some(ts) = row["deleted_at"].as_str() {
        let tx = Tx::begin(conn)?;
        set_deleted(&tx, e, id, None, Some(ts))?;
        tx.commit()?;
    }
    get(conn, e.name, id)
}

/// Permanently remove rows soft-deleted before `before` (RFC3339).
pub fn purge(conn: &Connection, before: &str) -> Result<usize> {
    let mut n = 0;
    for e in ENTITIES {
        n += conn.execute(&format!("DELETE FROM {} WHERE deleted_at IS NOT NULL AND deleted_at < ?", e.table), [before])?;
    }
    Ok(n)
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<Value>> {
    let v: Option<String> = conn
        .query_row("SELECT value FROM kv WHERE key = ?", [key], |r| r.get(0))
        .optional()?;
    Ok(v.and_then(|s| serde_json::from_str(&s).ok()))
}

pub fn set_setting(conn: &Connection, key: &str, value: &Value) -> Result<()> {
    conn.execute(
        "INSERT INTO kv (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        rusqlite::params![key, value.to_string(), now_iso()],
    )?;
    Ok(())
}

pub fn all_settings(conn: &Connection) -> Result<Map<String, Value>> {
    let mut stmt = conn.prepare("SELECT key, value FROM kv")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let mut m = Map::new();
    for row in rows {
        let (k, v) = row?;
        m.insert(k, serde_json::from_str(&v).unwrap_or(Value::Null));
    }
    Ok(m)
}
