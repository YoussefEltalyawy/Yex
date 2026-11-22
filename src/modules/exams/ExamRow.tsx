import { Alert02Icon, Delete02Icon, Edit02Icon, MoreHorizontalIcon, Target02Icon } from "@hugeicons/core-free-icons";
import { countdown, fmtWeekday } from "@/lib/dates";
import { useRemove, useUpdate } from "@/lib/query";
import type { Exam, Subject } from "@/lib/types";
import { cn, EXAM_KINDS } from "@/lib/utils";
import { IconButton } from "@/ui/core";
import { Menu, usePopover } from "@/ui/overlay";
import { CountdownPill, DateTile, LogScoreButton, needsScore, ScorePill, StatusBadge, usePrepare } from "./parts";

export function ExamRow({ exam, subject, selected, onOpen, defaultMax, past }: { exam: Exam; subject?: Subject; selected?: boolean; onOpen: () => void; defaultMax?: number | null; past?: boolean }) {
  const menu = usePopover();
  const update = useUpdate("exam");
  const remove = useRemove("exam", "Exam");
  const prepare = usePrepare();
  const pending = needsScore(exam);
  const inactive = exam.status === "cancelled" || exam.status === "missed";
  const meta = [EXAM_KINDS[exam.kind], past ? countdown(exam.date) : fmtWeekday(exam.date) + (exam.time ? ` ${exam.time}` : ""), exam.scope].filter(Boolean).join(" · ");

  return (
    <div
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        menu.setOpen(true);
      }}
      className={cn("group relative flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-100", selected ? "bg-selected" : "hover:bg-hover")}
    >
      <span title={subject?.name}>
        <DateTile date={exam.date} color={subject?.color} muted={past && !pending} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-base font-medium", inactive && "text-fg-3", exam.status === "cancelled" && "line-through decoration-fg-4")} dir="auto">
          {exam.title}
        </div>
        <div className="truncate text-xs text-fg-3" dir="auto">
          {meta}
        </div>
      </div>
      <div className={cn("flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100", menu.open && "opacity-100")} onClick={(e) => e.stopPropagation()}>
        {!past && <IconButton icon={Target02Icon} label="Add prep task" size="xs" onClick={() => prepare(exam)} />}
        <IconButton ref={menu.ref} icon={MoreHorizontalIcon} label="More" size="xs" onClick={menu.toggle} />
      </div>
      {pending ? (
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-[var(--butter-fg)]">Needs score</span>
          <LogScoreButton exam={exam} defaultMax={defaultMax} size="xs" variant="outline" className="px-2" />
        </span>
      ) : past ? (
        <>
          <StatusBadge status={exam.status} />
          <ScorePill exam={exam} />
          {exam.status === "done" && exam.score == null && <span className="text-xs text-fg-4">No score</span>}
        </>
      ) : (
        <CountdownPill date={exam.date} className="min-w-[62px] justify-end" />
      )}
      <Menu
        open={menu.open}
        onClose={menu.close}
        anchor={menu.ref}
        align="end"
        items={[
          { label: "Open details", icon: Edit02Icon, onSelect: onOpen },
          { label: "Add prep task", icon: Target02Icon, onSelect: () => prepare(exam), disabled: past },
          { label: "Mark as missed", icon: Alert02Icon, onSelect: () => update.mutate({ id: exam.id, patch: { status: "missed" } }), disabled: exam.status === "missed" },
          { separator: true, label: "" },
          { label: "Delete", icon: Delete02Icon, danger: true, onSelect: () => remove.mutate(exam.id) },
        ]}
      />
    </div>
  );
}
