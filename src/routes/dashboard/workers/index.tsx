import { createFileRoute } from "@tanstack/react-router";
import { WorkersPage } from "@/features/dashboard/workers";

export const Route = createFileRoute("/dashboard/workers/")({ component: WorkersPage });
