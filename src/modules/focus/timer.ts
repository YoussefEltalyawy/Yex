import { create } from "zustand";
import { backend, isTauri } from "@/lib/backend";
import { invalidateAll } from "@/lib/query";
import { toast } from "@/lib/toast";
import type { Id, TimerMode } from "@/lib/types";
import { chime } from "./sound";

export type Phase = "focus" | "short" | "long";
export type Status = "idle" | "running" | "paused";

export interface TimerSettings {
  focus: number;
  short: number;
  long: number;
  longEvery: number;
  countdown: number;
  flowFocus: number;
  flowBreak: number;
  autoBreaks: boolean;
  autoFocus: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: TimerSettings = {
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  countdown: 60,
  flowFocus: 52,
  flowBreak: 17,
  autoBreaks: true,
  autoFocus: false,
  sound: true,
};

export const MODE_LABEL: Record<TimerMode, string> = { pomodoro: "Pomodoro", countdown: "Countdown", stopwatch: "Stopwatch", flow: "52 / 17" };
export const PHASE_LABEL: Record<Phase, string> = { focus: "Focus", short: "Short break", long: "Long break" };

interface TimerState {
  mode: TimerMode;
  phase: Phase;
  status: Status;
  runStartedAt: number | null;
  accumulated: number;
  sessionStartedAt: string | null;
  taskId: Id | null;
  subjectId: Id | null;
  cycle: number;
  settings: TimerSettings;
}

const KEY = "yex-timer";
const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<TimerState> | null;

export const useTimer = create<TimerState>(() => ({
  mode: "pomodoro",
  phase: "focus",
  status: "idle",
  runStartedAt: null,
  accumulated: 0,
  sessionStartedAt: null,
  taskId: null,
  subjectId: null,
  cycle: 0,
  ...saved,
  settings: { ...DEFAULT_SETTINGS, ...saved?.settings },
}));

useTimer.subscribe((s) => localStorage.setItem(KEY, JSON.stringify(s)));

export function targetSeconds(s: Pick<TimerState, "mode" | "phase" | "settings">) {
  const t = s.settings;
  if (s.mode === "stopwatch") return Infinity;
  if (s.mode === "countdown") return t.countdown * 60;
  if (s.mode === "flow") return (s.phase === "focus" ? t.flowFocus : t.flowBreak) * 60;
  return (s.phase === "focus" ? t.focus : s.phase === "short" ? t.short : t.long) * 60;
}

export function elapsedSeconds(s: Pick<TimerState, "accumulated" | "runStartedAt" | "status">, now = Date.now()) {
  return s.accumulated + (s.status === "running" && s.runStartedAt ? (now - s.runStartedAt) / 1000 : 0);
}

const set = useTimer.setState;
const get = useTimer.getState;

async function notify(title: string, body: string) {
  try {
    if (isTauri) {
      const n = await import("@tauri-apps/plugin-notification");
      if (!(await n.isPermissionGranted()) && (await n.requestPermission()) !== "granted") return;
      n.sendNotification({ title, body });
    } else if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
  } catch {
    /* notifications are best-effort */
  }
}

async function log(s: TimerState, durationSec: number, completed: boolean) {
  if (s.phase !== "focus" || durationSec < 60) return;
  await backend()
    .create("focus_session", {
      started_at: s.sessionStartedAt ?? new Date(Date.now() - durationSec * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_sec: Math.round(durationSec),
      mode: s.mode,
      kind: "focus",
      task_id: s.taskId,
      subject_id: s.taskId ? undefined : s.subjectId,
      completed,
    })
    .then(invalidateAll)
    .catch((e) => toast(`Couldn't log session: ${e}`, { tone: "danger" }));
}

export const timer = {
  start() {
    const s = get();
    if (s.status === "running") return;
    set({
      status: "running",
      runStartedAt: Date.now(),
      sessionStartedAt: s.status === "idle" ? new Date().toISOString() : s.sessionStartedAt,
    });
  },
  pause() {
    const s = get();
    if (s.status !== "running") return;
    set({ status: "paused", accumulated: elapsedSeconds(s), runStartedAt: null });
  },
  toggle() {
    if (get().status === "running") timer.pause();
    else timer.start();
  },
  reset() {
    set({ status: "idle", accumulated: 0, runStartedAt: null, sessionStartedAt: null });
  },
  setMode(mode: TimerMode) {
    set({ mode, phase: "focus", status: "idle", accumulated: 0, runStartedAt: null, sessionStartedAt: null, cycle: 0 });
  },
  setTask(taskId: Id | null, subjectId: Id | null = null) {
    set({ taskId, subjectId });
  },
  setSettings(patch: Partial<TimerSettings>) {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
  },
  /** End the current session early, logging the time spent. */
  async finish() {
    const s = get();
    const elapsed = elapsedSeconds(s);
    timer.reset();
    await log(s, elapsed, s.mode === "stopwatch");
    if (s.phase === "focus" && elapsed >= 60) toast(`Logged ${Math.round(elapsed / 60)} min of focus`, { tone: "success" });
  },
  /** Jump to the next phase without logging. */
  skip() {
    advance(false);
  },
  /** Called by the engine when a timed phase reaches zero. */
  async complete() {
    const s = get();
    const secs = targetSeconds(s);
    advance(true);
    if (s.settings.sound) chime(s.phase === "focus" ? "done" : "start");
    notify(s.phase === "focus" ? "Focus session complete" : "Break's over", s.phase === "focus" ? "Nice work — take a breather." : "Ready for the next round?");
    await log(s, secs, true);
  },
};

function advance(fromCompletion: boolean) {
  const s = get();
  if (s.mode === "countdown" || s.mode === "stopwatch") return timer.reset();
  let phase: Phase;
  let cycle = s.cycle;
  if (s.phase === "focus") {
    cycle += fromCompletion ? 1 : 0;
    phase = s.mode === "pomodoro" && cycle > 0 && cycle % s.settings.longEvery === 0 && fromCompletion ? "long" : "short";
  } else phase = "focus";
  const auto = phase === "focus" ? s.settings.autoFocus : s.settings.autoBreaks;
  set({
    phase,
    cycle,
    accumulated: 0,
    status: auto && fromCompletion ? "running" : "idle",
    runStartedAt: auto && fromCompletion ? Date.now() : null,
    sessionStartedAt: auto && fromCompletion ? new Date().toISOString() : null,
  });
}
