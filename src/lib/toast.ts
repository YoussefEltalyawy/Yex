import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone?: "default" | "danger" | "success";
  action?: { label: string; run: () => void };
}

export const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));

let n = 0;
export function toast(message: string, opts: Omit<Toast, "id" | "message"> = {}) {
  const id = ++n;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, message, ...opts }] }));
  setTimeout(() => dismiss(id), opts.action ? 6000 : 3500);
}

export const dismiss = (id: number) => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));
