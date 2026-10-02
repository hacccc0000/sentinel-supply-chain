import { createFileRoute } from "@tanstack/react-router";
import { AuditPage } from "@/features/dashboard/evidence";

export const Route = createFileRoute("/dashboard/audit")({ component: AuditPage });
