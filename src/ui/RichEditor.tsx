import { mergeAttributes } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { backend } from "@/lib/backend";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Image node that stores the raw path (attachments/x.png) but displays a resolvable URL. */
const YexImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src ? backend().fileUrl(HTMLAttributes.src) : undefined;
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src, "data-src": HTMLAttributes.src })];
  },
}).configure({ allowBase64: true });

async function storeImage(file: File) {
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg").replace("svg+xml", "svg");
  return backend().saveAttachment(new Uint8Array(await file.arrayBuffer()), ext);
}

export interface RichEditorProps {
  value: string | null | undefined;
  onChange: (markdown: string) => void;
  placeholder?: string;
  compact?: boolean;
  autofocus?: boolean;
  className?: string;
  /** ms to debounce change events (notes autosave). 0 = every keystroke. */
  debounce?: number;
  onSubmit?: () => void;
}

export function RichEditor({ value, onChange, placeholder = "Write something…", compact, autofocus, className, debounce = 400, onSubmit }: RichEditorProps) {
  const timer = useRef<number>(0);
  const latest = useRef(value ?? "");
  const lastProp = useRef(value ?? "");
  // Until the user interacts, updates are only schema normalization: track them as the baseline, never save.
  const touched = useRef(false);
  const cb = useRef({ onChange, onSubmit });
  cb.current = { onChange, onSubmit };

  const flush = (md: string) => {
    clearTimeout(timer.current);
    if (!touched.current) return void (latest.current = md);
    if (md !== latest.current) {
      latest.current = md;
      cb.current.onChange(md);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true }, heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      YexImage,
      Markdown,
    ],
    content: value ?? "",
    contentType: "markdown",
    textDirection: "auto",
    autofocus: autofocus ? "end" : false,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: cn("prose-yex selectable", compact && "compact") },
      handleDOMEvents: { focus: () => void (touched.current = true), mousedown: () => void (touched.current = true) },
      handleKeyDown: (_view, e) => {
        touched.current = true;
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && cb.current.onSubmit) {
          cb.current.onSubmit();
          return true;
        }
        return false;
      },
      handlePaste: (view, e) => {
        touched.current = true;
        const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        e.preventDefault();
        files.forEach((f) =>
          storeImage(f)
            .then((src) => view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src }))))
            .catch((err) => toast(`Couldn't save image: ${err}`, { tone: "danger" })),
        );
        return true;
      },
      handleDrop: (view, e) => {
        touched.current = true;
        const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        e.preventDefault();
        const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos ?? view.state.selection.from;
        files.forEach((f) => storeImage(f).then((src) => view.dispatch(view.state.tr.insert(pos, view.state.schema.nodes.image.create({ src })))));
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      clearTimeout(timer.current);
      const run = () => flush(editor.getMarkdown());
      if (debounce) timer.current = window.setTimeout(run, debounce);
      else run();
    },
    onBlur: ({ editor }) => flush(editor.getMarkdown()),
    // Baseline is the editor's normalized markdown so merely opening a doc never triggers a save.
    onCreate: ({ editor }) => void (latest.current = editor.getMarkdown()),
  });

  // Flush pending edits when unmounting (e.g. navigating away mid-typing).
  useEffect(() => () => {
    if (editor && !editor.isDestroyed) flush(editor.getMarkdown());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Accept external updates (another window, an AI agent via MCP) when not focused.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = value ?? "";
    if (next === lastProp.current) return;
    lastProp.current = next;
    if (next !== latest.current) {
      editor.commands.setContent(next, { contentType: "markdown", emitUpdate: false });
      latest.current = editor.getMarkdown();
    }
  }, [value, editor]);

  return <EditorContent editor={editor} className={cn("cursor-text", className)} onClick={() => editor?.isEmpty && editor.commands.focus()} />;
}
