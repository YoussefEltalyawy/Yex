import { useEffect, useState } from "react";
import { useCreate, useList, useUpdate } from "@/lib/query";
import { navigate } from "@/lib/store";
import { SUBJECT_COLORS, type Subject, type SubjectColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/ui/core";
import { Dialog } from "@/ui/overlay";

export const EMOJIS = ["📐", "➗", "📊", "⚛️", "🔭", "⚡", "🧲", "🧪", "⚗️", "🧬", "🌱", "📜", "✍️", "📖", "🔤", "🗣️", "🌍", "🏛️", "💻", "🎨", "🎵", "🏋️", "🧠", "💡", "📘", "📗", "📕", "📙", "🗂️", "⭐", "🔥", "🎯"];

export function SubjectDialog({ open, onClose, subject }: { open: boolean; onClose: () => void; subject?: Subject }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📘");
  const [color, setColor] = useState<SubjectColor>("sky");
  const create = useCreate("subject");
  const update = useUpdate("subject");
  const { data: all = [] } = useList("subject");

  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? "");
    setIcon(subject?.icon ?? "📘");
    setColor(subject?.color ?? SUBJECT_COLORS[all.length % SUBJECT_COLORS.length]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subject]);

  const save = async () => {
    if (!name.trim()) return;
    if (subject) update.mutate({ id: subject.id, patch: { name: name.trim(), icon, color } });
    else {
      const s = await create.mutateAsync({ name: name.trim(), icon, color, position: all.length });
      navigate("subject", { id: s.id });
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={subject ? "Edit subject" : "New subject"} className="w-[420px]">
      <div className="space-y-4 px-5 pb-5 pt-3">
        <div className="flex items-center gap-3">
          <div className={cn("grid size-12 shrink-0 place-items-center rounded-xl text-[24px] tint-bg", `tint-${color}`)}>{icon}</div>
          <Input autoFocus placeholder="Subject name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-fg-3">Color</div>
          <div className="flex gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn("size-7 rounded-full tint-solid transition-transform hover:scale-110", `tint-${c}`, c === color && "ring-2 ring-fg ring-offset-2 ring-offset-surface")}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-fg-3">Icon</div>
          <div className="grid grid-cols-11 gap-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setIcon(e)} className={cn("grid size-8 place-items-center rounded-lg text-[17px] transition-colors hover:bg-hover", e === icon && "bg-selected")}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" onClick={save} disabled={!name.trim()}>
            {subject ? "Save" : "Create subject"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
