import { ArrowLeft01Icon, ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, parseDate, toDateStr, today as todayStr, weekStart } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Icon, type IconType } from "./core";

/* ---------------- Popover ---------------- */

export function usePopover<T extends HTMLElement = HTMLButtonElement>() {
  const [open, setOpenState] = useState(false);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<T>(null);
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => {
    setPoint(null);
    setOpenState(v);
  };
  return {
    open,
    setOpen,
    ref,
    point,
    toggle: () => setOpen((o) => !o),
    close: () => setOpenState(false),
    /** Open at the cursor (right-click). */
    openAt: (e: React.MouseEvent) => {
      e.preventDefault();
      setPoint({ x: e.clientX, y: e.clientY });
      setOpenState(true);
    },
  };
}

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: "start" | "end" | "center";
  side?: "bottom" | "top" | "right";
  className?: string;
  offset?: number;
  /** Anchor to a point instead of an element (context menus). */
  point?: { x: number; y: number } | null;
}

export function Popover({ open, onClose, anchor, children, align = "start", side = "bottom", className, offset = 6, point }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const a = point ? new DOMRect(point.x, point.y, 0, 0) : anchor.current?.getBoundingClientRect();
    if (!a) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top: number;
    let left: number;
    if (side === "right") {
      left = a.right + offset;
      top = a.top;
      if (left + w > vw - 8) left = a.left - w - offset;
    } else {
      top = side === "top" ? a.top - h - offset : a.bottom + offset;
      if (side === "bottom" && top + h > vh - 8 && a.top - h - offset > 8) top = a.top - h - offset;
      if (side === "top" && top < 8) top = a.bottom + offset;
      left = align === "start" ? a.left : align === "end" ? a.right - w : a.left + a.width / 2 - w / 2;
    }
    setPos({ top: Math.max(8, Math.min(top, vh - h - 8)), left: Math.max(8, Math.min(left, vw - w - 8)) });
  }, [anchor, align, side, offset, point]);

  useLayoutEffect(() => {
    if (!open) return setPos(null);
    place();
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || (!point && anchor.current?.contains(t))) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, onClose, anchor, point]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      className={cn("anim-pop fixed z-50 rounded-xl bg-surface p-1 shadow-pop", !pos && "invisible", className)}
      style={pos ?? { top: 0, left: 0 }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ---------------- Menu ---------------- */

export interface MenuItem {
  label: string;
  icon?: IconType;
  emoji?: string;
  hint?: string;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  separator?: boolean;
}

export function MenuList({ items, onClose, className }: { items: MenuItem[]; onClose: () => void; className?: string }) {
  const [active, setActive] = useState(-1);
  const selectable = items.map((it, i) => (!it.separator && !it.disabled ? i : -1)).filter((i) => i >= 0);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = selectable.indexOf(active);
        const next = e.key === "ArrowDown" ? selectable[(idx + 1) % selectable.length] : selectable[(idx - 1 + selectable.length) % selectable.length];
        setActive(next ?? -1);
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        items[active].onSelect?.();
        onClose();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  return (
    <div className={cn("min-w-[180px]", className)} role="menu">
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="mx-2 my-1 h-px bg-stroke" />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            onMouseEnter={() => setActive(i)}
            onClick={() => {
              it.onSelect?.();
              onClose();
            }}
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-base transition-colors disabled:opacity-40",
              active === i && "bg-hover",
              it.danger ? "text-danger" : "text-fg",
            )}
          >
            {it.emoji ? <span className="w-4 text-center text-sm">{it.emoji}</span> : it.icon ? <Icon icon={it.icon} size={15} className={it.danger ? "" : "text-fg-2"} /> : null}
            <span className="flex-1 truncate">{it.label}</span>
            {it.hint && <span className="text-xs text-fg-4">{it.hint}</span>}
            {it.checked && <Icon icon={Tick02Icon} size={14} className="text-accent" />}
          </button>
        ),
      )}
    </div>
  );
}

export function Menu({ items, anchor, open, onClose, align = "start", point }: { items: MenuItem[]; anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; align?: "start" | "end"; point?: { x: number; y: number } | null }) {
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} align={align} point={point}>
      <MenuList items={items} onClose={onClose} />
    </Popover>
  );
}

/** Right-click context menu helper. */
export function useContextMenu() {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const anchor = useRef<HTMLElement>(null);
  return {
    point,
    open: !!point,
    anchor,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setPoint({ x: e.clientX, y: e.clientY });
    },
    close: () => setPoint(null),
  };
}

/* ---------------- Select ---------------- */

export interface Option<T extends string> {
  value: T;
  label: string;
  icon?: IconType;
  emoji?: string;
  tint?: string;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder = "Select…",
  className,
  render,
  align = "start",
}: {
  value: T | null | undefined;
  options: Option<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  className?: string;
  render?: (o: Option<T> | undefined) => ReactNode;
  align?: "start" | "end";
}) {
  const p = usePopover();
  const cur = options.find((o) => o.value === value);
  return (
    <>
      <button
        ref={p.ref}
        onClick={p.toggle}
        className={cn("inline-flex h-7 max-w-full items-center gap-1.5 rounded-md px-2 text-sm text-fg transition-colors hover:bg-hover", p.open && "bg-hover", className)}
      >
        {render ? (
          render(cur)
        ) : cur ? (
          <>
            {cur.emoji && <span>{cur.emoji}</span>}
            {cur.icon && <Icon icon={cur.icon} size={14} className="text-fg-2" />}
            {cur.tint && <span className={cn("size-2 rounded-full tint-solid", `tint-${cur.tint}`)} />}
            <span className="truncate">{cur.label}</span>
          </>
        ) : (
          <span className="text-fg-3">{placeholder}</span>
        )}
      </button>
      <Menu
        open={p.open}
        onClose={p.close}
        anchor={p.ref}
        align={align}
        items={options.map((o) => ({ label: o.label, icon: o.icon, emoji: o.emoji, checked: o.value === value, onSelect: () => onChange(o.value) }))}
      />
    </>
  );
}

/* ---------------- Dialog ---------------- */

export function Dialog({ open, onClose, children, className, title }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="anim-fade fixed inset-0 z-40 flex items-start justify-center bg-black/25 pt-[12vh] backdrop-blur-[2px] dark:bg-black/50" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("anim-pop w-[520px] max-w-[calc(100vw-32px)] rounded-2xl bg-surface shadow-pop", className)} role="dialog">
        {title && <div className="px-5 pt-4 font-display text-lg">{title}</div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Segmented ---------------- */

export function Segmented<T extends string>({ value, options, onChange, className, size = "md" }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string; size?: "sm" | "md" }) {
  return (
    <div className={cn("inline-flex rounded-lg bg-hover p-0.5", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 font-medium transition-all duration-150",
            size === "sm" ? "h-6 text-xs" : "h-7 text-sm",
            o.value === value ? "bg-surface text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--color-stroke)]" : "text-fg-3 hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Check (round, Craft-like) ---------------- */

const PRIORITY_RING: Record<string, string> = {
  high: "shadow-[inset_0_0_0_1.5px_var(--rose-fg)] bg-[color-mix(in_srgb,var(--rose)_25%,transparent)] dark:bg-[color-mix(in_srgb,var(--rose)_10%,transparent)]",
  medium: "shadow-[inset_0_0_0_1.5px_var(--butter-fg)] bg-[color-mix(in_srgb,var(--butter)_25%,transparent)] dark:bg-[color-mix(in_srgb,var(--butter)_8%,transparent)]",
  low: "shadow-[inset_0_0_0_1.5px_var(--sky-fg)]",
  none: "shadow-[inset_0_0_0_1.5px_var(--color-fg-4)]",
};

export function Check({ checked, onChange, priority = "none", size = 18, className }: { checked: boolean; onChange: (v: boolean) => void; priority?: string; size?: number; className?: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "group/check grid shrink-0 place-items-center rounded-full transition-all duration-200",
        checked ? "bg-accent shadow-none" : PRIORITY_RING[priority] ?? PRIORITY_RING.none,
        !checked && "hover:brightness-95",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {checked ? (
        <span style={{ animation: "check-pop 260ms var(--ease-spring)" }} className="text-accent-fg">
          <Icon icon={Tick02Icon} size={size - 6} strokeWidth={2.6} />
        </span>
      ) : (
        <span className="text-fg-3 opacity-0 transition-opacity group-hover/check:opacity-60">
          <Icon icon={Tick02Icon} size={size - 6} strokeWidth={2.4} />
        </span>
      )}
    </button>
  );
}

/* ---------------- Date picker ---------------- */

export function DatePanel({ value, onChange, allowClear = true }: { value: string | null; onChange: (v: string | null) => void; allowClear?: boolean }) {
  const t = todayStr();
  const [month, setMonth] = useState(() => {
    const d = parseDate(value ?? t);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const start = weekStart(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const quick: [string, string | null][] = [
    ["Today", t],
    ["Tomorrow", toDateStr(addDays(new Date(), 1))],
    ["Next week", toDateStr(addDays(weekStart(new Date()), 7))],
  ];
  if (allowClear) quick.push(["No date", null]);
  return (
    <div className="w-[248px] p-1.5">
      <div className="mb-1.5 flex flex-wrap gap-1">
        {quick.map(([label, v]) => (
          <button key={label} onClick={() => onChange(v)} className={cn("h-6 rounded-md px-2 text-xs font-medium transition-colors hover:bg-press", value === v ? "bg-accent-soft text-accent" : "bg-hover text-fg-2")}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-sm font-semibold">{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</span>
        <div className="flex">
          <button className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-hover" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <Icon icon={ArrowLeft01Icon} size={14} />
          </button>
          <button className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-hover" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <Icon icon={ArrowRight01Icon} size={14} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-2xs font-medium text-fg-4">
        {["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const s = toDateStr(d);
          const inMonth = d.getMonth() === month.getMonth();
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              className={cn(
                "mx-auto grid size-8 place-items-center rounded-lg text-sm tabular transition-colors",
                s === value ? "bg-accent font-semibold text-accent-fg" : s === t ? "font-semibold text-accent hover:bg-hover" : inMonth ? "text-fg hover:bg-hover" : "text-fg-4 hover:bg-hover",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({ value, onChange, children, className, allowClear }: { value: string | null; onChange: (v: string | null) => void; children: ReactNode; className?: string; allowClear?: boolean }) {
  const p = usePopover();
  return (
    <>
      <button ref={p.ref} onClick={p.toggle} className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm transition-colors hover:bg-hover", p.open && "bg-hover", className)}>
        {children}
      </button>
      <Popover open={p.open} onClose={p.close} anchor={p.ref}>
        <DatePanel
          value={value}
          allowClear={allowClear}
          onChange={(v) => {
            onChange(v);
            p.close();
          }}
        />
      </Popover>
    </>
  );
}
