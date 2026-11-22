import { AiMagicIcon, Copy01Icon, Folder01Icon, KeyboardIcon, PaintBoardIcon, Tick02Icon, UserIcon, Database01Icon, Timer02Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/app/PageHeader";
import { backend, isTauri } from "@/lib/backend";
import { useSetting } from "@/lib/query";
import { type ThemePref, useApp } from "@/lib/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { DEFAULT_SETTINGS, timer, useTimer } from "@/modules/focus/timer";
import type { PageProps } from "@/modules/types";
import { Button, Card, Icon, type IconType, Input, Kbd } from "@/ui/core";
import { Segmented } from "@/ui/overlay";

function Section({ id, icon, title, desc, children }: { id: string; icon: IconType; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={`s-${id}`} className="anim-rise scroll-mt-6">
      <div className="mb-3 flex items-center gap-2">
        <Icon icon={icon} size={16} className="text-fg-3" />
        <h2 className="text-md font-semibold">{title}</h2>
      </div>
      {desc && <p className="-mt-1.5 mb-3 text-sm text-fg-3">{desc}</p>}
      <Card className="divide-y divide-stroke">{children}</Card>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3">
      <div className="min-w-0">
        <div className="text-base">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-fg-3">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Button
          size="xs"
          variant="ghost"
          icon={copied ? Tick02Icon : Copy01Icon}
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="selectable overflow-x-auto rounded-lg bg-surface-2 px-3 py-2.5 font-mono text-xs leading-relaxed text-fg-2 shadow-[inset_0_0_0_1px_var(--color-stroke)]">{code}</pre>
    </div>
  );
}

const TOOLS = [
  ["yex_overview", "Today's tasks, overdue items, upcoming exams, due reviews, focus minutes"],
  ["yex_schema", "Describes every entity and field so the agent knows the data model"],
  ["yex_list / yex_get / yex_find", "Query and search subjects, chapters, lessons, mistakes, tasks, exams, sessions"],
  ["yex_create / yex_bulk_create", "Add anything — e.g. a whole chapter's lessons in one go"],
  ["yex_update / yex_delete / yex_restore", "Edit or (soft) delete with undo"],
  ["yex_review_mistake", "Grade a spaced-review card"],
  ["yex_settings_get / yex_settings_set", "Read or change app settings"],
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl K", "Search & commands"],
  ["Ctrl N", "New task"],
  ["Ctrl 1–6", "Jump to Home, Focus, Tasks, Exams, Review, Analytics"],
  ["Ctrl Shift Space", "Start / pause the focus timer"],
  ["Ctrl \\", "Toggle sidebar"],
  ["Alt ← / →", "Back / forward"],
  ["Space", "Start/pause (Focus) · reveal answer (Review)"],
  ["1 – 4", "Grade a review card"],
  ["Ctrl Enter", "Save a mistake"],
];

export default function SettingsPage({ params }: PageProps) {
  const theme = useApp((s) => s.theme);
  const [name, setName] = useSetting("profile.name", "");
  const [draft, setDraft] = useState(name);
  const ts = useTimer((s) => s.settings);
  const { data: info } = useQuery({ queryKey: ["app-info"], queryFn: () => backend().appInfo() });
  const scrolled = useRef(false);
  useEffect(() => setDraft(name), [name]);
  useEffect(() => {
    if (params.section && !scrolled.current) {
      scrolled.current = true;
      setTimeout(() => document.getElementById(`s-${params.section}`)?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [params.section]);

  const mcpPath = info?.mcp_path ?? info?.mcp_expected_path ?? "C:\\path\\to\\yex-mcp.exe";
  const json = JSON.stringify({ mcpServers: { yex: { command: mcpPath, args: [] } } }, null, 2);

  const openFolder = async () => {
    if (!isTauri || !info) return toast("Available in the desktop app");
    const { openPath } = await import("@tauri-apps/plugin-opener");
    openPath(info.data_dir).catch((e) => toast(String(e), { tone: "danger" }));
  };

  return (
    <>
      <PageHeader crumbs={[{ label: "Settings" }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] space-y-9 px-8 pb-24 pt-6">
          <h1 className="anim-rise font-display text-[30px] font-medium tracking-tight">Settings</h1>

          <Section id="profile" icon={UserIcon} title="Profile">
            <Row label="Your name" hint="Used in the greeting on Home">
              <Input className="w-56" placeholder="e.g. Youssef" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== name && setName(draft.trim())} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
            </Row>
          </Section>

          <Section id="appearance" icon={PaintBoardIcon} title="Appearance">
            <Row label="Theme" hint="System follows Windows' light/dark setting">
              <Segmented<ThemePref>
                value={theme}
                onChange={(t) => useApp.getState().setTheme(t)}
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </Row>
          </Section>

          <Section id="focus" icon={Timer02Icon} title="Focus timer" desc="Fine-tune durations from the gear on the Focus page.">
            <Row label="Pomodoro" hint={`${ts.focus} min focus · ${ts.short} min short break · ${ts.long} min long break every ${ts.longEvery}`}>
              <Button size="sm" variant="ghost" onClick={() => timer.setSettings(DEFAULT_SETTINGS)}>
                Reset to defaults
              </Button>
            </Row>
          </Section>

          <Section id="agents" icon={AiMagicIcon} title="AI agents (MCP)" desc="Let Claude, Cursor or any MCP-capable agent read and organise your YEX data — log mistakes from a photo, plan your week, build a chapter's lessons, summarise your progress.">
            <Row label="MCP server" hint={<span className="selectable break-all font-mono">{mcpPath}</span>}>
              <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", info?.mcp_path ? "tint-mint tint-bg tint-text" : "bg-hover text-fg-3")}>{info?.mcp_path ? "Installed" : "Not found"}</span>
            </Row>
            <CopyBlock label="Claude Desktop · Cursor (mcpServers config)" code={json} />
            <CopyBlock label="Claude Code" code={`claude mcp add yex -- "${mcpPath}"`} />
            <div className="px-4 py-3">
              <div className="mb-2 text-sm font-medium">What agents can do</div>
              <ul className="space-y-1.5">
                {TOOLS.map(([n, d]) => (
                  <li key={n} className="flex gap-3 text-sm">
                    <code className="shrink-0 font-mono text-xs text-accent">{n}</code>
                    <span className="text-fg-3">{d}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-fg-4">Changes made by agents appear in the app instantly. Everything stays on this computer.</p>
            </div>
          </Section>

          <Section id="data" icon={Database01Icon} title="Data" desc="YEX is local-first: one SQLite file on this PC. Back it up by copying the folder.">
            <Row label="Database" hint={<span className="selectable break-all font-mono">{info?.db_path}</span>}>
              <Button size="sm" variant="outline" icon={Folder01Icon} onClick={openFolder}>
                Open folder
              </Button>
            </Row>
          </Section>

          <Section id="shortcuts" icon={KeyboardIcon} title="Keyboard shortcuts">
            {SHORTCUTS.map(([k, d]) => (
              <Row key={k} label={d}>
                <span className="flex gap-1">
                  {k.split(" ").map((x) => (
                    <Kbd key={x}>{x}</Kbd>
                  ))}
                </span>
              </Row>
            ))}
          </Section>

          <div className="flex items-center gap-3 pt-2 text-xs text-fg-4">
            <img src="/yex.svg" alt="" className="size-6" />
            YEX {info?.version} · made for focused study
          </div>
        </div>
      </div>
    </>
  );
}
