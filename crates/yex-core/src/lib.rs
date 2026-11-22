//! YEX core: storage, schema registry and domain logic shared by the
//! desktop app and the MCP server.
pub mod crud;
pub mod db;
pub mod error;
pub mod hooks;
pub mod overview;
pub mod schema;
pub mod seed;

pub use error::{Error, Result};

#[cfg(test)]
mod tests;
