"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

import type { Note } from "@/lib/notes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function notesToHtml(notes: Note[]) {
  if (notes.length === 0) {
    return "<p></p>";
  }

  return notes
    .map((note) => `<p>${escapeHtml(note.title)}</p>`)
    .join("");
}

export function NotesPreview({ notes }: { notes: Note[] }) {
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<number | "all">("all");
  const visibleNotes =
    selectedId === "all"
      ? notes
      : notes.filter((note) => note.id === selectedId);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Select a note to preview it here.",
      }),
    ],
    content: notesToHtml(visibleNotes),
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
  });

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.commands.setContent(notesToHtml(visibleNotes));
  }, [editor, selectedId, notes]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="flex flex-col gap-3 lg:w-64 shrink-0">
        <p className="text-sm font-medium text-muted-foreground">Notes</p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant={selectedId === "all" ? "default" : "outline"}
            className="justify-start"
            onClick={() => setSelectedId("all")}
          >
            All notes
          </Button>
          {notes.map((note) => (
            <Button
              key={note.id}
              type="button"
              variant={selectedId === note.id ? "default" : "outline"}
              className="justify-start h-auto whitespace-normal text-left"
              onClick={() => setSelectedId(note.id)}
            >
              {note.title}
            </Button>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 rounded-xl border bg-card shadow-sm overflow-hidden">
        {ready && editor ? (
          <>
            <div className="flex items-center gap-1 border-b px-2 py-2">
              <ToolbarButton
                label="Bold"
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <Bold />
              </ToolbarButton>
              <ToolbarButton
                label="Italic"
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <Italic />
              </ToolbarButton>
              <ToolbarButton
                label="Bullet list"
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <List />
              </ToolbarButton>
              <ToolbarButton
                label="Numbered list"
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered />
              </ToolbarButton>
              <span className="ml-auto text-xs text-muted-foreground px-2">
                TipTap preview
              </span>
            </div>
            <EditorContent editor={editor} />
          </>
        ) : (
          <p className="tiptap-editor text-muted-foreground">Loading editor…</p>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      onClick={onClick}
      className={cn(active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}
