import { createFileRoute } from "@tanstack/react-router";
import { FindingsPage } from "@/features/dashboard/governance";

export const Route = createFileRoute("/dashboard/findings")({ component: FindingsPage });
