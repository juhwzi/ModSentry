import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/cookies";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/?auth_error=AUTH_REQUIRED");

  return children;
}
