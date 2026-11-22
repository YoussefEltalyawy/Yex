import { type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const mix = (color: string, amount: number) => `color-mix(in srgb, ${color} ${amount}%, transparent)`;

/* ---------- Tooltip ---------- */

interface TipState {
  x: number;
  y: number;
  align: "start" | "center" | "end";
  content: ReactNode;
}

/** A tiny hover tooltip anchored to an element, positioned inside `ref`'s box. */
export function useTip<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const show = useCallback((el: Element, content: ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 - box.left;
    setTip({ x, y: r.top - box.top, align: x < 64 ? "start" : x > box.width - 64 ? "end" : "center", content });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const node = tip && (
    <div
      className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-fg px-2 py-1 text-xs leading-snug text-canvas shadow-pop transition-[left,top] duration-100 ease-out"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${tip.align === "start" ? "-12px" : tip.align === "end" ? "calc(-100% + 12px)" : "-50%"}, calc(-100% - 6px))`,
      }}
    >
      {tip.content}
    </div>
  );
  return { ref, show, hide, node };
}

export function TipLine({ title, value, color }: { title: ReactNode; value?: ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      <span className={value != null ? "opacity-70" : "font-medium"}>{title}</span>
      {value != null && <span className="ml-auto pl-3 font-medium tabular">{value}</span>}
    </div>
  );
}

/* ---------- Hooks ---------- */

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** False on first paint, true right after — lets heights/widths transition in from zero. */
export function useGrow(dep?: unknown) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(id);
  }, [dep]);
  return on;
}

/* ---------- Scales ---------- */

const STEPS = [15, 30, 60, 90, 120, 180, 240, 360, 480, 720];
export function minuteTicks(max: number, count = 4) {
  const step = STEPS.find((s) => max / s <= count) ?? 960;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) };
}

export const fmtAxis = (m: number) => (m === 0 ? "0" : m < 60 ? `${m}m` : m % 60 ? `${(m / 60).toFixed(1)}h` : `${m / 60}h`);

/* ---------- Mini bars (no axes) ---------- */

export function MiniBars({
  values,
  labels,
  tips,
  height,
  highlight,
  color = "var(--accent)",
}: {
  values: number[];
  labels?: ReactNode[];
  tips: (i: number) => ReactNode;
  height?: number;
  highlight?: number;
  color?: string;
}) {
  const tip = useTip();
  const grow = useGrow(values.length);
  const max = Math.max(1, ...values);
  return (
    <div ref={tip.ref} className={cn("relative flex flex-col", !height && "min-h-8 flex-1")} onMouseLeave={tip.hide}>
      <div className={cn("flex min-h-0 flex-1 items-end", values.length > 14 ? "gap-[2px]" : "gap-1.5")} style={height ? { height, flex: "none" } : undefined}>
        {values.map((v, i) => (
          <div key={i} className="group flex h-full flex-1 items-end justify-center" onMouseEnter={(e) => tip.show(e.currentTarget.firstElementChild!, tips(i))}>
            <div
              className="w-full max-w-9 rounded-[3px] transition-[height,background-color] duration-500 ease-out"
              style={{
                height: grow ? `${Math.max(v > 0 ? 6 : 3, (v / max) * 100)}%` : "3%",
                background: v <= 0 ? "var(--color-hover)" : i === highlight ? color : mix(color, 45),
              }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div className={cn("mt-1.5 flex", values.length > 14 ? "gap-[2px]" : "gap-1.5")}>
          {labels.map((l, i) => (
            <div key={i} className={cn("flex-1 text-center text-2xs tabular", i === highlight ? "font-medium text-fg-2" : "text-fg-4")}>
              {l}
            </div>
          ))}
        </div>
      )}
      {tip.node}
    </div>
  );
}

/* ---------- Donut ---------- */

export interface Slice {
  key: string;
  value: number;
  color: string;
}

export function Donut({ slices, size = 140, stroke = 14, active, onActive, children }: { slices: Slice[]; size?: number; stroke?: number; active?: string | null; onActive?: (k: string | null) => void; children?: ReactNode }) {
  const grow = useGrow();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((a, s) => a + s.value, 0);
  const gap = slices.length > 1 ? 3 : 0;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" onMouseLeave={() => onActive?.(null)}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-hover)" strokeWidth={stroke} />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.value / total) * c;
            const off = acc;
            acc += len;
            const dim = active && active !== s.key;
            return (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={active === s.key ? stroke + 3 : stroke}
                strokeDasharray={`${grow ? Math.max(0.5, len - gap) : 0} ${c}`}
                strokeDashoffset={-off}
                opacity={dim ? 0.35 : 1}
                onMouseEnter={() => onActive?.(s.key)}
                style={{ transition: "stroke-dasharray 700ms var(--ease-out), opacity 150ms, stroke-width 150ms" }}
              />
            );
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/* ---------- Horizontal bar row ---------- */

export function BarRow({ label, value, max, color, right, grow }: { label: ReactNode; value: number; max: number; color: string; right: ReactNode; grow: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate text-fg-2">{label}</span>
        <span className="shrink-0 text-xs font-medium tabular text-fg-3">{right}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-hover">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: grow && max ? `${(value / max) * 100}%` : 0, background: color }} />
      </div>
    </div>
  );
}

/* ---------- Segmented proportion bar ---------- */

export function StackBar({ parts, className }: { parts: { key: string; value: number; color: string }[]; className?: string }) {
  const grow = useGrow();
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className={cn("flex h-2 gap-[3px] overflow-hidden rounded-full bg-hover", className)}>
      {total > 0 &&
        parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div
              key={p.key}
              className="h-full rounded-[2px] first:rounded-l-full last:rounded-r-full transition-[flex-grow] duration-700 ease-out"
              style={{ flexGrow: grow ? p.value : 0, flexBasis: 0, background: p.color }}
            />
          ))}
    </div>
  );
}

/* ---------- Sparkline ---------- */

export interface SparkPoint {
  t: number;
  v: number;
  tip: ReactNode;
}

export function Sparkline({ points, lo, hi = 100, height = 34, color, fill }: { points: SparkPoint[]; lo: number; hi?: number; height?: number; color: string; fill: string }) {
  const [wref, width] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const gid = `spark${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const pad = 6;
  const x = (t: number) => pad + t * Math.max(0, width - pad * 2);
  const y = (v: number) => pad / 2 + (1 - (v - lo) / (hi - lo)) * (height - pad);
  const xy = points.map((p) => [x(p.t), y(p.v)] as const);
  const line = xy.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join("");
  const area = xy.length > 1 ? `${line}L${xy[xy.length - 1][0].toFixed(1)},${height}L${xy[0][0].toFixed(1)},${height}Z` : "";
  return (
    <div
      ref={(el) => {
        wref.current = el;
        tip.ref.current = el;
      }}
      className="relative min-w-0 flex-1"
      style={{ height }}
      onMouseLeave={tip.hide}
    >
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          <line x1={pad} x2={width - pad} y1={y(hi)} y2={y(hi)} stroke="var(--color-stroke)" strokeDasharray="2 3" />
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={fill} stopOpacity={0.55} />
              <stop offset="1" stopColor={fill} stopOpacity={0} />
            </linearGradient>
          </defs>
          {area && <path d={area} fill={`url(#${gid})`} />}
          {xy.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
          {xy.map(([a, b], i) => {
            const last = i === xy.length - 1;
            return (
              <g key={i}>
                <circle cx={a} cy={b} r={last ? 3.5 : 2.25} fill={last ? color : "var(--surface)"} stroke={color} strokeWidth={1.5} />
                <circle cx={a} cy={b} r={9} fill="transparent" onMouseEnter={(e) => tip.show(e.currentTarget, points[i].tip)} />
              </g>
            );
          })}
        </svg>
      )}
      {tip.node}
    </div>
  );
}
