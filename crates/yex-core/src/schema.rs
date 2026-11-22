//! Declarative entity registry. Adding a module = adding entities here.
//! Tables and columns are created/extended automatically on startup.
use serde::Serialize;

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Text,
    LongText,
    Int,
    Real,
    Bool,
    Date,
    DateTime,
    Json,
    Ref,
}

impl Kind {
    pub fn sql_type(self) -> &'static str {
        match self {
            Kind::Int | Kind::Bool => "INTEGER",
            Kind::Real => "REAL",
            _ => "TEXT",
        }
    }
}

#[derive(Serialize, Clone, Copy, Debug)]
pub struct Field {
    pub name: &'static str,
    pub kind: Kind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refs: Option<&'static str>,
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    pub options: &'static [&'static str],
    pub required: bool,
    /// JSON literal used as the SQL default.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<&'static str>,
    /// Soft-deleting the referenced row also deletes this row.
    #[serde(skip_serializing_if = "is_false")]
    pub cascade: bool,
    pub doc: &'static str,
}

fn is_false(b: &bool) -> bool {
    !*b
}

const fn f(name: &'static str, kind: Kind, doc: &'static str) -> Field {
    Field { name, kind, refs: None, options: &[], required: false, default: None, cascade: false, doc }
}
const fn text(name: &'static str, doc: &'static str) -> Field {
    f(name, Kind::Text, doc)
}
const fn long(name: &'static str, doc: &'static str) -> Field {
    f(name, Kind::LongText, doc)
}
const fn int(name: &'static str, doc: &'static str) -> Field {
    f(name, Kind::Int, doc)
}
const fn real(name: &'static str, doc: &'static str) -> Field {
    f(name, Kind::Real, doc)
}
const fn boolean(name: &'static str, doc: &'static str) -> Field {
    f(name, Kind::Bool, doc)
}
const fn date(name: &'static str, doc: &'static str) -> Field {
    f(name, Kind::Date, doc)
}
const fn datetime(name: &'static str, doc: &'static str) -> Field {
    f(name, Kind::DateTime, doc)
}
const fn json(name: &'static str, doc: &'static str) -> Field {
    f(name, Kind::Json, doc)
}
const fn reference(name: &'static str, entity: &'static str, doc: &'static str) -> Field {
    let mut x = f(name, Kind::Ref, doc);
    x.refs = Some(entity);
    x
}

impl Field {
    const fn req(mut self) -> Self {
        self.required = true;
        self
    }
    const fn opts(mut self, o: &'static [&'static str]) -> Self {
        self.options = o;
        self
    }
    const fn def(mut self, d: &'static str) -> Self {
        self.default = Some(d);
        self
    }
    const fn cascade(mut self) -> Self {
        self.cascade = true;
        self
    }
}

/// Fill `target` from `via` row's `source` column when `target` is not provided.
#[derive(Serialize, Clone, Copy, Debug)]
pub struct Inherit {
    pub target: &'static str,
    pub via: &'static str,
    pub source: &'static str,
}

const fn inh(target: &'static str, via: &'static str, source: &'static str) -> Inherit {
    Inherit { target, via, source }
}

#[derive(Serialize, Debug)]
pub struct Entity {
    pub name: &'static str,
    pub table: &'static str,
    pub module: &'static str,
    pub doc: &'static str,
    pub title_field: &'static str,
    pub default_order: &'static str,
    pub search: &'static [&'static str],
    pub fields: &'static [Field],
    #[serde(skip_serializing_if = "<[_]>::is_empty")]
    pub inherit: &'static [Inherit],
}

impl Entity {
    pub fn field(&self, name: &str) -> Option<&Field> {
        self.fields.iter().find(|f| f.name == name)
    }
}

pub const SUBJECT_COLORS: &[&str] = &["sky", "mint", "butter", "peach", "lilac", "rose", "sand", "teal"];
pub const PROGRESS: &[&str] = &["not_started", "in_progress", "done", "revised"];

pub static ENTITIES: &[Entity] = &[
    Entity {
        name: "subject",
        table: "subjects",
        module: "study",
        doc: "A school subject (e.g. Math, Physics). Top of the study hierarchy: subject > chapter > lesson.",
        title_field: "name",
        default_order: "position, created_at",
        search: &["name"],
        fields: &[
            text("name", "Display name").req(),
            text("icon", "Single emoji used as the icon").def("\"📘\""),
            text("color", "Pastel color key").opts(SUBJECT_COLORS).def("\"sky\""),
            real("position", "Sort order (ascending)").def("0"),
            boolean("archived", "Hidden from the sidebar").def("false"),
        ],
        inherit: &[],
    },
    Entity {
        name: "chapter",
        table: "chapters",
        module: "study",
        doc: "A chapter / unit inside a subject.",
        title_field: "name",
        default_order: "position, created_at",
        search: &["name"],
        fields: &[
            reference("subject_id", "subject", "Owning subject").req().cascade(),
            text("name", "Chapter name").req(),
            real("position", "Sort order within the subject").def("0"),
            text("status", "Study progress").opts(PROGRESS).def("\"not_started\""),
        ],
        inherit: &[],
    },
    Entity {
        name: "lesson",
        table: "lessons",
        module: "study",
        doc: "A lesson inside a chapter. Each lesson has a Notes page (markdown) and a list of mistakes (wrong-answered questions).",
        title_field: "name",
        default_order: "position, created_at",
        search: &["name", "notes"],
        fields: &[
            reference("chapter_id", "chapter", "Owning chapter").req().cascade(),
            reference("subject_id", "subject", "Owning subject (derived from chapter if omitted)"),
            text("name", "Lesson name").req(),
            real("position", "Sort order within the chapter").def("0"),
            text("status", "Study progress").opts(PROGRESS).def("\"not_started\""),
            long("notes", "Lesson notes as Markdown"),
            datetime("notes_updated_at", "Last time the notes were edited"),
        ],
        inherit: &[inh("subject_id", "chapter_id", "subject_id")],
    },
    Entity {
        name: "mistake",
        table: "mistakes",
        module: "study",
        doc: "A wrong-answered question to learn from, usually attached to a lesson. Supports spaced review (use the review action).",
        title_field: "title",
        default_order: "-created_at",
        search: &["title", "question", "correct_answer", "explanation", "source"],
        fields: &[
            text("title", "Short label for the question"),
            long("question", "The question (Markdown, may contain images)").req(),
            long("my_answer", "What I answered (wrong)"),
            long("correct_answer", "The correct answer"),
            long("explanation", "Why / the key idea to remember (Markdown)"),
            reference("lesson_id", "lesson", "Lesson this question belongs to").cascade(),
            reference("chapter_id", "chapter", "Chapter (derived from lesson if omitted)"),
            reference("subject_id", "subject", "Subject (derived from lesson/chapter if omitted)"),
            reference("exam_id", "exam", "Quiz / trial where the mistake happened"),
            text("source", "Where the question came from (book, teacher, trial...)"),
            text("kind", "Type of mistake")
                .opts(&["concept", "careless", "calculation", "misread", "memory", "time", "other"])
                .def("\"concept\""),
            text("status", "Learning state").opts(&["open", "reviewing", "mastered"]).def("\"open\""),
            int("review_count", "How many times it was reviewed").def("0"),
            datetime("last_reviewed_at", "Last review time"),
            date("next_review_at", "Next spaced-review date (YYYY-MM-DD)"),
            json("tags", "Array of tag strings").def("[]"),
        ],
        inherit: &[
            inh("chapter_id", "lesson_id", "chapter_id"),
            inh("subject_id", "lesson_id", "subject_id"),
            inh("subject_id", "chapter_id", "subject_id"),
        ],
    },
    Entity {
        name: "task",
        table: "tasks",
        module: "tasks",
        doc: "A to-do. Tasks with due_date = today appear on the dashboard. Completing a repeating task creates the next occurrence.",
        title_field: "title",
        default_order: "done, position, created_at",
        search: &["title", "notes"],
        fields: &[
            text("title", "What to do").req(),
            long("notes", "Details (Markdown)"),
            text("priority", "Priority").opts(&["none", "low", "medium", "high"]).def("\"none\""),
            date("due_date", "Day the task is planned for (YYYY-MM-DD)"),
            boolean("done", "Completed").def("false"),
            datetime("done_at", "Completion time (set automatically)"),
            int("estimate_min", "Estimated minutes"),
            text("repeat", "Recurrence").opts(&["none", "daily", "weekdays", "weekly"]).def("\"none\""),
            reference("subject_id", "subject", "Related subject"),
            reference("lesson_id", "lesson", "Related lesson"),
            reference("exam_id", "exam", "Related quiz / trial"),
            real("position", "Manual sort order").def("0"),
        ],
        inherit: &[inh("subject_id", "lesson_id", "subject_id")],
    },
    Entity {
        name: "exam",
        table: "exams",
        module: "exams",
        doc: "A dated assessment: quiz, trial (mock exam), exam or homework. Holds the score once done.",
        title_field: "title",
        default_order: "date, time",
        search: &["title", "scope", "notes"],
        fields: &[
            text("title", "Name, e.g. 'Physics trial 3'").req(),
            text("kind", "Type").opts(&["quiz", "trial", "exam", "homework", "other"]).def("\"quiz\""),
            reference("subject_id", "subject", "Subject"),
            reference("chapter_id", "chapter", "Main chapter covered"),
            text("scope", "What's included (free text)"),
            date("date", "Date (YYYY-MM-DD)").req(),
            text("time", "Time of day HH:MM (24h)"),
            text("status", "State").opts(&["upcoming", "done", "missed", "cancelled"]).def("\"upcoming\""),
            real("score", "Obtained score"),
            real("max_score", "Maximum score"),
            long("notes", "Notes / reflection (Markdown)"),
            boolean("remind", "Send reminders").def("true"),
        ],
        inherit: &[inh("subject_id", "chapter_id", "subject_id")],
    },
    Entity {
        name: "focus_session",
        table: "focus_sessions",
        module: "focus",
        doc: "A logged focus (or break) session from the timer. duration_sec is the actual focused time.",
        title_field: "note",
        default_order: "-started_at",
        search: &["note"],
        fields: &[
            datetime("started_at", "Start time (RFC3339)").req(),
            datetime("ended_at", "End time (RFC3339)"),
            int("duration_sec", "Actual duration in seconds").req(),
            text("mode", "Timer mode").opts(&["pomodoro", "countdown", "stopwatch", "flow"]).def("\"pomodoro\""),
            text("kind", "Session type").opts(&["focus", "break"]).def("\"focus\""),
            reference("task_id", "task", "Task worked on"),
            reference("subject_id", "subject", "Subject (derived from task if omitted)"),
            boolean("completed", "Ran to completion").def("true"),
            text("note", "Optional note"),
        ],
        inherit: &[inh("subject_id", "task_id", "subject_id")],
    },
];

pub fn entity(name: &str) -> crate::Result<&'static Entity> {
    ENTITIES.iter().find(|e| e.name == name).ok_or_else(|| {
        crate::Error::Invalid(format!(
            "unknown entity '{name}'. Known entities: {}",
            ENTITIES.iter().map(|e| e.name).collect::<Vec<_>>().join(", ")
        ))
    })
}

