import { dismiss, useToasts } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "anim-rise pointer-events-auto flex h-9 items-center gap-3 rounded-xl bg-fg pl-3.5 pr-1.5 text-sm text-canvas shadow-pop",
            t.tone === "danger" && "bg-danger text-white",
            !t.action && "pr-3.5",
          )}
        >
          <span className="max-w-[420px] truncate">{t.message}</span>
          {t.action && (
            <button
              className="h-6 rounded-md px-2 text-sm font-semibold opacity-90 hover:bg-white/15 dark:hover:bg-black/10"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
