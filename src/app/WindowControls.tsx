import { useEffect, useState } from "react";
import { isTauri } from "@/lib/backend";
import { cn } from "@/lib/utils";

/** Windows-style caption buttons for the frameless window. */
export function WindowControls({ className }: { className?: string }) {
  const [maximized, setMaximized] = useState(false);
  const [win, setWin] = useState<import("@tauri-apps/api/window").Window | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    let un: (() => void) | undefined;
    import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      setWin(w);
      setMaximized(await w.isMaximized());
      un = await w.onResized(async () => setMaximized(await w.isMaximized()));
    });
    return () => un?.();
  }, []);

  if (!isTauri) return null;
  const btn = "no-drag grid h-full w-[46px] place-items-center text-fg-2 transition-colors duration-100";
  return (
    <div className={cn("flex h-9 items-stretch", className)}>
      <button className={cn(btn, "hover:bg-hover hover:text-fg")} onClick={() => win?.minimize()} aria-label="Minimize">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" strokeWidth="1" /></svg>
      </button>
      <button className={cn(btn, "hover:bg-hover hover:text-fg")} onClick={() => win?.toggleMaximize()} aria-label={maximized ? "Restore" : "Maximize"}>
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1"><path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" /><rect x="0.5" y="2.5" width="7" height="7" rx="1" /></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="9" height="9" rx="1.5" /></svg>
        )}
      </button>
      <button className={cn(btn, "rounded-tr-xl hover:bg-[#e81123] hover:text-white")} onClick={() => win?.close()} aria-label="Close">
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" /></svg>
      </button>
    </div>
  );
}
