# YEX — agent & developer notes

Local-first Windows desktop "life dashboard" for a Thanaweya Amma student: study (subjects > chapters > lessons with notes + mistakes log + spaced review), tasks, quizzes/trials, focus timer, analytics, and AI-agent access over MCP. Future modules: gym, PDF library, iPhone companion.

## Stack
- **Tauri v2** (Rust + system WebView2, no Electron). Frameless window with Mica, custom caption buttons (`src/app/WindowControls.tsx`).
- **Frontend**: React 19 + TypeScript + Vite 8 + Tailwind v4, TanStack Query, zustand, TipTap 3 (markdown storage), Hugeicons. Charts are hand-written SVG (no chart libs).
- **Storage**: SQLite (rusqlite, bundled, WAL) at `%APPDATA%\app.yex.desktop\yex.db` (override with `YEX_DB`). Attachments in `attachments/` next to the DB.

## Layout
```
crates/yex-core     Rust domain core shared by app + MCP: schema registry, auto-migration, generic CRUD, hooks, overview
crates/yex-mcp      MCP stdio server (yex-mcp.exe) — bundled next to YEX.exe as a sidecar
src-tauri           Tauri app: commands (lib.rs), exam reminders (reminders.rs), DB change watcher
src/lib             backend interface (backend.ts), Tauri impl, in-browser mock impl + demo seed, query hooks, store/router, dates
src/ui              primitives: core.tsx (Button, Input, Card…), overlay.tsx (Popover, Menu, Select, Dialog, DatePicker, Check), RichEditor, Markdown
src/app             Shell, Sidebar, PageHeader, CommandPalette
src/modules/*       feature modules (home, focus, tasks, exams, study, analytics, settings) + registry.ts
scripts/shots.mjs   visual test harness (headless Edge screenshots of every route, both themes)
```

## Environment (this machine)
Rust/Node are portable installs on G: — run `source /g/dev/env.sh` first in bash (sets RUSTUP_HOME, CARGO_HOME, PATH with Node 22). MSVC Build Tools live in `G:\BuildTools`. No python.

## Commands
- `npm run dev` — Vite on :1420. In a normal browser the app uses the **mock backend** (localStorage, seeded demo data; add `?reset` to reseed).
- `npm run app:dev` (or `cargo run -p yex` with Vite running) — real desktop app.
- `npm run typecheck` — `tsc --noEmit` (must be clean).
- `cargo test -p yex-core -p yex-mcp` — Rust tests.
- `node scripts/shots.mjs [filter] [--light-only|--dark-only] [--w=1440 --h=900]` — screenshots to `.shots/`, fails on console errors. Needs the dev server running.
- `npm run app:build` — release: builds yex-mcp, stages it in `src-tauri/binaries/`, builds the NSIS installer into `target/release/bundle/nsis/`.
- Debugging the real webview: build with `TAURI_CONFIG` merging `"additionalBrowserArgs": "--remote-debugging-port=9333"` into the main window, then `chromium.connectOverCDP("http://127.0.0.1:9333")` (see `.shots/tauri-test.mjs` pattern). Use `YEX_DB` to point at a test database — never test against the real DB.

## Data model rules
- Entities are declared once in `crates/yex-core/src/schema.rs`. Tables/columns/indexes are created automatically on startup (add a field → it appears; no migration files). Regenerate the frontend copy with `target/debug/yex-mcp.exe --print-schema > src/lib/schema.json` (used by the mock backend).
- Every row: `id` (UUIDv7), `created_at`, `updated_at`, `deleted_at` (soft delete; `restore` undoes, including cascaded children). Designed for future sync with the iPhone app.
- `inherit` fills parent ids (lesson.subject_id from chapter, mistake.chapter_id/subject_id from lesson…). `cascade` refs soft-delete children.
- Entity-specific behavior lives in `crates/yex-core/src/hooks.rs` (task done_at + repeating tasks, exam score → done, mistake review ladder). Mirror changes in `src/lib/backend-mock.ts`.
- Dates are local `YYYY-MM-DD`; datetimes are RFC3339 UTC. Weeks start on Saturday (Egypt).

## Adding a module (e.g. gym, library)
1. Add entities in `schema.rs` (module: "gym"), add hooks if needed, run core tests.
2. Add TS types in `src/lib/types.ts` (+ `EntityMap`), regenerate `schema.json`.
3. Create `src/modules/gym/` pages and add a `ModuleDef` in `src/modules/registry.ts` (pages, nav item, palette commands). The MCP server exposes new entities automatically.

## UI conventions
- Tokens in `src/styles/index.css`: `text-fg/-2/-3/-4`, `bg-canvas/surface/surface-2/hover/selected`, `shadow-card/pop/panel`, `accent`, pastel tints via `tint-<color>` + `tint-bg|tint-text|tint-solid`. Serif display font via `font-display`.
- Pages: `<PageHeader crumbs actions/>` (draggable title bar region) then a scrollable body; titles in `font-display`.
- All text inputs use `dir="auto"`; markdown blocks get per-block direction so Arabic renders RTL.
- Never trust markdown HTML (agents can write notes): `src/ui/Markdown.tsx` escapes raw HTML and sanitizes links.
