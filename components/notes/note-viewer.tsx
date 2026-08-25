"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import type { Note } from "@/lib/notes";

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function NoteViewer({ note }: { note: Note }) {
  const [ready, setReady] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [StarterKit],
    content: `<p>${escapeHtml(note.title)}</p>`,
    editorProps: {
      attributes: {
        class: "tiptap-editor note-viewer-editor",
      },
    },
  });

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || !editor) {
    return (
      <p className="text-muted-foreground text-lg leading-relaxed">
        {note.title}
      </p>
    );
  }

  return <EditorContent editor={editor} />;
}
