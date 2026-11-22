import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Fragment, type ReactNode } from "react";
import { isTauri } from "@/lib/backend";
import { navigate, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Icon, IconButton } from "@/ui/core";

export interface Crumb {
  label: ReactNode;
  route?: [string, Record<string, string>?];
  emoji?: string;
}

/** Draggable top bar of the content panel: history, breadcrumbs, page actions. */
export function PageHeader({ crumbs, actions, className, transparent }: { crumbs: Crumb[]; actions?: ReactNode; className?: string; transparent?: boolean }) {
  const back = useApp((s) => s.back.length > 0);
  const fwd = useApp((s) => s.forward.length > 0);
  return (
    <header
      data-tauri-drag-region
      className={cn("drag relative z-10 flex h-11 shrink-0 items-center gap-1 pl-2.5", isTauri ? "pr-[150px]" : "pr-3", !transparent && "bg-canvas", className)}
    >
      <div className="no-drag flex items-center">
        <IconButton icon={ArrowLeft01Icon} label="Back (Alt+←)" size="sm" disabled={!back} onClick={() => useApp.getState().goBack()} />
        <IconButton icon={ArrowRight01Icon} label="Forward (Alt+→)" size="sm" disabled={!fwd} onClick={() => useApp.getState().goForward()} />
      </div>
      <nav className="no-drag ml-1 flex min-w-0 items-center gap-0.5 text-base">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <Icon icon={ArrowRight01Icon} size={13} className="text-fg-4" />}
            <button
              disabled={!c.route}
              onClick={() => c.route && navigate(c.route[0], c.route[1])}
              className={cn(
                "flex h-7 min-w-0 items-center gap-1.5 rounded-md px-1.5 transition-colors",
                i === crumbs.length - 1 ? "font-medium text-fg" : "text-fg-3 hover:bg-hover hover:text-fg",
                !c.route && "pointer-events-none",
              )}
            >
              {c.emoji && <span className="text-[13px]">{c.emoji}</span>}
              <span className="truncate" dir="auto">
                {c.label}
              </span>
            </button>
          </Fragment>
        ))}
      </nav>
      <div className="flex-1" data-tauri-drag-region />
      {actions && <div className="no-drag flex items-center gap-1">{actions}</div>}
    </header>
  );
}

/** Standard scrollable page body with a comfortable reading width. */
export function PageBody({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={cn("mx-auto px-8 pb-16 pt-4", wide ? "max-w-[1180px]" : "max-w-[860px]", className)}>{children}</div>
    </div>
  );
}

export function PageTitle({ children, sub, emoji, action }: { children: ReactNode; sub?: ReactNode; emoji?: ReactNode; action?: ReactNode }) {
  return (
    <div className="anim-rise mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {emoji && <div className="mb-2 text-[34px] leading-none">{emoji}</div>}
        <h1 className="font-display text-[30px] font-medium leading-tight tracking-tight" dir="auto">
          {children}
        </h1>
        {sub && <div className="mt-1 text-base text-fg-3">{sub}</div>}
      </div>
      {action}
    </div>
  );
}
