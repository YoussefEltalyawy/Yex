import { Marked, type Tokens } from "marked";
import { memo, useMemo } from "react";
import { backend } from "@/lib/backend";
import { cn } from "@/lib/utils";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const safeHref = (h: string) => (/^(https?:|mailto:|#)/i.test(h) ? h : "#");

const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    // Raw HTML is shown as text: notes may come from AI agents, never trust markup.
    html: ({ text }: Tokens.HTML | Tokens.Tag) => esc(text),
    link({ href, title, tokens }: Tokens.Link) {
      return `<a href="${esc(safeHref(href))}" target="_blank" rel="noreferrer"${title ? ` title="${esc(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`;
    },
    image({ href, text }: Tokens.Image) {
      return `<img src="${esc(backend().fileUrl(href))}" alt="${esc(text)}" loading="lazy" />`;
    },
  },
});

export function renderMarkdown(src: string) {
  return (md.parse(src) as string).replace(/<(p|li|h[1-6]|blockquote|td|th)>/g, '<$1 dir="auto">');
}

export const Markdown = memo(function Markdown({ source, className, compact = true }: { source: string | null | undefined; className?: string; compact?: boolean }) {
  const html = useMemo(() => renderMarkdown(source ?? ""), [source]);
  return <div className={cn("prose-yex selectable", compact && "compact", className)} dangerouslySetInnerHTML={{ __html: html }} />;
});
