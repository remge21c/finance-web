import { NextResponse, type NextRequest } from "next/server";
import { runBackup } from "@/lib/google/backup";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runBackup({
    trigger: "cron",
    triggeredBy: null,
  });

  return NextResponse.json({ ok: !summary.fatalError, ...summary });
}
