import { NextResponse } from "next/server";

export function authErrorRedirect(request: Request, error: string, platform?: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("auth_error", error);
  if (platform) url.searchParams.set("platform", platform);
  return NextResponse.redirect(url);
}
