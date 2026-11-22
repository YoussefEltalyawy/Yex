mod server;
#[cfg(test)]
mod tests;

use serde_json::Value;
use server::{rpc_error, Server};
use std::io::{BufRead, Write};
use std::path::PathBuf;

const USAGE: &str = r"yex-mcp - Model Context Protocol server (stdio) for the YEX student dashboard

USAGE:
    yex-mcp [--db <path>]
    yex-mcp --print-schema

OPTIONS:
    --db <path>       SQLite database to use (default: $YEX_DB or %APPDATA%\app.yex.desktop\yex.db)
    --print-schema    Print the entity registry as JSON and exit
    -h, --help        Show this help
";

fn main() {
    let mut db: Option<PathBuf> = None;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "-h" | "--help" => return print!("{USAGE}"),
            "--print-schema" => {
                return println!("{}", serde_json::to_string_pretty(yex_core::schema::ENTITIES).unwrap());
            }
            "--db" => db = args.next().map(PathBuf::from),
            a if a.starts_with("--db=") => db = Some(PathBuf::from(&a[5..])),
            a => {
                eprintln!("unknown argument '{a}'\n\n{USAGE}");
                std::process::exit(2);
            }
        }
    }
    let path = db.unwrap_or_else(yex_core::db::default_db_path);
    let conn = yex_core::db::open(&path).map_err(|e| format!("cannot open {}: {e}", path.display()));
    match &conn {
        Ok(_) => eprintln!("yex-mcp: using database {}", path.display()),
        Err(e) => eprintln!("yex-mcp: {e}"),
    }
    let server = Server::new(conn);

    let mut input = std::io::stdin().lock();
    let mut out = std::io::stdout().lock();
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match input.read_until(b'\n', &mut buf) {
            Ok(0) => break,
            Ok(_) => {}
            Err(e) => {
                eprintln!("yex-mcp: stdin error: {e}");
                break;
            }
        }
        let line = String::from_utf8_lossy(&buf);
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let reply = match serde_json::from_str::<Value>(line) {
            Ok(Value::Array(batch)) => {
                let r: Vec<Value> = batch.into_iter().filter_map(|m| server.handle(m)).collect();
                (!r.is_empty()).then(|| Value::Array(r))
            }
            Ok(msg) => server.handle(msg),
            Err(e) => Some(rpc_error(Value::Null, -32700, format!("parse error: {e}"))),
        };
        if let Some(r) = reply {
            if writeln!(out, "{r}").and_then(|_| out.flush()).is_err() {
                break;
            }
        }
    }
}
