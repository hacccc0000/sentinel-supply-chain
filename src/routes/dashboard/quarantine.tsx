import { createFileRoute } from "@tanstack/react-router";
import { QuarantinePage } from "@/features/dashboard/quarantine";

export const Route = createFileRoute("/dashboard/quarantine")({ component: QuarantinePage });
