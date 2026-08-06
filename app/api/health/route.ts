import { NextResponse } from "next/server";

// Process liveness only (Layer 3 of the harness readiness model) — no
// Supabase call here on purpose, so this stays fast and independent of the
// shared Supabase stack. See .har/readiness.sh for the Supabase-aware smoke
// test that runs in `verify --full`.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
