import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/features/dashboard/overview";

export const Route = createFileRoute("/dashboard/")({ component: OverviewPage });
