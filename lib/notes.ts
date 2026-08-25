export type Note = {
  id: number;
  title: string;
  slug: string;
};

export function noteViewerPath(note: Pick<Note, "slug">) {
  return `/n/${note.slug}`;
}
