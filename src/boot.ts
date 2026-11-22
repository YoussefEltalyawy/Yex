// Runs before React to avoid a theme flash.
const pref = localStorage.getItem("yex-theme") || "system";
const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark", dark);
if ("__TAURI_INTERNALS__" in window) document.documentElement.classList.add("mica", "tauri");
