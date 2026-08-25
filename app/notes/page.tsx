import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { NotesPreview } from "@/components/notes/notes-preview";
import type { Note } from "@/lib/notes";

export default function NotesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl">Notes</h1>
        <p className="text-sm text-muted-foreground">
          These rows come from the Supabase <code>notes</code> table. Select one
          (or all of them) to preview the content in TipTap.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading notes…</p>}>
        <NotesFromSupabase />
      </Suspense>
    </div>
  );
}

async function NotesFromSupabase() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notes").select("id, title");

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load notes: {error.message}
      </p>
    );
  }

  return <NotesPreview notes={(data ?? []) as Note[]} />;
}
