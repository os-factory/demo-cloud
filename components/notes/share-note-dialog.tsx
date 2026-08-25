"use client";

import { useState } from "react";

import { shareNote } from "@/app/notes/actions";
import type { Note } from "@/lib/notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ShareNoteDialog({
  note,
  onClose,
}: {
  note: Note;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSharing(true);
    setError(null);

    const result = await shareNote(note.id, email);

    if ("error" in result && result.error) {
      setError(result.error);
      setIsSharing(false);
      return;
    }

    if ("path" in result && result.path) {
      setShareUrl(`${window.location.origin}${result.path}`);
    }

    setIsSharing(false);
  }

  async function copyLink() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div
        role="dialog"
        aria-labelledby="share-note-title"
        className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg"
      >
        <h2 id="share-note-title" className="text-lg font-semibold">
          Share note
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a private viewer link to someone. Only they will be able to open
          it.
        </p>

        {shareUrl ? (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm">
              Shared with <span className="font-medium">{email.trim()}</span>.
            </p>
            <Input readOnly value={shareUrl} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Done
              </Button>
              <Button type="button" onClick={copyLink}>
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        ) : (
          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="share-email">Email</Label>
              <Input
                id="share-email"
                type="email"
                required
                placeholder="alex@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSharing}>
                {isSharing ? "Sharing…" : "Share"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
