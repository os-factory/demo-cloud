import { createClient } from "@/lib/supabase/server";
import { NotesPreview } from "@/components/notes/notes-preview";
import type { Note } from "@/lib/notes";

export default async function NotesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, slug");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-2xl">Notes</h1>
        <p className="text-sm text-muted-foreground">
          These rows come from the Supabase <code>notes</code> table. Select one
          (or all of them) to preview the content in TipTap.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">
          Could not load notes: {error.message}
        </p>
      ) : (
        <NotesPreview notes={(data ?? []) as Note[]} />
      )}
    </div>
  );
}
