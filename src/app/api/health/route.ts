import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "modsentry",
    timestamp: new Date().toISOString(),
  });
}
