// Release build: compiles the MCP server, stages it as a Tauri sidecar
// (installed next to YEX.exe as yex-mcp.exe), then builds the NSIS installer.
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const triple = execSync("rustc -vV").toString().match(/host: (\S+)/)[1];
run("cargo build --release -p yex-mcp");
mkdirSync("src-tauri/binaries", { recursive: true });
copyFileSync("target/release/yex-mcp.exe", `src-tauri/binaries/yex-mcp-${triple}.exe`);
run("npx tauri build --bundles nsis");
