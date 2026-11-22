import { Suspense, useEffect } from "react";
import { backend, isTauri } from "@/lib/backend";
import { invalidateAll } from "@/lib/query";
import { navigate, useApp } from "@/lib/store";
import { TimerEngine } from "@/modules/focus/hooks";
import { timer } from "@/modules/focus/timer";
import { navItems, pages } from "@/modules/registry";
import { MistakeEditor } from "@/modules/study/mistakes";
import { cn } from "@/lib/utils";
import { Empty } from "@/ui/core";
import { Toaster } from "@/ui/Toaster";
import { CommandPalette } from "./CommandPalette";
import { PageHeader } from "./PageHeader";
import { Sidebar } from "./Sidebar";
import { WindowControls } from "./WindowControls";

function useThemeSync() {
  const dark = useApp((s) => s.dark);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    if (isTauri) import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().setTheme(dark ? "dark" : "light").catch(() => {}));
  }, [dark]);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const app = useApp.getState();
      const mod = e.ctrlKey || e.metaKey;
      const typing = (e.target as HTMLElement)?.closest("input, textarea, [contenteditable='true']");
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        app.setPalette(!app.paletteOpen);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        app.toggleSidebar();
      } else if (mod && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        timer.toggle();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        useApp.setState({ mistakeDialog: { lessonId: app.route.name === "lesson" ? app.route.params.id : undefined } });
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        navigate("tasks", { new: String(Date.now()) });
      } else if (mod && /^[1-9]$/.test(e.key) && navItems[Number(e.key) - 1]) {
        e.preventDefault();
        navigate(navItems[Number(e.key) - 1].route);
      } else if (e.altKey && e.key === "ArrowLeft" && !typing) app.goBack();
      else if (e.altKey && e.key === "ArrowRight" && !typing) app.goForward();
    };
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) useApp.getState().goBack();
      if (e.button === 4) useApp.getState().goForward();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", onMouse);
    };
  }, []);
}

function PageHost() {
  const route = useApp((s) => s.route);
  const Page = pages[route.name];
  if (!Page)
    return (
      <>
        <PageHeader crumbs={[{ label: "Not found" }]} />
        <Empty title="Nothing here" hint={`There's no page called “${route.name}”.`} />
      </>
    );
  return (
    <Suspense fallback={<PageHeader crumbs={[{ label: "" }]} />}>
      <Page key={`${route.name}:${route.params.id ?? ""}`} params={route.params} />
    </Suspense>
  );
}

export function Shell() {
  const chromeDark = useApp((s) => s.chromeDark);
  const mistakeDialog = useApp((s) => s.mistakeDialog);
  useThemeSync();
  useShortcuts();
  useEffect(() => backend().onExternalChange(invalidateAll), []);
  // Block the browser context menu except in editable fields (native-app feel).
  useEffect(() => {
    const h = (e: MouseEvent) => !(e.target as HTMLElement).closest("input, textarea, [contenteditable='true'], .selectable") && e.preventDefault();
    window.addEventListener("contextmenu", h);
    return () => window.removeEventListener("contextmenu", h);
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="min-w-0 flex-1 py-2 pr-2">
        <div className="relative flex h-full flex-col overflow-hidden rounded-xl bg-canvas shadow-panel">
          <PageHost />
          <WindowControls className={cn("absolute right-0 top-0 z-20", chromeDark && "dark")} />
        </div>
      </main>
      <CommandPalette />
      <MistakeEditor open={!!mistakeDialog} onClose={() => useApp.setState({ mistakeDialog: null })} lessonId={mistakeDialog?.lessonId} />
      <Toaster />
      <TimerEngine />
    </div>
  );
}
