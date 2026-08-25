"use server";

import { createClient } from "@/lib/supabase/server";
import { noteViewerPath, type Note } from "@/lib/notes";

export async function shareNote(noteId: number, email: string) {
  const trimmedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .select("id, title, slug")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    return { error: "That note could not be found." };
  }

  const { error: shareError } = await supabase.from("note_shares").insert({
    note_id: noteId,
    email: trimmedEmail,
  });

  if (shareError && shareError.code !== "23505") {
    return { error: shareError.message };
  }

  return {
    email: trimmedEmail,
    path: noteViewerPath(note as Note),
  };
}
