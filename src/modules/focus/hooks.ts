import { useEffect, useState } from "react";
import { elapsedSeconds, targetSeconds, timer, useTimer } from "./timer";

/** Re-renders every `ms` while the timer runs. */
export function useNow(ms = 250, active = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, active]);
  return now;
}

export function useTimerView() {
  const s = useTimer();
  const now = useNow(250, s.status === "running");
  const elapsed = elapsedSeconds(s, now);
  const target = targetSeconds(s);
  const remaining = Number.isFinite(target) ? Math.max(0, target - elapsed) : elapsed;
  const progress = Number.isFinite(target) ? Math.min(1, elapsed / target) : 0;
  return { ...s, elapsed, target, remaining, progress };
}

/** Mounted once in the shell: detects completion even when the Focus page is closed. */
export function TimerEngine() {
  const status = useTimer((s) => s.status);
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      const s = useTimer.getState();
      if (s.status === "running" && elapsedSeconds(s) >= targetSeconds(s)) timer.complete();
    }, 500);
    return () => clearInterval(id);
  }, [status]);
  return null;
}
