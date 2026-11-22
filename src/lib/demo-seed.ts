/** Realistic demo data for the browser mock (never used by the desktop app). */
import { addDays, toDateStr } from "./dates";

type Create = (entity: string, data: Record<string, unknown>) => { id: string } & Record<string, unknown>;

const LIMITS_NOTES = `# Limits

The limit describes what **f(x)** approaches as x gets close to a value — not what f(a) *is*.

## Key results
- lim (sin x / x) = 1 as x → 0
- lim (xⁿ − aⁿ)/(x − a) = n·aⁿ⁻¹ as x → a
- Direct substitution first; if you get 0/0, factorise or use the identities above.

## Watch out
> If substitution gives k/0 (k ≠ 0), the limit **does not exist**.

- [x] Revise the factorisation tricks
- [ ] Solve exercise 3 from the book
- [ ] Ask about limits at infinity`;

const ARABIC_NOTES = `# الحال

الحال: اسم نكرة منصوب يبيّن هيئة صاحبه وقت وقوع الفعل.

## أنواع الحال
- **مفردة**: جاء الطالبُ مسرورًا.
- **جملة**: جاء الطالبُ وهو يبتسم.
- **شبه جملة**: رأيت الهلالَ بين السحاب.

> ملاحظة: صاحب الحال يكون معرفة غالبًا.`;

export function seedDemo({ create, settings }: { create: Create; settings: Record<string, unknown> }) {
  const d = (n: number) => toDateStr(addDays(new Date(), n));
  const ago = (days: number, h = 17, m = 0) => {
    const x = addDays(new Date(), -days);
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };

  const tree: [string, string, string, [string, string[]][]][] = [
    ["Math", "📐", "sky", [["Calculus", ["Limits", "Derivatives", "Applications of derivatives"]], ["Algebra", ["Permutations", "Binomial theorem", "Complex numbers"]], ["Statics", ["Friction", "Moments"]]]],
    ["Physics", "⚛️", "lilac", [["Electric current", ["Ohm's law", "Kirchhoff's laws"]], ["Electromagnetism", ["Magnetic field of a wire", "Electromagnetic induction"]], ["Modern physics", ["Photoelectric effect"]]]],
    ["Chemistry", "🧪", "mint", [["Transition elements", ["Iron", "General properties"]], ["Chemical analysis", ["Qualitative analysis", "Quantitative analysis"]], ["Organic chemistry", ["Alkanes", "Alcohols"]]]],
    ["Arabic", "📜", "butter", [["النحو", ["الحال", "التمييز"]], ["البلاغة", ["التشبيه", "الاستعارة"]]]],
    ["English", "🔤", "peach", [["Grammar", ["Conditionals", "Passive voice"]], ["The novel", ["Chapters 1–5"]], ["Vocabulary", ["Unit 1", "Unit 2"]]]],
  ];

  const subjects: Record<string, string> = {};
  const lessons: Record<string, { id: string; subject: string }> = {};
  const statuses = ["done", "revised", "in_progress", "not_started"];
  tree.forEach(([name, icon, color, chapters], si) => {
    const s = create("subject", { name, icon, color, position: si });
    subjects[name] = s.id;
    chapters.forEach(([ch, ls], ci) => {
      const c = create("chapter", { subject_id: s.id, name: ch, position: ci, status: statuses[(si + ci) % 3] });
      ls.forEach((l, li) => {
        const notes = l === "Limits" ? LIMITS_NOTES : l === "الحال" ? ARABIC_NOTES : null;
        const lesson = create("lesson", { chapter_id: c.id, name: l, position: li, status: statuses[(si + ci + li) % 4], notes });
        lessons[l] = { id: lesson.id, subject: name };
      });
    });
  });

  const exams: Record<string, string> = {};
  const past: [string, string, string, number, number, number][] = [
    ["Math quiz 1", "Math", "quiz", 52, 17, 20],
    ["Physics quiz 1", "Physics", "quiz", 48, 12, 15],
    ["Chemistry trial 1", "Chemistry", "trial", 41, 46, 60],
    ["Math trial 1", "Math", "trial", 34, 44, 60],
    ["English quiz 1", "English", "quiz", 30, 18, 20],
    ["Physics trial 1", "Physics", "trial", 26, 41, 60],
    ["Arabic quiz 1", "Arabic", "quiz", 21, 32, 40],
    ["Chemistry quiz 2", "Chemistry", "quiz", 16, 18, 20],
    ["Math quiz 2", "Math", "quiz", 12, 19, 20],
    ["Physics trial 2", "Physics", "trial", 8, 50, 60],
    ["English trial 1", "English", "trial", 5, 47, 50],
    ["Math trial 2", "Math", "trial", 3, 53, 60],
  ];
  for (const [title, subj, kind, days, score, max] of past)
    exams[title] = create("exam", { title, kind, subject_id: subjects[subj], date: d(-days), time: "10:00", score, max_score: max }).id;
  const upcoming: [string, string, string, number, string | null, string][] = [
    ["Chemistry quiz 3", "Chemistry", "quiz", 1, "17:30", "Transition elements — iron & its oxides"],
    ["Physics trial 3", "Physics", "trial", 3, "09:00", "Electric current + electromagnetism"],
    ["Arabic quiz 2", "Arabic", "quiz", 6, null, "الحال والتمييز"],
    ["Math trial 3", "Math", "trial", 9, "10:00", "Calculus: limits & derivatives"],
    ["English quiz 2", "English", "quiz", 15, "12:00", "Conditionals"],
  ];
  for (const [title, subj, kind, days, time, scope] of upcoming)
    exams[title] = create("exam", { title, kind, subject_id: subjects[subj], date: d(days), time, scope }).id;

  const mistakes: [string, string, string, string, string, string, string, number][] = [
    ["Limits", "sin 3x / x as x→0", "Find lim (sin 3x)/x as x → 0", "1", "3", "Multiply and divide by 3: (sin 3x)/(3x) · 3 → 1 · 3.", "concept", 0],
    ["Limits", "0/0 with roots", "Find lim (√(x+4) − 2)/x as x → 0", "0", "1/4", "Multiply by the conjugate (√(x+4) + 2).", "calculation", -1],
    ["Derivatives", "Chain rule sign", "Differentiate y = cos²(3x)", "−6 cos 3x sin 3x", "−3 sin 6x", "Both are equal — but the book expects the simplified double-angle form.", "careless", 0],
    ["Binomial theorem", "Middle term", "Find the middle term in (2x − 1/x)¹⁰", "T₅", "T₆", "For n = 10 there are 11 terms, so the middle term is T₆.", "misread", 2],
    ["Kirchhoff's laws", "Loop direction", "Find I₂ in the circuit (see figure)", "0.4 A", "−0.4 A (opposite direction)", "Keep one loop direction consistently; a negative answer just means the opposite direction.", "concept", 0],
    ["Ohm's law", "Internal resistance", "A battery of emf 12 V and r = 1 Ω feeds 5 Ω. Find V across the terminals.", "12 V", "10 V", "V = ε − Ir, with I = ε/(R + r) = 2 A.", "concept", -2],
    ["Electromagnetic induction", "Lenz's law", "Direction of the induced current when the magnet moves away", "Clockwise", "Anticlockwise", "The induced current opposes the change — it tries to attract the receding magnet.", "concept", 1],
    ["Iron", "Oxide colours", "Colour of Fe₂O₃", "Black", "Reddish-brown", "FeO and Fe₃O₄ are black; Fe₂O₃ is reddish-brown.", "memory", 0],
    ["Qualitative analysis", "Test for Fe³⁺", "Which reagent gives a reddish-brown precipitate with Fe³⁺?", "Ammonia only", "NaOH (or NH₄OH)", "Fe(OH)₃ precipitates with any hydroxide source.", "memory", 4],
    ["Alcohols", "Oxidation products", "Product of oxidising a secondary alcohol", "Aldehyde", "Ketone", "Primary → aldehyde → acid. Secondary → ketone.", "concept", 0],
    ["الحال", "صاحب الحال", "أعرب «مسرعًا» في: أقبل الفارسُ مسرعًا", "تمييز منصوب", "حال منصوبة", "تبين هيئة الفارس وقت الإقبال، فهي حال.", "concept", 0],
    ["Conditionals", "Third conditional", "If I ___ (study) harder, I would have passed.", "studied", "had studied", "Past unreal → If + past perfect, would have + p.p.", "careless", -3],
    ["Passive voice", "Modal passive", "They must finish the project → The project ___", "must finished", "must be finished", "Modal + be + past participle.", "careless", 6],
  ];
  mistakes.forEach(([lesson, title, question, my, correct, explanation, kind, due], i) => {
    const l = lessons[lesson];
    const status = i % 5 === 4 ? "mastered" : i % 3 === 0 ? "open" : "reviewing";
    create("mistake", {
      lesson_id: l.id,
      title,
      question,
      my_answer: my,
      correct_answer: correct,
      explanation,
      kind,
      status,
      review_count: status === "open" ? 0 : status === "mastered" ? 4 : 1 + (i % 2),
      next_review_at: d(due),
      source: i % 2 ? "School book" : "El-Moasser",
      exam_id: i === 4 ? exams["Physics trial 2"] : null,
    });
  });

  const tasks: [string, number | null, string, number | null, boolean, string | null, string?][] = [
    ["Solve 20 limits questions", 0, "high", 50, true, "Limits"],
    ["Review Kirchhoff's mistakes", 0, "high", 30, false, "Kirchhoff's laws"],
    ["Memorise iron oxide colours", 0, "medium", 20, false, "Iron"],
    ["Read novel chapter 4", 0, "low", 25, false, "Chapters 1–5"],
    ["Prepare for chemistry quiz", 0, "medium", 45, false, null, "Chemistry"],
    ["Derivatives exercise set B", 1, "medium", 40, false, "Derivatives"],
    ["Physics trial — past paper 2023", 2, "high", 120, false, null, "Physics"],
    ["Arabic: التمييز summary", 4, "low", 30, false, "التمييز"],
    ["Finish binomial homework", -1, "medium", 30, false, "Binomial theorem"],
    ["Daily vocabulary (10 words)", 0, "none", 10, false, "Unit 1"],
  ];
  tasks.forEach(([title, due, priority, est, done, lesson, subj], i) => {
    create("task", {
      title,
      due_date: due === null ? null : d(due),
      priority,
      estimate_min: est,
      done,
      repeat: title.startsWith("Daily") ? "daily" : "none",
      lesson_id: lesson ? lessons[lesson].id : null,
      subject_id: subj ? subjects[subj] : undefined,
      position: i,
    });
  });
  create("task", { title: "Organise trial papers folder", done: true, due_date: d(-2), priority: "none" });

  const names = Object.keys(subjects);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let day = 34; day >= 1; day--) {
    const n = day % 7 === 6 ? 0 : 1 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      const len = [25, 25, 50, 45, 30][Math.floor(rnd() * 5)] * 60;
      const start = ago(day, 15 + k * 1, Math.floor(rnd() * 50));
      create("focus_session", {
        started_at: start,
        ended_at: new Date(new Date(start).getTime() + len * 1000).toISOString(),
        duration_sec: len,
        mode: len === 3000 ? "flow" : "pomodoro",
        subject_id: subjects[names[Math.floor(rnd() * names.length)]],
      });
    }
  }
  const morning = new Date();
  morning.setHours(Math.max(0, morning.getHours() - 3), 0, 0, 0);
  create("focus_session", { started_at: morning.toISOString(), duration_sec: 1500, mode: "pomodoro", subject_id: subjects.Math });
  create("focus_session", { started_at: new Date(morning.getTime() + 1800_000).toISOString(), duration_sec: 1500, mode: "pomodoro", subject_id: subjects.Physics });

  settings["seeded"] = true;
}
