import { Analytics01Icon, Calendar03Icon, CheckListIcon, Home01Icon, Timer02Icon, Brain02Icon } from "@hugeicons/core-free-icons";
import { lazy } from "react";
import type { Command, ModuleDef, NavItem } from "./types";
import { navigate, useApp } from "@/lib/store";
import { timer } from "./focus/timer";

const home: ModuleDef = {
  id: "home",
  pages: { home: lazy(() => import("./home/HomePage")) },
  nav: [{ label: "Home", icon: Home01Icon, route: "home", order: 0, shortcut: "Ctrl+1" }],
};

const focus: ModuleDef = {
  id: "focus",
  pages: { focus: lazy(() => import("./focus/FocusPage")) },
  nav: [{ label: "Focus", icon: Timer02Icon, route: "focus", order: 1, shortcut: "Ctrl+2" }],
  commands: [
    { id: "focus.toggle", label: "Start / pause focus timer", group: "Focus", icon: Timer02Icon, hint: "Ctrl+Shift+Space", run: () => timer.toggle() },
    { id: "focus.finish", label: "Finish focus session & log time", group: "Focus", icon: Timer02Icon, run: () => timer.finish() },
  ],
};

const tasks: ModuleDef = {
  id: "tasks",
  pages: { tasks: lazy(() => import("./tasks/TasksPage")) },
  nav: [{ label: "Tasks", icon: CheckListIcon, route: "tasks", order: 2, shortcut: "Ctrl+3" }],
  commands: [{ id: "tasks.new", label: "New task", group: "Create", icon: CheckListIcon, hint: "Ctrl+N", run: () => navigate("tasks", { new: "1" }) }],
};

const exams: ModuleDef = {
  id: "exams",
  pages: { exams: lazy(() => import("./exams/ExamsPage")) },
  nav: [{ label: "Exams", icon: Calendar03Icon, route: "exams", order: 3, shortcut: "Ctrl+4" }],
  commands: [{ id: "exams.new", label: "New quiz / trial", group: "Create", icon: Calendar03Icon, run: () => navigate("exams", { new: "1" }) }],
};

const study: ModuleDef = {
  id: "study",
  pages: {
    subject: lazy(() => import("./study/SubjectPage")),
    lesson: lazy(() => import("./study/LessonPage")),
    review: lazy(() => import("./study/ReviewPage")),
  },
  nav: [{ label: "Review", icon: Brain02Icon, route: "review", order: 4, shortcut: "Ctrl+5" }],
  commands: [{ id: "study.review", label: "Review due mistakes", group: "Study", icon: Brain02Icon, run: () => navigate("review") }],
};

const analytics: ModuleDef = {
  id: "analytics",
  pages: { analytics: lazy(() => import("./analytics/AnalyticsPage")) },
  nav: [{ label: "Analytics", icon: Analytics01Icon, route: "analytics", order: 5, shortcut: "Ctrl+6" }],
};

const settings: ModuleDef = {
  id: "settings",
  pages: { settings: lazy(() => import("./settings/SettingsPage")) },
  commands: [
    { id: "settings.open", label: "Open settings", group: "App", run: () => navigate("settings") },
    { id: "settings.agents", label: "Connect an AI agent (MCP)", group: "App", keywords: "mcp claude cursor api", run: () => navigate("settings", { section: "agents" }) },
    {
      id: "theme.toggle",
      label: "Toggle light / dark theme",
      group: "App",
      run: () => useApp.getState().setTheme(useApp.getState().dark ? "light" : "dark"),
    },
  ],
};

/** Order here = order in the app. Add new modules (gym, library, …) to this list. */
export const modules: ModuleDef[] = [home, focus, tasks, exams, study, analytics, settings];

export const pages = Object.assign({}, ...modules.map((m) => m.pages)) as ModuleDef["pages"];
export const navItems: NavItem[] = modules.flatMap((m) => m.nav ?? []).sort((a, b) => a.order - b.order);
export const commands: Command[] = [
  ...navItems.map((n) => ({ id: `nav.${n.route}`, label: `Go to ${n.label}`, group: "Navigate", icon: n.icon, hint: n.shortcut, run: () => navigate(n.route) })),
  ...modules.flatMap((m) => m.commands ?? []),
];
