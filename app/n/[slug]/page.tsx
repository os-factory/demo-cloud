import { Suspense } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { NoteViewer } from "@/components/notes/note-viewer";
import type { Note } from "@/lib/notes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("title")
    .eq("slug", slug)
    .single();

  return {
    title: data?.title ?? "Shared note",
  };
}

export default function SharedNotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading note…</p>
        </main>
      }
    >
      <SharedNote params={params} />
    </Suspense>
  );
}

async function SharedNote({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, slug")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    notFound();
  }

  const note = data as Note;

  return (
    <article className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Shared note
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">
          {note.title}
        </h1>
        <div className="mt-10 rounded-2xl border bg-card/60 px-2 py-4 shadow-sm">
          <NoteViewer note={note} />
        </div>
      </div>
    </article>
  );
}
