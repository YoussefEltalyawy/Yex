import { NextIcon, PauseIcon, PlayIcon, ArrowReloadHorizontalIcon, Settings02Icon, StopIcon, VolumeHighIcon, VolumeOffIcon, PaintBoardIcon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/PageHeader";
import { fmtClock, fmtMinutes, startOfDay } from "@/lib/dates";
import { useList } from "@/lib/query";
import type { TimerMode } from "@/lib/types";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { PageProps } from "@/modules/types";
import { Button, IconButton } from "@/ui/core";
import { Popover, Segmented, usePopover } from "@/ui/overlay";
import { useTimerView } from "./hooks";
import { TaskPicker } from "./parts";
import { MODE_LABEL, PHASE_LABEL, timer, type TimerSettings, useTimer } from "./timer";

const SCENES = {
  paper: { label: "Paper", bg: "var(--canvas)", dark: false },
  sunrise: { label: "Sunrise", bg: "radial-gradient(120% 90% at 20% 10%, #fde8d7 0%, transparent 60%), radial-gradient(90% 80% at 90% 90%, #e6d9f7 0%, transparent 60%), #fbf3ee", dark: false },
  meadow: { label: "Meadow", bg: "radial-gradient(110% 90% at 10% 0%, #e2f3e4 0%, transparent 60%), radial-gradient(100% 80% at 100% 100%, #fdf1c7 0%, transparent 60%), #f6f8f1", dark: false },
  dusk: { label: "Dusk", bg: "radial-gradient(120% 90% at 80% 100%, #c97b6a 0%, transparent 55%), radial-gradient(120% 100% at 0% 0%, #2b2650 0%, transparent 70%), #4a3555", dark: true },
  forest: { label: "Forest", bg: "radial-gradient(120% 90% at 50% 120%, #6f9465 0%, transparent 60%), linear-gradient(170deg, #17241c, #2c4634)", dark: true },
  ocean: { label: "Ocean", bg: "radial-gradient(120% 100% at 100% 0%, #3f86a3 0%, transparent 60%), linear-gradient(200deg, #0e1f30, #18394f)", dark: true },
  night: { label: "Night", bg: "radial-gradient(80% 60% at 50% 40%, #1f1f26 0%, #0c0c0f 100%)", dark: true },
} as const;
type Scene = keyof typeof SCENES;

function NumberField({ label, value, onChange, suffix = "min" }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex h-8 items-center justify-between gap-3 rounded-lg px-2 text-base hover:bg-hover">
      <span className="text-fg-2">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={240}
          value={value}
          onChange={(e) => onChange(Math.max(1, Math.min(240, Number(e.target.value) || 1)))}
          className="h-6 w-12 rounded-md bg-hover text-center text-sm tabular outline-none focus:bg-selected"
        />
        <span className="w-6 text-xs text-fg-4">{suffix}</span>
      </span>
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex h-8 w-full items-center justify-between rounded-lg px-2 text-base hover:bg-hover">
      <span className="text-fg-2">{label}</span>
      <span className={cn("relative h-[18px] w-8 rounded-full transition-colors", value ? "bg-accent" : "bg-press")}>
        <span className={cn("absolute top-[2px] size-[14px] rounded-full bg-white shadow transition-[left] duration-200", value ? "left-[16px]" : "left-[2px]")} />
      </span>
    </button>
  );
}

function SettingsPopover() {
  const p = usePopover();
  const s = useTimer((x) => x.settings);
  const set = (patch: Partial<TimerSettings>) => timer.setSettings(patch);
  return (
    <>
      <IconButton ref={p.ref} icon={Settings02Icon} label="Timer settings" size="md" onClick={p.toggle} />
      <Popover open={p.open} onClose={p.close} anchor={p.ref} align="end" className="w-[280px] p-1.5">
        <div className="px-2 pb-1 pt-1 text-xs font-medium text-fg-3">Pomodoro</div>
        <NumberField label="Focus" value={s.focus} onChange={(focus) => set({ focus })} />
        <NumberField label="Short break" value={s.short} onChange={(short) => set({ short })} />
        <NumberField label="Long break" value={s.long} onChange={(long) => set({ long })} />
        <NumberField label="Long break every" value={s.longEvery} suffix="" onChange={(longEvery) => set({ longEvery })} />
        <div className="mx-2 my-1 h-px bg-stroke" />
        <NumberField label="Countdown" value={s.countdown} onChange={(countdown) => set({ countdown })} />
        <NumberField label="Flow focus" value={s.flowFocus} onChange={(flowFocus) => set({ flowFocus })} />
        <NumberField label="Flow break" value={s.flowBreak} onChange={(flowBreak) => set({ flowBreak })} />
        <div className="mx-2 my-1 h-px bg-stroke" />
        <Toggle label="Auto-start breaks" value={s.autoBreaks} onChange={(autoBreaks) => set({ autoBreaks })} />
        <Toggle label="Auto-start focus" value={s.autoFocus} onChange={(autoFocus) => set({ autoFocus })} />
        <Toggle label="Sound" value={s.sound} onChange={(sound) => set({ sound })} />
      </Popover>
    </>
  );
}

function ScenePicker({ scene, onChange }: { scene: Scene; onChange: (s: Scene) => void }) {
  const p = usePopover();
  return (
    <>
      <IconButton ref={p.ref} icon={PaintBoardIcon} label="Scene" size="md" onClick={p.toggle} />
      <Popover open={p.open} onClose={p.close} anchor={p.ref} align="end" className="w-[248px] p-2">
        <div className="px-1 pb-2 text-xs font-medium text-fg-3">Scene</div>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(SCENES) as Scene[]).map((k) => (
            <button key={k} onClick={() => onChange(k)} className="group flex flex-col items-center gap-1">
              <span className={cn("h-10 w-full rounded-lg shadow-card transition-transform group-hover:scale-105", k === scene && "ring-2 ring-accent ring-offset-2 ring-offset-surface")} style={{ background: SCENES[k].bg }} />
              <span className="text-2xs text-fg-3">{SCENES[k].label}</span>
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

export default function FocusPage(_: PageProps) {
  const t = useTimerView();
  const [scene, setScene] = useState<Scene>(() => (localStorage.getItem("yex-focus-scene") as Scene) || "paper");
  useEffect(() => {
    localStorage.setItem("yex-focus-scene", scene);
    useApp.setState({ chromeDark: SCENES[scene].dark });
    return () => useApp.setState({ chromeDark: false });
  }, [scene]);
  const since = useMemo(() => startOfDay().toISOString(), []);
  const { data: sessions = [] } = useList("focus_session", { filter: { kind: "focus", started_at: { gte: since } }, order_by: "started_at" });
  const { data: tasks = [] } = useList("task", { filter: { done: false } });
  const todayMin = sessions.reduce((a, s) => a + s.duration_sec, 0) / 60;
  const sc = SCENES[scene];
  const running = t.status === "running";
  const display = t.mode === "stopwatch" ? t.elapsed : t.remaining;
  const longEvery = t.settings.longEvery;
  const currentTask = tasks.find((x) => x.id === t.taskId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable='true']")) return;
      if (e.code === "Space" && !e.ctrlKey) {
        e.preventDefault();
        timer.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.title = t.status === "idle" ? "YEX" : `${fmtClock(display)} · ${PHASE_LABEL[t.phase]} — YEX`;
    return () => void (document.title = "YEX");
  }, [display, t.status, t.phase]);

  return (
    <div className={cn("relative flex h-full flex-col overflow-hidden transition-[background] duration-500", sc.dark && "dark text-fg")} style={{ background: sc.bg }}>
      <PageHeader crumbs={[{ label: "Focus" }]} transparent actions={<><ScenePicker scene={scene} onChange={setScene} /><SettingsPopover /></>} />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-10">
        <Segmented<TimerMode>
          value={t.mode}
          onChange={(m) => timer.setMode(m)}
          options={(Object.keys(MODE_LABEL) as TimerMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
          className={cn("mb-10", sc.dark && scene !== "paper" && "bg-white/10")}
        />
        <div className={cn("mb-2 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em]", t.phase === "focus" ? "text-fg-3" : "text-[var(--mint-fg)]")}>
          {PHASE_LABEL[t.phase]}
        </div>
        <div className={cn("select-none font-display text-[148px] font-light leading-none tracking-[-0.04em] tabular transition-opacity", t.status === "paused" && "opacity-50")} aria-live="off">
          {fmtClock(display)}
        </div>
        <div className="mt-6 h-[3px] w-[360px] max-w-full overflow-hidden rounded-full bg-hover">
          <div className={cn("h-full rounded-full transition-[width] duration-300 ease-linear", t.phase === "focus" ? "bg-accent" : "bg-[var(--mint-fg)]")} style={{ width: `${(t.mode === "stopwatch" ? 0 : t.progress) * 100}%` }} />
        </div>
        {t.mode === "pomodoro" && (
          <div className="mt-4 flex gap-1.5" title={`Round ${(t.cycle % longEvery) + 1} of ${longEvery}`}>
            {Array.from({ length: longEvery }, (_, i) => (
              <span key={i} className={cn("size-2 rounded-full transition-colors", i < t.cycle % longEvery ? "bg-accent" : i === t.cycle % longEvery && t.phase === "focus" && t.status !== "idle" ? "bg-accent/50" : "bg-press")} />
            ))}
          </div>
        )}
        <TaskPicker className="mt-8 text-md" />
        {currentTask?.estimate_min && <div className="mt-1 text-xs text-fg-3">Estimated {fmtMinutes(currentTask.estimate_min)}</div>}

        <div className="mt-8 flex items-center gap-3">
          <IconButton icon={ArrowReloadHorizontalIcon} label="Reset" size="lg" className="rounded-full" onClick={timer.reset} disabled={t.status === "idle" && t.elapsed === 0} />
          <Button
            variant={running ? "subtle" : "accent"}
            size="lg"
            icon={running ? PauseIcon : PlayIcon}
            className="h-12 min-w-[150px] rounded-full text-md"
            onClick={timer.toggle}
          >
            {running ? "Pause" : t.status === "paused" ? "Resume" : t.phase === "focus" ? "Start" : "Start break"}
          </Button>
          {t.mode === "stopwatch" || t.status !== "idle" ? (
            <IconButton icon={StopIcon} label="Finish & log" size="lg" className="rounded-full" onClick={() => timer.finish()} disabled={t.elapsed < 1} />
          ) : (
            <IconButton icon={NextIcon} label="Skip to next phase" size="lg" className="rounded-full" onClick={timer.skip} />
          )}
        </div>
        <div className="mt-3 text-xs text-fg-4">Space to start / pause · Ctrl+Shift+Space anywhere</div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
        <div className="pointer-events-auto rounded-xl px-3 py-2 text-sm text-fg-2">
          <span className="font-display text-xl text-fg tabular">{fmtMinutes(todayMin)}</span> focused today · {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
        </div>
        <IconButton
          icon={t.settings.sound ? VolumeHighIcon : VolumeOffIcon}
          label={t.settings.sound ? "Mute chime" : "Unmute chime"}
          size="md"
          className="pointer-events-auto"
          onClick={() => timer.setSettings({ sound: !t.settings.sound })}
        />
      </div>
    </div>
  );
}
