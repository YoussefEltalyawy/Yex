import { create } from "zustand";

export interface Route {
  name: string;
  params: Record<string, string>;
}

export type ThemePref = "system" | "light" | "dark";

function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, "");
  const [name, qs] = raw.split("?");
  return { name: name || "home", params: Object.fromEntries(new URLSearchParams(qs ?? "")) };
}

const toHash = (r: Route) => {
  const qs = new URLSearchParams(r.params).toString();
  return `#/${r.name}${qs ? `?${qs}` : ""}`;
};

interface AppState {
  route: Route;
  back: Route[];
  forward: Route[];
  navigate: (name: string, params?: Record<string, string>, opts?: { replace?: boolean }) => void;
  goBack: () => void;
  goForward: () => void;
  theme: ThemePref;
  dark: boolean;
  setTheme: (t: ThemePref) => void;
  /** Force dark caption buttons (e.g. dark focus scenes). */
  chromeDark: boolean;
  /** Global "log a mistake" dialog; lessonId preselects the lesson. */
  mistakeDialog: { lessonId?: string } | null;
  paletteOpen: boolean;
  setPalette: (open: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  expanded: Record<string, boolean>;
  toggleExpanded: (id: string, value?: boolean) => void;
}

const media = window.matchMedia("(prefers-color-scheme: dark)");
const storedTheme = (localStorage.getItem("yex-theme") as ThemePref) || "system";
const resolve = (t: ThemePref) => (t === "system" ? media.matches : t === "dark");

export const useApp = create<AppState>((set, get) => ({
  route: parseHash(),
  back: [],
  forward: [],
  navigate(name, params = {}, opts) {
    const cur = get().route;
    const next = { name, params };
    if (toHash(cur) === toHash(next)) return;
    history.replaceState(null, "", toHash(next));
    set(opts?.replace ? { route: next } : { route: next, back: [...get().back.slice(-50), cur], forward: [] });
  },
  goBack() {
    const { back, route, forward } = get();
    const prev = back.at(-1);
    if (!prev) return;
    history.replaceState(null, "", toHash(prev));
    set({ route: prev, back: back.slice(0, -1), forward: [route, ...forward] });
  },
  goForward() {
    const { back, route, forward } = get();
    const [next, ...rest] = forward;
    if (!next) return;
    history.replaceState(null, "", toHash(next));
    set({ route: next, back: [...back, route], forward: rest });
  },
  theme: storedTheme,
  dark: resolve(storedTheme),
  setTheme(theme) {
    localStorage.setItem("yex-theme", theme);
    set({ theme, dark: resolve(theme) });
  },
  chromeDark: false,
  mistakeDialog: null,
  paletteOpen: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
  sidebarCollapsed: localStorage.getItem("yex-sidebar") === "collapsed",
  toggleSidebar() {
    const v = !get().sidebarCollapsed;
    localStorage.setItem("yex-sidebar", v ? "collapsed" : "open");
    set({ sidebarCollapsed: v });
  },
  expanded: JSON.parse(localStorage.getItem("yex-expanded") ?? "{}"),
  toggleExpanded(id, value) {
    const expanded = { ...get().expanded, [id]: value ?? !get().expanded[id] };
    localStorage.setItem("yex-expanded", JSON.stringify(expanded));
    set({ expanded });
  },
}));

media.addEventListener("change", () => useApp.setState((s) => ({ dark: resolve(s.theme) })));
window.addEventListener("hashchange", () => {
  const r = parseHash();
  if (toHash(r) !== toHash(useApp.getState().route)) useApp.getState().navigate(r.name, r.params);
});

export const navigate = (name: string, params?: Record<string, string>) => useApp.getState().navigate(name, params);
