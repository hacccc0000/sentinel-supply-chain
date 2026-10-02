import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardShell } from "@/components/shell";
import { getMe } from "@/lib/server/api";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const s = await getMe();
    if (!s.user) throw redirect({ to: "/login" });
  },
  head: () => ({ meta: [{ title: "Dashboard — BuildBouncer" }] }),
  component: DashboardShell,
});
