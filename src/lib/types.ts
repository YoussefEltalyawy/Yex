export type Id = string;

export interface Row {
  id: Id;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type SubjectColor = "sky" | "mint" | "butter" | "peach" | "lilac" | "rose" | "sand" | "teal";
export const SUBJECT_COLORS: SubjectColor[] = ["sky", "mint", "butter", "peach", "lilac", "rose", "sand", "teal"];
export type Progress = "not_started" | "in_progress" | "done" | "revised";

export interface Subject extends Row {
  name: string;
  icon: string;
  color: SubjectColor;
  position: number;
  archived: boolean;
}

export interface Chapter extends Row {
  subject_id: Id;
  name: string;
  position: number;
  status: Progress;
}

export interface Lesson extends Row {
  chapter_id: Id;
  subject_id: Id | null;
  name: string;
  position: number;
  status: Progress;
  notes: string | null;
  notes_updated_at: string | null;
}

export type MistakeKind = "concept" | "careless" | "calculation" | "misread" | "memory" | "time" | "other";
export type MistakeStatus = "open" | "reviewing" | "mastered";

export interface Mistake extends Row {
  title: string | null;
  question: string;
  my_answer: string | null;
  correct_answer: string | null;
  explanation: string | null;
  lesson_id: Id | null;
  chapter_id: Id | null;
  subject_id: Id | null;
  exam_id: Id | null;
  source: string | null;
  kind: MistakeKind;
  status: MistakeStatus;
  review_count: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  tags: string[];
}

export type Priority = "none" | "low" | "medium" | "high";
export type Repeat = "none" | "daily" | "weekdays" | "weekly";

export interface Task extends Row {
  title: string;
  notes: string | null;
  priority: Priority;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  estimate_min: number | null;
  repeat: Repeat;
  subject_id: Id | null;
  lesson_id: Id | null;
  exam_id: Id | null;
  position: number;
}

export type ExamKind = "quiz" | "trial" | "exam" | "homework" | "other";
export type ExamStatus = "upcoming" | "done" | "missed" | "cancelled";

export interface Exam extends Row {
  title: string;
  kind: ExamKind;
  subject_id: Id | null;
  chapter_id: Id | null;
  scope: string | null;
  date: string;
  time: string | null;
  status: ExamStatus;
  score: number | null;
  max_score: number | null;
  notes: string | null;
  remind: boolean;
}

export type TimerMode = "pomodoro" | "countdown" | "stopwatch" | "flow";

export interface FocusSession extends Row {
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  mode: TimerMode;
  kind: "focus" | "break";
  task_id: Id | null;
  subject_id: Id | null;
  completed: boolean;
  note: string | null;
}

export interface EntityMap {
  subject: Subject;
  chapter: Chapter;
  lesson: Lesson;
  mistake: Mistake;
  task: Task;
  exam: Exam;
  focus_session: FocusSession;
}
export type EntityName = keyof EntityMap;

export type FilterOp = { eq?: unknown; ne?: unknown; lt?: unknown; lte?: unknown; gt?: unknown; gte?: unknown; in?: unknown[]; like?: string; is_null?: boolean };
export interface ListQuery {
  filter?: Record<string, unknown | FilterOp | null>;
  order_by?: string;
  limit?: number;
  offset?: number;
  include_deleted?: boolean;
  search?: string;
}

export interface Overview {
  today: string;
  tasks_today: Task[];
  overdue_tasks: Task[];
  upcoming_exams: Exam[];
  mistakes_due_for_review: Mistake[];
  focus_minutes_today: number;
  focus_minutes_last_7_days: number;
}

export interface AppInfo {
  version: string;
  data_dir: string;
  db_path: string;
  mcp_path: string | null;
  mcp_expected_path: string | null;
}

export type ReviewGrade = "again" | "hard" | "good" | "easy";
