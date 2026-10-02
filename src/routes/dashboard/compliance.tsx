import { createFileRoute } from "@tanstack/react-router";
import { CompliancePage } from "@/features/dashboard/evidence";

export const Route = createFileRoute("/dashboard/compliance")({ component: CompliancePage });
