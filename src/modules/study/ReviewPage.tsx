import { ArrowRight01Icon, Brain02Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/PageHeader";
import { today } from "@/lib/dates";
import { useList, useReview, useRow } from "@/lib/query";
import { navigate } from "@/lib/store";
import type { Mistake, ReviewGrade } from "@/lib/types";
import { cn, MISTAKE_KINDS, plural } from "@/lib/utils";
import type { PageProps } from "@/modules/types";
import { Button, Empty, Icon, Kbd, Progress } from "@/ui/core";
import { Markdown } from "@/ui/Markdown";
import { KIND_TINT } from "./mistakes";

const LADDER = [1, 3, 7, 14, 30, 60];
const stage = (n: number) => LADDER[Math.min(Math.max(n, 0), LADDER.length - 1)];
const interval = (m: Mistake, g: ReviewGrade) => (g === "again" ? 1 : g === "hard" ? Math.min(stage(m.review_count), 3) : g === "good" ? stage(m.review_count) : stage(m.review_count + 1));
const fmtDays = (d: number) => (d === 1 ? "1 day" : d < 30 ? `${d} days` : d < 60 ? "1 month" : "2 months");

const GRADES: { g: ReviewGrade; label: string; key: string; cls: string }[] = [
  { g: "again", label: "Again", key: "1", cls: "tint-rose" },
  { g: "hard", label: "Hard", key: "2", cls: "tint-peach" },
  { g: "good", label: "Good", key: "3", cls: "tint-sky" },
  { g: "easy", label: "Easy", key: "4", cls: "tint-mint" },
];

export default function ReviewPage({ params }: PageProps) {
  const [all, setAll] = useState(false);
  const scope = params.lesson ? { lesson_id: params.lesson } : params.subject ? { subject_id: params.subject } : {};
  const filter = { ...scope, status: { ne: "mastered" }, ...(all || params.lesson ? {} : { next_review_at: { lte: today() } }) };
  const { data: fetched, isLoading } = useList("mistake", { filter, order_by: "next_review_at, created_at" });
  const { data: subjects = [] } = useList("subject");
  const { data: lessons = [] } = useList("lesson");
  const { data: scopeLesson } = useRow("lesson", params.lesson);
  const { data: scopeSubject } = useRow("subject", params.subject);
  const review = useReview();

  // Freeze the queue when the session starts so graded cards don't reshuffle it.
  const [queue, setQueue] = useState<Mistake[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tally, setTally] = useState<Record<ReviewGrade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  useEffect(() => {
    if (fetched && queue === null) setQueue(fetched);
  }, [fetched, queue]);

  const m = queue?.[idx];
  const subject = subjects.find((s) => s.id === m?.subject_id);
  const lesson = lessons.find((l) => l.id === m?.lesson_id);
  const done = queue && idx >= queue.length;

  const grade = (g: ReviewGrade) => {
    if (!m || !revealed) return;
    review.mutate({ id: m.id, grade: g });
    setTally((t) => ({ ...t, [g]: t[g] + 1 }));
    if (g === "again" && queue) setQueue([...queue, m]);
    setRevealed(false);
    setIdx((i) => i + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable='true']")) return;
      if ((e.code === "Space" || e.key === "Enter") && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else {
        const hit = GRADES.find((x) => x.key === e.key);
        if (hit) grade(hit.g);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const scopeLabel = scopeLesson?.name ?? scopeSubject?.name;
  const reviewed = useMemo(() => Object.values(tally).reduce((a, b) => a + b, 0), [tally]);

  return (
    <>
      <PageHeader crumbs={[{ label: "Review", route: scopeLabel ? ["review"] : undefined }, ...(scopeLabel ? [{ label: scopeLabel }] : [])]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[720px] flex-col px-8 pb-16 pt-6">
          {!isLoading && queue && queue.length === 0 && (
            <Empty
              className="my-auto"
              icon="🌿"
              title="All caught up"
              hint={scopeLabel ? `No open mistakes in ${scopeLabel}.` : "No mistakes are due for review today. Spaced review brings each one back right before you'd forget it."}
              action={
                !params.lesson && (
                  <Button variant="outline" icon={Brain02Icon} onClick={() => (setAll(true), setQueue(null), setIdx(0))}>
                    Review all open mistakes anyway
                  </Button>
                )
              }
            />
          )}

          {queue && queue.length > 0 && !done && m && (
            <>
              <div className="mb-6 flex items-center gap-4">
                <Progress value={(idx / queue.length) * 100} className="flex-1" />
                <span className="text-sm tabular text-fg-3">
                  {idx + 1} / {queue.length}
                </span>
              </div>
              <article key={`${m.id}-${idx}`} className="anim-rise rounded-2xl bg-surface shadow-card">
                <div className="flex items-center gap-2 px-6 pt-5 text-sm text-fg-3">
                  {subject && <span className={cn("grid size-6 place-items-center rounded-md text-[12px] tint-bg", `tint-${subject.color}`)}>{subject.icon}</span>}
                  <span className="truncate" dir="auto">
                    {[subject?.name, lesson?.name].filter(Boolean).join(" · ")}
                  </span>
                  <span className="flex-1" />
                  <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium tint-bg tint-text", `tint-${KIND_TINT[m.kind]}`)}>{MISTAKE_KINDS[m.kind]}</span>
                </div>
                <div className="px-6 pb-6 pt-4">
                  {m.title && (
                    <div className="mb-2 font-display text-[22px] font-medium" dir="auto">
                      {m.title}
                    </div>
                  )}
                  <Markdown source={m.question} compact={false} />
                </div>
                {revealed ? (
                  <div className="anim-fade space-y-3 border-t border-stroke px-6 py-5">
                    {m.my_answer && (
                      <div className="text-sm">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--rose-fg)]">You wrote</span>
                        <Markdown source={m.my_answer} className="mt-0.5 text-fg-2 line-through decoration-[var(--rose-fg)]/50" />
                      </div>
                    )}
                    {m.correct_answer && (
                      <div className="rounded-xl px-4 py-3 tint-mint tint-bg">
                        <div className="text-xs font-semibold uppercase tracking-wider tint-text">Correct answer</div>
                        <Markdown source={m.correct_answer} className="mt-0.5 text-md" />
                      </div>
                    )}
                    {m.explanation && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-fg-3">Key idea</div>
                        <Markdown source={m.explanation} className="mt-0.5" />
                      </div>
                    )}
                    {!m.correct_answer && !m.explanation && !m.my_answer && <div className="text-sm text-fg-3">No answer saved for this one. Check it yourself, then grade.</div>}
                  </div>
                ) : (
                  <button onClick={() => setRevealed(true)} className="flex h-14 w-full items-center justify-center gap-2 rounded-b-2xl border-t border-stroke text-base font-medium text-fg-2 transition-colors hover:bg-hover hover:text-fg">
                    <Icon icon={ViewIcon} size={16} /> Show answer <Kbd className="ml-1">Space</Kbd>
                  </button>
                )}
              </article>
              {revealed && (
                <div className="anim-rise mt-5 grid grid-cols-4 gap-2">
                  {GRADES.map(({ g, label, key, cls }) => (
                    <button key={g} onClick={() => grade(g)} className={cn("flex flex-col items-center gap-0.5 rounded-xl py-3 tint-bg transition-transform hover:-translate-y-0.5 active:translate-y-0", cls)}>
                      <span className="text-base font-semibold tint-text">{label}</span>
                      <span className="text-xs text-fg-3">{fmtDays(interval(m, g))}</span>
                      <Kbd className="mt-1">{key}</Kbd>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => m.lesson_id && navigate("lesson", { id: m.lesson_id, tab: "mistakes", focus: m.id })} className="mx-auto mt-6 flex items-center gap-1 text-xs text-fg-4 hover:text-fg-2">
                Open in lesson <Icon icon={ArrowRight01Icon} size={12} />
              </button>
            </>
          )}

          {done && queue!.length > 0 && (
            <div className="anim-rise my-auto text-center">
              <div className="mb-3 text-[44px]">🎉</div>
              <h2 className="font-display text-[30px] font-medium">Session complete</h2>
              <p className="mt-1 text-base text-fg-3">You reviewed {plural(reviewed, "card")}. They'll come back right when you need them.</p>
              <div className="mx-auto mt-6 grid max-w-[420px] grid-cols-4 gap-2">
                {GRADES.map(({ g, label, cls }) => (
                  <div key={g} className={cn("rounded-xl py-3 tint-bg", cls)}>
                    <div className="font-display text-2xl tint-text">{tally[g]}</div>
                    <div className="text-xs text-fg-3">{label}</div>
                  </div>
                ))}
              </div>
              <Button className="mt-8" variant="solid" onClick={() => navigate("home")}>
                Back home
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
